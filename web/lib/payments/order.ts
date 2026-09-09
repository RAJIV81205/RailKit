import Order, { OrderDocument } from "@/lib/db/models/Order";
import User from "@/lib/db/models/User";
import mongoose from "mongoose";
import { getPaidPlanRuntime } from "@/lib/constants";
import { sendWelcomeEmail } from "../services/email";
import {
  getEffectiveExpirationDate,
  grantV2Plan,
} from "@/lib/billing/entitlements";
import {
  isSuccessfulPaymentStatus,
  normalizeNonSuccessfulOrderStatus,
  validateSuccessfulPayment,
} from "@/lib/payments/validation";

type PaymentStateInput = {
  orderId: string;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  transactionReference?: string | null;
  orderAmount?: number | null;
  orderCurrency?: string | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  customerId?: string | null;
  source: "webhook" | "status_sync";
};

type PaymentStateDependencies = {
  sendConfirmation: (userId: string, orderId: string) => Promise<unknown>;
};

const defaultDependencies: PaymentStateDependencies = {
  sendConfirmation: sendWelcomeEmail,
};

export async function applyOrderPaymentState(
  input: PaymentStateInput,
  dependencies: PaymentStateDependencies = defaultDependencies,
) {
  const paymentStatus = input.paymentStatus?.trim().toUpperCase() || "PENDING";
  const paid = isSuccessfulPaymentStatus(paymentStatus);

  // Transitional and failed events may arrive after SUCCESS. Only update an
  // order that has not reached its terminal paid/credited state.
  if (!paid) {
    const order = await Order.findOneAndUpdate(
      {
        orderId: input.orderId,
        credited: false,
        status: { $ne: "paid" },
        paymentStatus: { $ne: "SUCCESS" },
      },
      {
        $set: {
          status: normalizeNonSuccessfulOrderStatus(input.orderStatus ?? paymentStatus),
          paymentStatus,
          cashfreeOrderStatus: input.orderStatus || null,
          ...(input.source === "webhook" ? { lastWebhookAt: new Date() } : {}),
        },
      },
      { returnDocument: "after" },
    );
    if (order) {
      return { found: true, paid: false, credited: false, fulfillmentBlocked: false };
    }
    const existing = await Order.findOne({ orderId: input.orderId }).lean();
    return {
      found: Boolean(existing),
      paid: existing?.paymentStatus === "SUCCESS",
      credited: Boolean(existing?.credited),
      fulfillmentBlocked: false,
    };
  }

  const session = await mongoose.startSession();
  let result = { found: false, paid: false, credited: false, fulfillmentBlocked: false };
  let fulfilledOrderId: string | null = null;
  let fulfilledUserId: string | null = null;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderId: input.orderId }).session(session);
      if (!order) return;

      const verification = validateSuccessfulPayment({
        expectedAmount: order.amount,
        expectedCurrency: order.currency,
        expectedCustomerId: order.userId.toString(),
        paymentStatus,
        transactionReference: input.transactionReference,
        orderAmount: input.orderAmount,
        orderCurrency: input.orderCurrency,
        paymentAmount: input.paymentAmount,
        paymentCurrency: input.paymentCurrency,
        customerId: input.customerId,
      });
      if (!verification.valid) {
        throw new Error(`Payment verification failed: ${verification.reason}`);
      }

      if (order.credited) {
        result = { found: true, paid: true, credited: true, fulfillmentBlocked: false };
        return;
      }

      const duplicatePayment = await Order.findOne({
        _id: { $ne: order._id },
        transactionReference: input.transactionReference,
        credited: true,
      }).session(session);
      if (duplicatePayment) {
        throw new Error("Payment reference has already fulfilled another order");
      }

      const user = await User.findById(order.userId).session(session);
      if (!user) throw new Error(`User not found while fulfilling order: ${order.userId}`);

      const now = new Date();
      const currentExpiration = getEffectiveExpirationDate(user);
      const hasActivePaidPlan =
        user.plan !== "free" &&
        currentExpiration !== null &&
        currentExpiration.getTime() > now.getTime();

      order.status = "paid";
      order.paymentStatus = "SUCCESS";
      order.cashfreeOrderStatus = input.orderStatus || "PAID";
      order.transactionReference = input.transactionReference!.trim();
      if (input.source === "webhook") order.lastWebhookAt = now;

      // A stale checkout must never overwrite or shorten an entitlement that
      // was activated by another payment. Keep the payment for manual review.
      if (hasActivePaidPlan) {
        order.note = "Payment received while another paid entitlement was active; manual review required.";
        await order.save({ session });
        result = { found: true, paid: true, credited: false, fulfillmentBlocked: true };
        return;
      }

      if (order.entitlementVersion === 2 && order.billingInterval) {
        const entitlement = grantV2Plan(user, order.planType, order.billingInterval, now);
        const purchasedLimit = order.monthlyLimit;
        if (typeof purchasedLimit !== "number" || !Number.isFinite(purchasedLimit)) {
          throw new Error("Order entitlement limit is missing or invalid");
        }
        user.baseLimit = purchasedLimit;
        user.limit = purchasedLimit;
        order.entitlementStartsAt = entitlement.startsAt;
        order.entitlementEndsAt = entitlement.endsAt;
      } else {
        const planConfig = getPaidPlanRuntime(order.planType);
        if (!planConfig) throw new Error(`Unsupported paid plan type: ${order.planType}`);
        user.plan = planConfig.userPlan;
        user.limit = planConfig.limit;
        user.usage = 0;
        user.billingDate = now;
      }

      order.credited = true;
      await user.save({ session });
      await order.save({ session });
      fulfilledOrderId = order.orderId;
      fulfilledUserId = order.userId.toString();
      result = { found: true, paid: true, credited: true, fulfillmentBlocked: false };
    });
  } finally {
    await session.endSession();
  }

  if (fulfilledOrderId && fulfilledUserId) {
    try {
      await dependencies.sendConfirmation(fulfilledUserId, fulfilledOrderId);
    } catch (error) {
      console.error("Welcome email failed after plan grant:", error);
    }
  }

  return result;
}

export async function syncOrderWithCashfree(
  order: Pick<OrderDocument, "orderId">,
  cashfreeOrderStatus?: string,
  cashfreePaymentStatus?: string,
  transactionReference?: string | null,
  verification?: Omit<PaymentStateInput, "orderId" | "orderStatus" | "paymentStatus" | "transactionReference" | "source">,
) {
  return applyOrderPaymentState({
    orderId: order.orderId,
    orderStatus: cashfreeOrderStatus,
    paymentStatus: cashfreePaymentStatus,
    transactionReference,
    ...verification,
    source: "status_sync",
  });
}
