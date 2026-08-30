import { NextResponse } from "next/server";
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

function makeOrderId(userId: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `order_${userId.slice(-8)}_${Date.now()}_${suffix}`;
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

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    if (process.env.BILLING_V2_ENABLED !== "true") {
      return NextResponse.json({ success: false, message: "new billing plans are temporarily unavailable" }, { status: 503 });
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

    const body = (await request.json()) as { planType?: string; billingInterval?: string };
    if (!isPaidPlanType(body.planType)) {
      return NextResponse.json(
        { success: false, message: "invalid plan type" },
        { status: 400 }
      );
    }

    const billingInterval = body.billingInterval === "year" ? "year" : body.billingInterval === "month" ? "month" : null;
    if (!billingInterval) {
      return NextResponse.json({ success: false, message: "billingInterval must be month or year" }, { status: 400 });
    }

    // Existing users are never rewritten. V2 users cannot double-purchase.
    if (user.plan !== "free" && user.expirationDate && user.expirationDate.getTime() > Date.now()) {
      return NextResponse.json({ success: false, message: "active plan cannot be changed before expiry" }, { status: 409 });
    }

    const planConfig = getPaidPlanRuntime(body.planType, billingInterval);
    if (!planConfig) {
      return NextResponse.json(
        { success: false, message: "plan config not found" },
        { status: 400 }
      );
    }
    const orderId = makeOrderId(user._id.toString());

    const createdOrderDoc = await Order.create({
      userId: user._id,
      orderId,
      cfOrderId: null,
      paymentSessionId: null,
      planType: body.planType,
      entitlementVersion: 2,
      billingInterval,
      termMonths: planConfig.termMonths,
      monthlyLimit: planConfig.limit,
      amount: planConfig.amount,
      currency: "INR",
      status: "created",
      paymentStatus: "PENDING",
      credited: false,
      cashfreeOrderStatus: null,
    });

    const cashfreeRequest = {
      order_id: orderId,
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
      order_note: `${body.planType} ${billingInterval} plan for railkit`,
      order_tags: {
        plan_type: body.planType,
        billing_interval: billingInterval,
      },
    };

    try {
      const cashfreeResponse = await cashfree.PGCreateOrder(cashfreeRequest);
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
          { status: 502 }
        );
      }

      createdOrderDoc.cfOrderId =
        typeof cfOrder.cf_order_id === "number" ? cfOrder.cf_order_id : null;
      createdOrderDoc.orderId = cfOrder.order_id || orderId;
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
        : "failed to create order";

    console.error("Create order route error:", error);
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
