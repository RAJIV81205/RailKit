import mongoose from "mongoose";
import LimitTopup from "@/lib/db/models/LimitTopup";
import Order from "@/lib/db/models/Order";
import User from "@/lib/db/models/User";
import {
  getEffectiveExpirationDate,
  syncV2Entitlement,
} from "@/lib/billing/entitlements";
import { validateSuccessfulPayment } from "@/lib/payments/validation";

type TopupPaymentInput = {
  orderId: string;
  userId: string;
  paymentStatus?: string | null;
  transactionReference?: string | null;
  orderStatus?: string | null;
  orderAmount?: number | null;
  orderCurrency?: string | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  customerId?: string | null;
  cfOrderId?: number | null;
  paymentSessionId?: string | null;
};

function isPaidPlan(plan?: string | null) {
  return plan === "pro" || plan === "enterprise";
}

export async function fulfillLimitTopup(input: TopupPaymentInput) {
  const session = await mongoose.startSession();
  const result = {
    found: false,
    credited: false,
    requiresSupport: false,
    extraLimit: 0,
  };

  try {
    await session.withTransaction(async () => {
      const topup = await LimitTopup.findOne({
        orderId: input.orderId,
        userId: input.userId,
      }).session(session);
      if (!topup) return;

      result.found = true;
      result.extraLimit = topup.extraLimit;

      const verification = validateSuccessfulPayment({
        expectedAmount: topup.amount,
        expectedCurrency: topup.currency,
        expectedCustomerId: topup.userId.toString(),
        paymentStatus: input.paymentStatus,
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

      if (topup.credited) {
        result.credited = true;
        return;
      }

      const [duplicateTopup, duplicatePlanOrder] = await Promise.all([
        LimitTopup.findOne({
          _id: { $ne: topup._id },
          transactionReference: input.transactionReference,
          credited: true,
        }).session(session),
        Order.findOne({
          transactionReference: input.transactionReference,
          credited: true,
        }).session(session),
      ]);
      if (duplicateTopup || duplicatePlanOrder) {
        throw new Error("Payment reference has already been credited");
      }

      const user = await User.findById(topup.userId).session(session);
      if (!user) throw new Error("Top-up user not found");

      const now = new Date();
      const sync = syncV2Entitlement(user, now);
      const expiration = getEffectiveExpirationDate(user);
      const active =
        isPaidPlan(user.plan) &&
        (user.entitlementVersion !== 2 ||
          Boolean(expiration && expiration.getTime() > now.getTime()));

      topup.status = "paid";
      topup.paymentStatus = "SUCCESS";
      topup.cashfreeOrderStatus = input.orderStatus || "PAID";
      topup.transactionReference = input.transactionReference!.trim();
      topup.cfOrderId = input.cfOrderId ?? null;
      topup.paymentSessionId = input.paymentSessionId || null;

      if (!active) {
        topup.cashfreeOrderStatus = "PAID_REVIEW";
        await topup.save({ session });
        if (sync.changed) await user.save({ session });
        result.requiresSupport = true;
        return;
      }

      const extraLimit = Math.max(0, Math.floor(topup.extraLimit));
      user.limit += extraLimit;
      if (user.entitlementVersion === 2) {
        user.addonLimit = (user.addonLimit ?? 0) + extraLimit;
      }
      topup.expiresAt = expiration;
      topup.credited = true;
      await user.save({ session });
      await topup.save({ session });
      result.credited = true;
    });
  } finally {
    await session.endSession();
  }

  return result;
}
