import mongoose from "mongoose";
import Order from "@/lib/db/models/Order";
import User from "@/lib/db/models/User";
import { getEffectiveExpirationDate } from "@/lib/billing/entitlements";
import type { PaidPlanType } from "@/lib/constants";

const CHECKOUT_TTL_MS = 30 * 60 * 1000;
const MAX_ORDERS_PER_TEN_MINUTES = 10;

export type CheckoutReservationErrorCode =
  | "USER_NOT_ACTIVE"
  | "ACTIVE_PLAN"
  | "RATE_LIMITED";

export class CheckoutReservationError extends Error {
  constructor(public readonly code: CheckoutReservationErrorCode) {
    super(code);
  }
}

type ReservePlanCheckoutInput = {
  userId: string;
  orderId: string;
  planType: PaidPlanType;
  billingInterval: "month" | "year";
  termMonths: number;
  monthlyLimit: number;
  amount: number;
  currency: string;
};

export async function reservePlanCheckout(
  input: ReservePlanCheckoutInput,
  now = new Date(),
) {
  const session = await mongoose.startSession();
  let reservedOrderId: string | null = null;

  try {
    await session.withTransaction(async () => {
      // A write on the user document makes concurrent reservations for the
      // same account conflict and retry serially without a new schema field.
      await User.updateOne(
        { _id: input.userId },
        { $set: { updatedAt: now } },
        { session },
      );

      const user = await User.findById(input.userId).session(session).lean();
      if (!user?.active) throw new CheckoutReservationError("USER_NOT_ACTIVE");
      const expiration = getEffectiveExpirationDate(user);
      if (
        user.plan !== "free" &&
        expiration &&
        expiration.getTime() > now.getTime()
      ) {
        throw new CheckoutReservationError("ACTIVE_PLAN");
      }

      const staleBefore = new Date(now.getTime() - CHECKOUT_TTL_MS);
      await Order.updateMany(
        {
          userId: user._id,
          credited: false,
          status: { $in: ["created", "active"] },
          createdAt: { $lte: staleBefore },
        },
        { $set: { status: "expired", cashfreeOrderStatus: "EXPIRED" } },
        { session },
      );

      const recentOrderCount = await Order.countDocuments({
        userId: user._id,
        createdAt: { $gte: new Date(now.getTime() - 10 * 60 * 1000) },
      }).session(session);
      if (recentOrderCount >= MAX_ORDERS_PER_TEN_MINUTES) {
        throw new CheckoutReservationError("RATE_LIMITED");
      }

      const order = new Order({
        userId: user._id,
        orderId: input.orderId,
        cfOrderId: null,
        paymentSessionId: null,
        planType: input.planType,
        entitlementVersion: 2,
        billingInterval: input.billingInterval,
        termMonths: input.termMonths,
        monthlyLimit: input.monthlyLimit,
        amount: input.amount,
        currency: input.currency,
        status: "created",
        paymentStatus: "PENDING",
        credited: false,
        cashfreeOrderStatus: null,
      });
      await order.save({ session });
      reservedOrderId = order.orderId;
    });
  } finally {
    await session.endSession();
  }

  if (!reservedOrderId) throw new Error("Checkout reservation did not produce an order");
  return { orderId: reservedOrderId };
}
