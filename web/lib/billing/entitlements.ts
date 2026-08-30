import type { HydratedDocument } from "mongoose";
import { getPaidPlanRuntime, type PaidPlanType } from "@/lib/constants";
import type { UserDocument } from "@/lib/db/models/User";

type User = HydratedDocument<UserDocument>;

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function grantV2Plan(
  user: User,
  planType: PaidPlanType,
  interval: "month" | "year",
  now = new Date(),
) {
  const runtime = getPaidPlanRuntime(planType, interval);
  if (!runtime) throw new Error(`Unsupported paid plan type: ${planType}`);

  user.entitlementVersion = 2;
  user.billingInterval = interval;
  user.plan = runtime.userPlan;
  user.usage = 0;
  user.limit = runtime.limit;
  user.baseLimit = runtime.limit;
  user.addonLimit = 0;
  user.billingDate = now;
  user.quotaPeriodStart = now;
  user.quotaPeriodEnd = addMonths(now, 1);
  user.expirationDate = addMonths(now, runtime.termMonths);

  return { startsAt: now, endsAt: user.expirationDate };
}

export function syncV2Entitlement(user: User, now = new Date()) {
  if (user.entitlementVersion !== 2) return { changed: false, expired: false };

  // Free accounts have no term expiry. They still use monthly quota periods
  // after migration, while preserving their existing plan/limit semantics.
  if (user.plan === "free") {
    if (!user.quotaPeriodEnd || !user.quotaPeriodStart)
      return { changed: false, expired: false };
    let changed = false;
    while (user.quotaPeriodEnd.getTime() <= now.getTime()) {
      user.usage = 0;
      user.quotaPeriodStart = user.quotaPeriodEnd;
      user.quotaPeriodEnd = addMonths(user.quotaPeriodEnd, 1);
      user.billingDate = user.quotaPeriodStart;
      user.limit = user.baseLimit ?? user.limit;
      changed = true;
    }
    return { changed, expired: false };
  }

  // Some existing paid accounts have no expiry (admin/manual entitlement).
  // Preserve that state: monthly quota still rolls over, term remains open.
  if (user.expirationDate && user.expirationDate.getTime() <= now.getTime()) {
    user.plan = "free";
    user.limit = 50;
    user.usage = 0;
    user.baseLimit = null;
    user.addonLimit = null;
    user.billingDate = null;
    user.expirationDate = null;
    user.quotaPeriodStart = null;
    user.quotaPeriodEnd = null;
    user.entitlementVersion = null;
    user.billingInterval = null;
    return { changed: true, expired: true };
  }

  if (!user.quotaPeriodEnd || !user.quotaPeriodStart)
    return { changed: false, expired: false };

  let changed = false;
  while (user.quotaPeriodEnd.getTime() <= now.getTime()) {
    const addonUsed = Math.max(0, user.usage - (user.baseLimit ?? user.limit));
    user.addonLimit = Math.max(0, (user.addonLimit ?? 0) - addonUsed);
    user.usage = 0;
    user.quotaPeriodStart = user.quotaPeriodEnd;
    user.quotaPeriodEnd = addMonths(user.quotaPeriodEnd, 1);
    if (
      user.expirationDate &&
      user.quotaPeriodEnd.getTime() > user.expirationDate.getTime()
    ) {
      user.quotaPeriodEnd = user.expirationDate;
    }
    user.billingDate = user.quotaPeriodStart;
    user.limit = (user.baseLimit ?? user.limit) + (user.addonLimit ?? 0);
    changed = true;
    if (
      user.expirationDate &&
      user.quotaPeriodEnd.getTime() >= user.expirationDate.getTime()
    )
      break;
  }

  return { changed, expired: false };
}

export { addMonths };
