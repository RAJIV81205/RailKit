import mongoose from "mongoose";
import Order from "@/lib/db/models/Order";
import User from "@/lib/db/models/User";
import { getEffectiveExpirationDate } from "@/lib/billing/entitlements";
import { getEffectiveUpgradeTermStart } from "@/lib/billing/upgrade";
import type { PaidPlanType } from "@/lib/constants";

const CHECKOUT_TTL_MS = 30 * 60 * 1000;
const MAX_ORDERS_PER_TEN_MINUTES = 10;

export type CheckoutReservationErrorCode =
  | "USER_NOT_ACTIVE"
  | "ACTIVE_PLAN"
  | "RATE_LIMITED"
  | "UPGRADE_INELIGIBLE"
  | "UPGRADE_CHECKOUT_PENDING"
  | "RENEWAL_PENDING";

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
  orderKind?: "purchase" | "renewal";
};

type ReserveUpgradeCheckoutInput = {
  userId: string;
  orderId: string;
  amount: number;
  currency: string;
  quote: {
    billingInterval: "month";
    termMonths: number;
    monthlyLimit: number;
    termStartsAt: Date;
    termEndsAt: Date;
    sourceTermPrice: number;
    targetTermPrice: number;
    remainingFraction: number;
    creditAmount: number;
  };
};

export async function reserveUpgradeCheckout(
  input: ReserveUpgradeCheckoutInput,
  now = new Date(),
) {
  const session = await mongoose.startSession();
  let reservedOrderId: string | null = null;
  try {
    await session.withTransaction(async () => {
      await User.updateOne(
        { _id: input.userId },
        { $set: { updatedAt: now } },
        { session },
      );
      const user = await User.findById(input.userId).session(session).lean();
      if (!user?.active || user.status === "banned" || user.plan !== "pro")
        throw new CheckoutReservationError("UPGRADE_INELIGIBLE");
      if (user.upcomingPlan?.orderId) throw new CheckoutReservationError("RENEWAL_PENDING");
      const expiration = getEffectiveExpirationDate(user);
      if (
        !expiration ||
        expiration.getTime() <= now.getTime() ||
        expiration.getTime() !== input.quote.termEndsAt.getTime()
      )
        throw new CheckoutReservationError("UPGRADE_INELIGIBLE");
      const termStart = getEffectiveUpgradeTermStart(user, expiration);
      if (termStart.getTime() !== input.quote.termStartsAt.getTime())
        throw new CheckoutReservationError("UPGRADE_INELIGIBLE");
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
      const pendingUpgrade = await Order.exists({
        userId: user._id,
        orderKind: "upgrade",
        credited: false,
        status: { $in: ["created", "active"] },
        createdAt: { $gt: staleBefore },
      }).session(session);
      if (pendingUpgrade)
        throw new CheckoutReservationError("UPGRADE_CHECKOUT_PENDING");
      const recentOrderCount = await Order.countDocuments({
        userId: user._id,
        createdAt: { $gte: new Date(now.getTime() - 10 * 60 * 1000) },
      }).session(session);
      if (recentOrderCount >= MAX_ORDERS_PER_TEN_MINUTES)
        throw new CheckoutReservationError("RATE_LIMITED");
      const order = new Order({
        userId: user._id,
        orderId: input.orderId,
        cfOrderId: null,
        paymentSessionId: null,
        planType: "advance",
        orderKind: "upgrade",
        entitlementVersion: 2,
        billingInterval: input.quote.billingInterval,
        termMonths: input.quote.termMonths,
        monthlyLimit: input.quote.monthlyLimit,
        amount: input.amount,
        currency: input.currency,
        status: "created",
        paymentStatus: "PENDING",
        credited: false,
        cashfreeOrderStatus: null,
        upgradeSnapshot: {
          fromPlan: "pro",
          interval: input.quote.billingInterval,
          termStartsAt: input.quote.termStartsAt,
          termEndsAt: input.quote.termEndsAt,
          sourceTermPrice: input.quote.sourceTermPrice,
          targetTermPrice: input.quote.targetTermPrice,
          remainingFraction: input.quote.remainingFraction,
          creditAmount: input.quote.creditAmount,
        },
      });
      await order.save({ session });
      reservedOrderId = order.orderId;
    });
  } finally {
    await session.endSession();
  }
  if (!reservedOrderId)
    throw new Error("Upgrade checkout reservation did not produce an order");
  return { orderId: reservedOrderId };
}

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
      const isRenewal = input.orderKind === "renewal";
      if (user.upcomingPlan?.orderId) throw new CheckoutReservationError("RENEWAL_PENDING");
      if (isRenewal && (user.plan === "free" || !expiration || expiration.getTime() <= now.getTime() ||
          (user.plan === "pro" ? "pro" : "advance") !== input.planType)) {
        throw new CheckoutReservationError("ACTIVE_PLAN");
      }
      if (
        !isRenewal &&
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
      if (isRenewal && await Order.exists({
        userId: user._id, orderKind: "renewal", credited: false,
        status: { $in: ["created", "active"] }, createdAt: { $gt: staleBefore },
      }).session(session)) throw new CheckoutReservationError("RENEWAL_PENDING");

      const order = new Order({
        userId: user._id,
        orderId: input.orderId,
        cfOrderId: null,
        paymentSessionId: null,
        planType: input.planType,
        orderKind: input.orderKind ?? "purchase",
        entitlementVersion: 2,
        billingInterval: input.billingInterval,
        termMonths: input.termMonths,
        monthlyLimit: input.monthlyLimit,
        entitlementStartsAt: isRenewal ? expiration : null,
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

  if (!reservedOrderId)
    throw new Error("Checkout reservation did not produce an order");
  return { orderId: reservedOrderId };
}
