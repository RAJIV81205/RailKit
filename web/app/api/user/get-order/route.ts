import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import Order from "@/lib/db/models/Order";
import User from "@/lib/db/models/User";
import {
  getAuthCookieName,
  getAuthTokenFromCookies,
  verifyAuthToken,
} from "@/lib/auth";
import { cashfree } from "@/lib/payments/cashfree";
import { syncOrderWithCashfree } from "@/lib/payments/order";

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

export async function GET(request: Request) {
  try {
    await connectToDatabase();

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

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId")?.trim();
    const shouldSync = searchParams.get("sync") === "true";

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: "orderId is required" },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ orderId, userId: user._id });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "order not found" },
        { status: 404 }
      );
    }

    if (shouldSync) {
      type PaymentEntityLike = {
        payment_status?: string;
        cf_payment_id?: string | number;
      };

      const [orderResponse, paymentsResponse] = await Promise.all([
        cashfree.PGFetchOrder(order.orderId),
        cashfree.PGOrderFetchPayments(order.orderId),
      ]);

      const cfOrderStatus = orderResponse.data.order_status;
      const payments = (paymentsResponse.data || []) as PaymentEntityLike[];
      const successPayment = payments.find(
        (payment) => payment?.payment_status === "SUCCESS"
      );
      const latestPayment = successPayment || payments[0];

      await syncOrderWithCashfree(
        order,
        cfOrderStatus,
        latestPayment?.payment_status || undefined,
        latestPayment?.cf_payment_id
          ? String(latestPayment.cf_payment_id)
          : null
      );
    }

    const latestOrder = await Order.findById(order._id).lean();

    return NextResponse.json(
      {
        success: true,
        message: "order fetched",
        order: {
          orderId: latestOrder?.orderId,
          planType: latestOrder?.planType,
          entitlementVersion: latestOrder?.entitlementVersion ?? null,
          billingInterval: latestOrder?.billingInterval ?? null,
          termMonths: latestOrder?.termMonths ?? null,
          amount: latestOrder?.amount,
          currency: latestOrder?.currency,
          status: latestOrder?.status,
          paymentStatus: latestOrder?.paymentStatus,
          credited: latestOrder?.credited,
        },
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
        : "failed to fetch order";

    console.error("Get order route error:", error);
    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
