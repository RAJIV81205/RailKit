import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import { cashfree } from "@/lib/payments/cashfree";
import { applyOrderPaymentState } from "@/lib/payments/order";
import {
  isSuccessfulPaymentStatus,
  normalizeNonSuccessfulOrderStatus,
  validateWebhookTimestamp,
} from "@/lib/payments/validation";
import { fulfillLimitTopup } from "@/lib/payments/topup";
import LimitTopup from "@/lib/db/models/LimitTopup";

type CashfreeWebhookPayload = {
  type?: string;
  event_time?: string;
  data?: {
    order?: {
      order_id?: string;
      order_status?: string;
      order_amount?: number;
      order_currency?: string;
      order_tags?: Record<string, string | undefined> | null;
    };
    payment?: {
      cf_payment_id?: string | number;
      payment_status?: string;
      payment_amount?: number;
      payment_currency?: string;
      payment_message?: string;
      bank_reference?: string | null;
      auth_id?: string | null;
    };
    customer_details?: {
      customer_id?: string;
      customer_email?: string;
      customer_phone?: string;
      customer_name?: string;
    };
    payment_gateway_details?: Record<string, unknown> | null;
  };
};

function getVerifiedWebhookPayload(
  verified: unknown,
  rawBody: string
): CashfreeWebhookPayload {
  const objectPayload =
    typeof verified === "object" && verified !== null
      ? (verified as { object?: unknown }).object ?? verified
      : verified;

  if (typeof objectPayload === "string") {
    return JSON.parse(objectPayload) as CashfreeWebhookPayload;
  }

  if (typeof objectPayload === "object" && objectPayload !== null) {
    return objectPayload as CashfreeWebhookPayload;
  }

  return JSON.parse(rawBody) as CashfreeWebhookPayload;
}

function getOrderStatusForPaymentStatus(paymentStatus?: string | null) {
  const normalized = paymentStatus?.toUpperCase();
  if (normalized === "SUCCESS") return "PAID";
  if (normalized === "FAILED") return "FAILED";
  if (normalized === "USER_DROPPED") return "USER_DROPPED";
  return null;
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    const webhookVersion = request.headers.get("x-webhook-version");
    const idempotencyKey =
      request.headers.get("x-idempotency-key") ||
      request.headers.get("x-idempotency-header");

    if (!signature || !timestamp || !webhookVersion) {
      return NextResponse.json(
        { success: false, message: "missing required webhook headers" },
        { status: 400 }
      );
    }

    if (webhookVersion !== "2023-08-01" && webhookVersion !== "2025-01-01") {
      return NextResponse.json(
        { success: false, message: "unsupported webhook version" },
        { status: 400 },
      );
    }

    if (webhookVersion === "2025-01-01" && !idempotencyKey) {
      return NextResponse.json(
        { success: false, message: "missing webhook idempotency key" },
        { status: 400 },
      );
    }

    if (!validateWebhookTimestamp(timestamp)) {
      return NextResponse.json(
        { success: false, message: "stale or invalid webhook timestamp" },
        { status: 401 },
      );
    }

    const rawBody = await request.text();
    const verified = cashfree.PGVerifyWebhookSignature(
      signature,
      rawBody,
      timestamp
    );

    const eventPayload = getVerifiedWebhookPayload(verified, rawBody);
    const orderId = eventPayload?.data?.order?.order_id?.trim();
    const paymentStatus = eventPayload?.data?.payment?.payment_status || null;
    const orderStatus =
      eventPayload?.data?.order?.order_status ||
      getOrderStatusForPaymentStatus(paymentStatus);
    const transactionReference =
      eventPayload?.data?.payment?.cf_payment_id || null;
    const orderType = eventPayload?.data?.order?.order_tags?.order_type;
    if (!orderId) {
      return NextResponse.json(
        { success: true, message: "webhook accepted without order id" },
        { status: 200 }
      );
    }

    if (!orderStatus && !paymentStatus) {
      return NextResponse.json(
        {
          success: true,
          message: "webhook accepted without actionable payment state",
        },
        { status: 200 }
      );
    }

    if (orderType === "limit_topup") {
      const customerId = eventPayload.data?.customer_details?.customer_id;
      if (!customerId) throw new Error("Top-up webhook customer is missing");

      if (!isSuccessfulPaymentStatus(paymentStatus)) {
        await LimitTopup.updateOne(
          {
            orderId,
            userId: customerId,
            credited: false,
            paymentStatus: { $ne: "SUCCESS" },
            status: { $ne: "paid" },
          },
          {
            $set: {
              status: normalizeNonSuccessfulOrderStatus(orderStatus || paymentStatus),
              paymentStatus: paymentStatus?.toUpperCase() || "PENDING",
              cashfreeOrderStatus: orderStatus || null,
            },
          },
        );
        return NextResponse.json(
          { success: true, message: "top-up webhook processed" },
          { status: 200 },
        );
      }

      const topupResult = await fulfillLimitTopup({
        orderId,
        userId: customerId,
        orderStatus,
        paymentStatus,
        transactionReference: transactionReference ? String(transactionReference) : null,
        orderAmount: eventPayload.data?.order?.order_amount,
        orderCurrency: eventPayload.data?.order?.order_currency,
        paymentAmount: eventPayload.data?.payment?.payment_amount,
        paymentCurrency: eventPayload.data?.payment?.payment_currency,
        customerId,
      });
      if (!topupResult.found) {
        console.error(`[billing] Cashfree webhook referenced unknown top-up ${orderId}`);
      }
      if (topupResult.requiresSupport) {
        console.error(`[billing] Paid top-up ${orderId} requires manual entitlement review`);
      }
      return NextResponse.json(
        { success: true, message: "top-up webhook processed" },
        { status: 200 },
      );
    }

    const result = await applyOrderPaymentState({
      orderId,
      orderStatus,
      paymentStatus,
      transactionReference: transactionReference ? String(transactionReference) : null,
      orderAmount: eventPayload.data?.order?.order_amount,
      orderCurrency: eventPayload.data?.order?.order_currency,
      paymentAmount: eventPayload.data?.payment?.payment_amount,
      paymentCurrency: eventPayload.data?.payment?.payment_currency,
      customerId: eventPayload.data?.customer_details?.customer_id,
      source: "webhook",
    });

    if (!result.found) {
      console.error(`[billing] Cashfree webhook referenced unknown order ${orderId}`);
    }
    if (result.fulfillmentBlocked) {
      console.error(`[billing] Paid order ${orderId} requires manual entitlement review`);
    }

    return NextResponse.json(
      { success: true, message: "webhook processed" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "unknown webhook error";

    console.error("Cashfree webhook error:", errorMessage);

    const invalidSignature =
      errorMessage.toLowerCase().includes("signature");

    return NextResponse.json(
      {
        success: false,
        message: invalidSignature
          ? "invalid webhook signature"
          : "failed to process webhook",
      },
      { status: invalidSignature ? 401 : 500 }
    );
  }
}
