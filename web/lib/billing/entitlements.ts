import type { HydratedDocument } from "mongoose";
import { getPaidPlanRuntime, type PaidPlanType } from "@/lib/constants";
import type { UserDocument } from "@/lib/db/models/User";

type User = HydratedDocument<UserDocument>;

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

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

/**
 * Resolve plan expiry using explicit admin/payment expiry first, then the
 * legacy 30-day billing window used by existing paid accounts.
 */
export function getEffectiveExpirationDate(user: Pick<UserDocument, "billingDate" | "expirationDate">) {
  if (user.expirationDate) return user.expirationDate;
  if (user.billingDate) {
    return new Date(user.billingDate.getTime() + BILLING_CYCLE_MS);
  }
  return null;
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

  const effectiveExpirationDate = getEffectiveExpirationDate(user);

  if (effectiveExpirationDate && effectiveExpirationDate.getTime() <= now.getTime()) {
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
      effectiveExpirationDate &&
      user.quotaPeriodEnd.getTime() > effectiveExpirationDate.getTime()
    ) {
      user.quotaPeriodEnd = effectiveExpirationDate;
    }
    user.billingDate = user.quotaPeriodStart;
    user.limit = (user.baseLimit ?? user.limit) + (user.addonLimit ?? 0);
    changed = true;
    if (
      effectiveExpirationDate &&
      user.quotaPeriodEnd.getTime() >= effectiveExpirationDate.getTime()
    )
      break;
  }

  return { changed, expired: false };
}

export { addMonths };
