import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import User from "@/lib/db/models/User";
import Order from "@/lib/db/models/Order";
import {
  getAuthCookieName,
  getAuthTokenFromCookies,
  verifyAuthToken,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";
import {
  cashfree,
  getCashfreeCheckoutMode,
  getAppReturnUrl,
  getWebhookUrl,
} from "@/lib/payments/cashfree";
import { getPaidPlanRuntime, isPaidPlanType } from "@/lib/constants";
import { getCashfreeIdempotencyKey } from "@/lib/payments/validation";
import {
  CheckoutReservationError,
  reservePlanCheckout,
} from "@/lib/payments/checkout";

function makeOrderId(userId: string) {
  return `order_${userId.slice(-8)}_${randomUUID().replace(/-/g, "")}`;
}

function sanitizeCustomerName(name?: string) {
  const cleaned = (name || "User").replace(/[^a-zA-Z0-9 ]/g, "").trim();
  return cleaned || "User";
}

function unauthorizedResponse() {
  const response = NextResponse.json(
    { success: false, message: "unauthorized" },
    { status: 401 },
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

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    if (process.env.BILLING_V2_ENABLED !== "true") {
      return NextResponse.json(
        {
          success: false,
          message: "new billing plans are temporarily unavailable",
        },
        { status: 503 },
      );
    }

    const token = await getAuthTokenFromCookies();
    if (!token) {
      return unauthorizedResponse();
    }

    const payload = verifyAuthToken(token);

    if (!payload || !payload.userId) {
      return unauthorizedResponse();
    }

    const user = await User.findById(payload.userId).lean();
    if (!user || !user.active) {
      return unauthorizedResponse();
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4_096) {
      return NextResponse.json(
        { success: false, message: "request is too large" },
        { status: 413 },
      );
    }

    const body = (await request.json()) as {
      planType?: string;
      billingInterval?: string;
    };
    if (!isPaidPlanType(body.planType)) {
      return NextResponse.json(
        { success: false, message: "invalid plan type" },
        { status: 400 },
      );
    }

    const billingInterval =
      body.billingInterval === "year"
        ? "year"
        : body.billingInterval === "month"
          ? "month"
          : null;
    if (!billingInterval) {
      return NextResponse.json(
        { success: false, message: "billingInterval must be month or year" },
        { status: 400 },
      );
    }

    const planConfig = getPaidPlanRuntime(body.planType, billingInterval);
    if (!planConfig) {
      return NextResponse.json(
        { success: false, message: "plan config not found" },
        { status: 400 },
      );
    }
    const now = new Date();
    const orderId = makeOrderId(user._id.toString());
    const checkoutExpiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    let reservation: Awaited<ReturnType<typeof reservePlanCheckout>>;

    try {
      reservation = await reservePlanCheckout({
        userId: user._id.toString(),
        orderId,
        planType: body.planType,
        billingInterval,
        termMonths: planConfig.termMonths,
        monthlyLimit: planConfig.limit,
        amount: planConfig.amount,
        currency: "INR",
      });
    } catch (error) {
      const code = error instanceof CheckoutReservationError ? error.code : "";
      if (code === "ACTIVE_PLAN") {
        return NextResponse.json(
          {
            success: false,
            message: "active plan cannot be changed before expiry",
          },
          { status: 409 },
        );
      }
      if (code === "RATE_LIMITED") {
        return NextResponse.json(
          {
            success: false,
            message: "maximum 10 checkout orders are allowed every 10 minutes",
          },
          { status: 429, headers: { "Retry-After": "600" } },
        );
      }
      if (code === "USER_NOT_ACTIVE") return unauthorizedResponse();
      throw error;
    }

    const effectiveOrderId = reservation.orderId;
    const createdOrderDoc = await Order.findOne({ orderId: effectiveOrderId });
    if (!createdOrderDoc) throw new Error("Created order could not be loaded");

    const cashfreeRequest = {
      order_id: effectiveOrderId,
      order_amount: planConfig.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: user._id.toString(),
        customer_name: sanitizeCustomerName(user.name),
        customer_email: user.email,
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url: getAppReturnUrl(),
        notify_url: getWebhookUrl(),
      },
      order_expiry_time: checkoutExpiresAt.toISOString(),
      order_note: `${body.planType} ${billingInterval} plan for railkit`,
      order_tags: {
        plan_type: body.planType,
        billing_interval: billingInterval,
      },
    };

    try {
      const cashfreeResponse = await cashfree.PGCreateOrder(
        cashfreeRequest,
        effectiveOrderId,
        getCashfreeIdempotencyKey(effectiveOrderId),
      );
      const cfOrder = cashfreeResponse.data;

      if (!cfOrder.payment_session_id) {
        await createdOrderDoc
          .updateOne({
            $set: {
              status: "failed",
              paymentStatus: "FAILED",
              cashfreeOrderStatus: "FAILED",
            },
          })
          .catch(() => {});

        return NextResponse.json(
          { success: false, message: "payment session was not created" },
          { status: 502 },
        );
      }

      createdOrderDoc.cfOrderId =
        typeof cfOrder.cf_order_id === "number" ? cfOrder.cf_order_id : null;
      createdOrderDoc.orderId = cfOrder.order_id || effectiveOrderId;
      createdOrderDoc.paymentSessionId = cfOrder.payment_session_id || null;
      createdOrderDoc.status =
        cfOrder.order_status?.toLowerCase() === "active" ? "active" : "created";
      createdOrderDoc.cashfreeOrderStatus = cfOrder.order_status || "ACTIVE";
      await createdOrderDoc.save();
    } catch (error) {
      await createdOrderDoc
        .updateOne({
          $set: {
            status: "failed",
            paymentStatus: "FAILED",
            cashfreeOrderStatus: "FAILED",
          },
        })
        .catch(() => {});
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        message: "order created",
        order: {
          orderId: createdOrderDoc.orderId,
          paymentSessionId: createdOrderDoc.paymentSessionId,
          planType: createdOrderDoc.planType,
          amount: createdOrderDoc.amount,
          currency: createdOrderDoc.currency,
          status: createdOrderDoc.status,
        },
        cashfreeMode: getCashfreeCheckoutMode(),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Create order route error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "failed to create order",
      },
      { status: 500 },
    );
  }
}
