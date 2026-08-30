import Order, { OrderDocument } from "@/lib/db/models/Order";
import User from "@/lib/db/models/User";
import { getPaidPlanRuntime, type PaidPlanType } from "@/lib/constants";
import { sendWelcomeEmail } from "../services/email";
import { grantV2Plan } from "@/lib/billing/entitlements";

type PaymentStateInput = {
  orderId: string;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  transactionReference?: string | null;
  source: "webhook" | "status_sync";
};

function normalizeOrderStatus(status?: string | null) {
  if (!status) {
    return "created";
  }

  const normalized = status.toUpperCase();
  if (normalized === "PAID") return "paid";
  if (normalized === "ACTIVE") return "active";
  if (normalized === "EXPIRED") return "expired";
  if (
    normalized === "TERMINATED" ||
    normalized === "CANCELLED" ||
    normalized === "USER_DROPPED"
  ) {
    return "cancelled";
  }
  if (normalized === "FAILED") return "failed";
  return "created";
}

function isSuccess(orderStatus?: string | null, paymentStatus?: string | null) {
  return (
    orderStatus?.toUpperCase() === "PAID" ||
    paymentStatus?.toUpperCase() === "SUCCESS"
  );
}

export async function applyOrderPaymentState(input: PaymentStateInput) {
  const order = await Order.findOne({ orderId: input.orderId });
  if (!order) {
    return { found: false, paid: false, credited: false };
  }

  const nextStatus = normalizeOrderStatus(input.orderStatus ?? order.cashfreeOrderStatus);
  const paymentStatus = (input.paymentStatus || order.paymentStatus || "PENDING").toUpperCase();
  const paid = isSuccess(input.orderStatus, paymentStatus);

  order.status = paid ? "paid" : nextStatus;
  order.paymentStatus = paymentStatus;
  order.cashfreeOrderStatus = paid
    ? "PAID"
    : input.orderStatus || order.cashfreeOrderStatus || null;
  if (input.transactionReference) {
    order.transactionReference = input.transactionReference;
  }
  if (input.source === "webhook") {
    order.lastWebhookAt = new Date();
  }
  await order.save();

  if (!paid) {
    return { found: true, paid: false, credited: order.credited };
  }

  const creditedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      credited: false,
    },
    {
      $set: {
        credited: true,
        status: "paid",
        paymentStatus: "SUCCESS",
      },
    },
    { new: true }
  );

  if (!creditedOrder) {
    return { found: true, paid: true, credited: true };
  }

  try {
    if (creditedOrder.entitlementVersion === 2 && creditedOrder.billingInterval) {
      const user = await User.findById(creditedOrder.userId);
      if (!user) throw new Error(`User not found while fulfilling order: ${creditedOrder.userId}`);
      const entitlement = grantV2Plan(user, creditedOrder.planType, creditedOrder.billingInterval);
      await user.save();
      await Order.findByIdAndUpdate(creditedOrder._id, {
        $set: { entitlementStartsAt: entitlement.startsAt, entitlementEndsAt: entitlement.endsAt },
      });
    } else {
      await grantPlanToUser(creditedOrder.userId.toString(), creditedOrder.planType);
    }
  } catch (error) {
    await Order.findByIdAndUpdate(creditedOrder._id, {
      $set: {
        credited: false,
      },
    }).catch(() => {});
    throw error;
  }

  try {
    await sendWelcomeEmail(creditedOrder.userId.toString());
  } catch (error) {
    console.error("Welcome email failed after plan grant:", error);
  }

  return { found: true, paid: true, credited: true };
}

async function grantPlanToUser(userId: string, planType: PaidPlanType) {
  const planConfig = getPaidPlanRuntime(planType);
  if (!planConfig) {
    throw new Error(`Unsupported paid plan type: ${planType}`);
  }

  const updatedUser = await User.findByIdAndUpdate(userId, {
    $set: {
      plan: planConfig.userPlan,
      limit: planConfig.limit,
      usage: 0,
      billingDate: new Date(),
    },
  });

  if (!updatedUser) {
    throw new Error(`User not found while granting plan for order fulfillment: ${userId}`);
  }
}

export async function syncOrderWithCashfree(
  order: Pick<OrderDocument, "orderId">,
  cashfreeOrderStatus?: string,
  cashfreePaymentStatus?: string,
  transactionReference?: string | null
) {
  return applyOrderPaymentState({
    orderId: order.orderId,
    orderStatus: cashfreeOrderStatus,
    paymentStatus: cashfreePaymentStatus,
    transactionReference,
    source: "status_sync",
  });
}
