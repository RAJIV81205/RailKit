import { NextResponse } from "next/server";
import User from "@/lib/db/models/User";
import LimitTopup from "@/lib/db/models/LimitTopup";
import {
  getAuthCookieName,
  getAuthTokenFromCookies,
  verifyAuthToken,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";
import { cashfree, getCashfreeCheckoutMode } from "@/lib/payments/cashfree";
import { TOPUP_OPTIONS } from "@/lib/constants";
import {
  getEffectiveExpirationDate,
  syncV2Entitlement,
} from "@/lib/billing/entitlements";

// use a general numeric key type so calling code can pass `number` safely
const TOPUP_REQUESTS: Map<number, number> = new Map(TOPUP_OPTIONS.map((option) => [option.requests, option.price]));

type PaymentEntityLike = {
  payment_status?: string;
  cf_payment_id?: string | number;
};


function makeOrderId(userId: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `topup_${userId.slice(-8)}_${Date.now()}_${suffix}`;
}

function sanitizeCustomerName(name?: string) {
  const cleaned = (name || "User").replace(/[^a-zA-Z0-9 ]/g, "").trim();
  return cleaned || "User";
}

function unauthorizedResponse() {
  const response = NextResponse.json(
    { success: false, message: "unauthorized" },
    { status: 401 }
  );
  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function getDashboardReturnUrl() {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is required");
  }

  return `${appBaseUrl.replace(
    /\/$/,
    ""
  )}/dashboard?payment_return=limit&order_id={order_id}`;
}

function getAddonQuote(extraLimit: number) {
  if (!Number.isInteger(extraLimit)) {
    return null;
  }

  const amount = TOPUP_REQUESTS.get(extraLimit);
  if (!amount) {
    return null;
  }

  return {
    extraLimit,
    amount,
  };
}

function isPaidPlan(plan?: string | null) {
  const normalized = (plan || "").toLowerCase();
  return (
    normalized === "pro" ||
    normalized === "enterprise" ||
    // historically some places use `advance` and others `advanced` — accept both
    normalized === "advance" ||
    normalized === "advanced"
  );
}

async function getAuthenticatedUser() {
  const token = await getAuthTokenFromCookies();
  if (!token) return null;

  const payload = verifyAuthToken(token);
  if (!payload?.userId) return null;

  const user = await User.findById(payload.userId);
  if (!user?.active) return null;

  const sync = syncV2Entitlement(user);
  if (sync.changed) await user.save();

  return user;
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    if (!isPaidPlan(user.plan)) {
      return NextResponse.json(
        { success: false, message: "limit add-ons are only available on paid plans" },
        { status: 403 }
      );
    }

    const effectiveExpirationDate = getEffectiveExpirationDate(user);
    if (user.entitlementVersion === 2 && (!effectiveExpirationDate || effectiveExpirationDate.getTime() <= Date.now())) {
      return NextResponse.json({ success: false, message: "active plan is required" }, { status: 403 });
    }

    const body = (await request.json()) as { extraLimit?: number };
    const quote = getAddonQuote(Number(body.extraLimit));
    if (!quote) {
      return NextResponse.json(
        {
          success: false,
          message: `extraLimit must be one of: ${TOPUP_OPTIONS.map((option) => option.requests).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const orderId = makeOrderId(user._id.toString());
    const cashfreeRequest = {
      order_id: orderId,
      order_amount: quote.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user._id.toString(),
        customer_name: sanitizeCustomerName(user.name),
        customer_email: user.email,
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url: getDashboardReturnUrl(),
      },
      order_note: `${quote.extraLimit} extra API requests for railkit`,
      order_tags: {
        order_type: "limit_topup",
        extra_limit: String(quote.extraLimit),
      },
    };

    const cashfreeResponse = await cashfree.PGCreateOrder(cashfreeRequest);
    const cfOrder = cashfreeResponse.data;

    if (!cfOrder.payment_session_id) {
      return NextResponse.json(
        { success: false, message: "payment session was not created" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "limit add-on order created",
        order: {
          orderId: cfOrder.order_id || orderId,
          paymentSessionId: cfOrder.payment_session_id,
          extraLimit: quote.extraLimit,
          amount: quote.amount,
          currency: "INR",
        },
        cashfreeMode: getCashfreeCheckoutMode(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response
        ?.data?.message === "string"
        ? (error as { response?: { data?: { message?: string } } }).response!.data!
            .message!
        : "failed to create limit add-on order";

    console.error("Increase limit create error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await connectToDatabase();
    const user = await getAuthenticatedUser();
    if (!user) return unauthorizedResponse();

    if (!isPaidPlan(user.plan)) {
      return NextResponse.json(
        { success: false, message: "limit add-ons are only available on paid plans" },
        { status: 403 }
      );
    }

    const effectiveExpirationDate = getEffectiveExpirationDate(user);
    if (user.entitlementVersion === 2 && (!effectiveExpirationDate || effectiveExpirationDate.getTime() <= Date.now())) {
      return NextResponse.json({ success: false, message: "active plan is required" }, { status: 403 });
    }

    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "orderId is required" },
        { status: 400 }
      );
    }

    const [orderResponse, paymentsResponse] = await Promise.all([
      cashfree.PGFetchOrder(orderId),
      cashfree.PGOrderFetchPayments(orderId),
    ]);

    const orderData = orderResponse.data as {
      order_status?: string | null;
      order_amount?: number;
      order_currency?: string | null;
      order_tags?: Record<string, string | undefined> | null;
      cf_order_id?: number;
      payment_session_id?: string | null;
      customer_details?: { customer_id?: string | null } | null;
      customer_id?: string | null;
    };
    const customerId =
      orderData.customer_details?.customer_id || orderData.customer_id;
    if (customerId && customerId !== user._id.toString()) {
      return NextResponse.json(
        { success: false, message: "order does not belong to this user" },
        { status: 403 }
      );
    }

    const orderType = orderData.order_tags?.order_type;
    if (orderType !== "limit_topup") {
      return NextResponse.json(
        { success: false, message: "order is not a limit add-on" },
        { status: 400 }
      );
    }

    const extraLimit = Number(orderData.order_tags?.extra_limit ?? NaN);
    if (!Number.isFinite(extraLimit) || extraLimit <= 0) {
      return NextResponse.json(
        { success: false, message: "limit add-on metadata is invalid" },
        { status: 400 }
      );
    }

    const cfOrderStatus = orderResponse.data.order_status;
    const payments = (paymentsResponse.data || []) as PaymentEntityLike[];
    const successPayment = payments.find(
      (payment) => payment?.payment_status === "SUCCESS"
    );
    const latestPayment = successPayment || payments[0];
    const paid =
      cfOrderStatus?.toUpperCase() === "PAID" ||
      latestPayment?.payment_status?.toUpperCase() === "SUCCESS";
    const paymentStatus = latestPayment?.payment_status || "PENDING";
    if (!paid) {
      return NextResponse.json(
        {
          success: true,
          message: "payment is not completed yet",
          credited: false,
          paid: false,
        },
        { status: 200 }
      );
    }

    const existingTopup = await LimitTopup.findOne({ orderId, userId: user._id });
    if (existingTopup?.credited) {
      return NextResponse.json(
        {
          success: true,
          message: "limit add-on verified",
          credited: true,
          paid: true,
          extraLimit: existingTopup.extraLimit,
        },
        { status: 200 }
      );
    }

    const now = new Date();
    const amount = Number(orderData.order_amount ?? NaN);
    const currency = orderData.order_currency || "INR";
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "order amount is invalid" },
        { status: 400 }
      );
    }

    const topupPayload = {
      userId: user._id,
      orderId,
      cfOrderId:
        typeof orderData.cf_order_id === "number" ? orderData.cf_order_id : null,
      paymentSessionId: orderData.payment_session_id || null,
      extraLimit,
        expiresAt: effectiveExpirationDate,
      amount,
      currency,
      status: "paid" as const,
      paymentStatus: "SUCCESS" as const,
      cashfreeOrderStatus: cfOrderStatus || "PAID",
      transactionReference: latestPayment?.cf_payment_id
        ? String(latestPayment.cf_payment_id)
        : null,
    };

    const creditedTopup = existingTopup
      ? await LimitTopup.findOneAndUpdate(
          { _id: existingTopup._id, credited: false },
          {
            $set: {
              ...topupPayload,
              credited: true,
              updatedAt: now,
            },
          },
          { new: true }
        )
      : await LimitTopup.create({
          ...topupPayload,
          credited: true,
          createdAt: now,
          updatedAt: now,
        });

    if (creditedTopup) {
      const amount = Math.max(0, Math.floor(extraLimit));
      await User.findByIdAndUpdate(user._id, {
        $inc: user.entitlementVersion === 2
          ? { limit: amount, addonLimit: amount }
          : { limit: amount },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "limit add-on verified",
        credited: true,
        paid: true,
        extraLimit,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { data?: { message?: string } } }).response
        ?.data?.message === "string"
        ? (error as { response?: { data?: { message?: string } } }).response!.data!
            .message!
        : "failed to verify limit add-on order";

    console.error("Increase limit verify error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
