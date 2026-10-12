export type DashboardBillingUser = {
  plan: string;
  entitlementVersion?: number | null;
  billingInterval?: "month" | "year" | null;
  billingDate?: string | null;
  expirationDate?: string | null;
  quotaPeriodStart?: string | null;
  quotaPeriodEnd?: string | null;
};

function timestamp(value?: string | null) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

export function getDashboardBilling(user: DashboardBillingUser) {
  // Plan is authoritative: retained dates from an old paid plan are not
  // the expiry or billing cycle of a user's current free plan.
  if (user.plan === "free") {
    return { isAnnual: false, isFinalCycle: false, cycleStart: null,
      cycleEnd: null, termEnd: null, nextResetAt: null };
  }
  const isAnnual = user.plan !== "free" && user.entitlementVersion === 2 && user.billingInterval === "year";
  const billingStart = timestamp(user.billingDate);
  const termEnd = timestamp(user.expirationDate) ??
    (user.plan !== "free" && billingStart !== null ? billingStart + 30 * 86400000 : null);
  const cycleStart = timestamp(user.quotaPeriodStart) ?? billingStart;
  const storedCycleEnd = timestamp(user.quotaPeriodEnd);
  const cycleEnd = isAnnual
    ? storedCycleEnd === null ? null : Math.min(storedCycleEnd, termEnd ?? storedCycleEnd)
    : termEnd;
  // At the final quota boundary the plan ends instead of granting another quota.
  const nextResetAt = isAnnual && cycleEnd !== null && termEnd !== null && cycleEnd < termEnd
    ? cycleEnd : null;
  const isFinalCycle = isAnnual && cycleEnd !== null && termEnd !== null && cycleEnd >= termEnd;
  return { isAnnual, isFinalCycle, cycleStart, cycleEnd, termEnd, nextResetAt };
}

export function formatBillingDate(time: number | null) {
  if (time === null) return "Not available";
  return new Date(time).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  }) + " IST";
}
