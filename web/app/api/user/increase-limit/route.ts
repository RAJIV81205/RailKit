import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import User from "@/lib/db/models/User";
import LimitTopup from "@/lib/db/models/LimitTopup";
import {
  getAuthCookieName,
  getAuthTokenFromCookies,
  verifyAuthToken,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";
import {
  cashfree,
  getCashfreeCheckoutMode,
  getWebhookUrl,
} from "@/lib/payments/cashfree";
import { TOPUP_OPTIONS } from "@/lib/constants";
import {
  getEffectiveExpirationDate,
  syncV2Entitlement,
} from "@/lib/billing/entitlements";
import {
  getCashfreeIdempotencyKey,
  normalizeNonSuccessfulOrderStatus,
} from "@/lib/payments/validation";
import { fulfillLimitTopup } from "@/lib/payments/topup";

// use a general numeric key type so calling code can pass `number` safely
const TOPUP_REQUESTS: Map<number, number> = new Map(TOPUP_OPTIONS.map((option) => [option.requests, option.price]));

type PaymentEntityLike = {
  payment_status?: string;
  cf_payment_id?: string | number;
  payment_amount?: number;
  payment_currency?: string;
};


function makeOrderId(userId: string) {
  return `topup_${userId.slice(-8)}_${randomUUID().replace(/-/g, "")}`;
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

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4_096) {
      return NextResponse.json({ success: false, message: "request is too large" }, { status: 413 });
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

    const recentOrderCount = await LimitTopup.countDocuments({
      userId: user._id,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });
    if (recentOrderCount >= 10) {
      return NextResponse.json(
        { success: false, message: "too many checkout attempts; try again later" },
        { status: 429 },
      );
    }

    const orderId = makeOrderId(user._id.toString());
    const checkoutExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const topup = await LimitTopup.create({
      userId: user._id,
      orderId,
      extraLimit: quote.extraLimit,
      expiresAt: effectiveExpirationDate,
      amount: quote.amount,
      currency: "INR",
      status: "created",
      paymentStatus: "PENDING",
      credited: false,
    });
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
        notify_url: getWebhookUrl(),
      },
      order_expiry_time: checkoutExpiresAt.toISOString(),
      order_note: `${quote.extraLimit} extra API requests for railkit`,
      order_tags: {
        order_type: "limit_topup",
        extra_limit: String(quote.extraLimit),
      },
    };

    let cfOrder;
    try {
      const cashfreeResponse = await cashfree.PGCreateOrder(
        cashfreeRequest,
        orderId,
        getCashfreeIdempotencyKey(orderId),
      );
      cfOrder = cashfreeResponse.data;
    } catch (error) {
      await topup.updateOne({
        $set: { status: "failed", paymentStatus: "FAILED", cashfreeOrderStatus: "FAILED" },
      }).catch(() => {});
      throw error;
    }

    if (!cfOrder.payment_session_id) {
      await topup.updateOne({
        $set: { status: "failed", paymentStatus: "FAILED", cashfreeOrderStatus: "FAILED" },
      }).catch(() => {});
      return NextResponse.json(
        { success: false, message: "payment session was not created" },
        { status: 502 }
      );
    }

    topup.cfOrderId = typeof cfOrder.cf_order_id === "number" ? cfOrder.cf_order_id : null;
    topup.paymentSessionId = cfOrder.payment_session_id;
    topup.status = cfOrder.order_status?.toUpperCase() === "ACTIVE" ? "active" : "created";
    topup.cashfreeOrderStatus = cfOrder.order_status || "ACTIVE";
    await topup.save();

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
    console.error("Increase limit create error:", error);
    return NextResponse.json({ success: false, message: "failed to create limit add-on order" }, { status: 500 });
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

    const existingTopup = await LimitTopup.findOne({ orderId, userId: user._id });
    if (!existingTopup) {
      return NextResponse.json(
        { success: false, message: "limit add-on order not found" },
        { status: 404 },
      );
    }
    if (existingTopup.credited) {
      return NextResponse.json({
        success: true,
        message: "limit add-on verified",
        credited: true,
        paid: true,
        extraLimit: existingTopup.extraLimit,
      });
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
    if (customerId !== user._id.toString()) {
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

    const taggedExtraLimit = Number(orderData.order_tags?.extra_limit ?? NaN);
    if (taggedExtraLimit !== existingTopup.extraLimit) {
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
    const paymentStatus = latestPayment?.payment_status || "PENDING";
    if (paymentStatus.toUpperCase() !== "SUCCESS") {
      await LimitTopup.updateOne(
        {
          _id: existingTopup._id,
          credited: false,
          paymentStatus: { $ne: "SUCCESS" },
          status: { $ne: "paid" },
        },
        {
          $set: {
            status: normalizeNonSuccessfulOrderStatus(cfOrderStatus || paymentStatus),
            paymentStatus: paymentStatus.toUpperCase(),
            cashfreeOrderStatus: cfOrderStatus || null,
          },
        },
      );
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

    const transactionReference = latestPayment?.cf_payment_id
      ? String(latestPayment.cf_payment_id)
      : null;
    const fulfillment = await fulfillLimitTopup({
      orderId,
      userId: user._id.toString(),
      paymentStatus,
      transactionReference,
      orderStatus: cfOrderStatus,
      orderAmount: orderData.order_amount,
      orderCurrency: orderData.order_currency,
      paymentAmount: latestPayment?.payment_amount,
      paymentCurrency: latestPayment?.payment_currency,
      customerId,
      cfOrderId:
        typeof orderData.cf_order_id === "number" ? orderData.cf_order_id : null,
      paymentSessionId: orderData.payment_session_id,
    });
    if (!fulfillment.found) {
      return NextResponse.json(
        { success: false, message: "limit add-on order not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: fulfillment.requiresSupport
          ? "payment received but the plan is no longer active"
          : "limit add-on verified",
        credited: fulfillment.credited,
        paid: true,
        requiresSupport: fulfillment.requiresSupport,
        extraLimit: fulfillment.extraLimit,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Increase limit verify error:", error);
    return NextResponse.json({ success: false, message: "failed to verify limit add-on order" }, { status: 500 });
  }
}
