import { getPaidPlanRuntime } from "@/lib/constants";
import { getEffectiveExpirationDate } from "@/lib/billing/entitlements";

type UpgradeUser = Parameters<typeof getEffectiveExpirationDate>[0] & {
  _id?: unknown;
  plan: string;
  active: boolean;
  status?: string;
  entitlementVersion?: number | null;
  billingInterval?: "month" | "year" | null;
  billingDate?: Date | null;
  entitlementStartsAt?: Date | null;
};

export class UpgradeQuoteError extends Error {
  constructor(public readonly code: "INELIGIBLE" | "EXPIRED" | "NO_TERM") {
    super(code);
  }
}

export function getEffectiveUpgradeTermStart(
  user: Pick<UpgradeUser, "entitlementStartsAt" | "billingDate">,
  termEndsAt: Date,
) {
  if (user.entitlementStartsAt) return user.entitlementStartsAt;
  return user.billingDate ?? new Date(termEndsAt.getTime() - 30 * 86400000);
}

export function getAdvanceUpgradeQuote(user: UpgradeUser, now = new Date()) {
  if (!user.active || user.status === "banned" || user.plan !== "pro")
    throw new UpgradeQuoteError("INELIGIBLE");
  const termEndsAt = getEffectiveExpirationDate(user);
  if (!termEndsAt) throw new UpgradeQuoteError("NO_TERM");
  if (user.billingInterval === "year")
    throw new UpgradeQuoteError("INELIGIBLE");
  const interval = "month" as const;
  if (termEndsAt.getTime() <= now.getTime())
    throw new UpgradeQuoteError("EXPIRED");

  const termMonths = 1;
  const target = getPaidPlanRuntime("advance", interval)!;
  const source = getPaidPlanRuntime("pro", interval)!;
  const termStartsAt = getEffectiveUpgradeTermStart(user, termEndsAt);
  if (
    termStartsAt.getTime() >= termEndsAt.getTime() ||
    termStartsAt.getTime() > now.getTime()
  )
    throw new UpgradeQuoteError("NO_TERM");

  const remainingFraction = Math.max(
    0,
    Math.min(
      1,
      (termEndsAt.getTime() - now.getTime()) /
        (termEndsAt.getTime() - termStartsAt.getTime()),
    ),
  );
  const creditAmount =
    Math.round(source.amount * remainingFraction * 100) / 100;
  const amount = Math.max(
    0,
    Math.round((target.amount - creditAmount) * 100) / 100,
  );
  return {
    fromPlan: "pro" as const,
    planType: "advance" as const,
    billingInterval: interval,
    termMonths,
    monthlyLimit: target.limit,
    sourceTermPrice: source.amount,
    targetTermPrice: target.amount,
    remainingFraction,
    creditAmount,
    amount,
    currency: "INR" as const,
    termStartsAt,
    termEndsAt,
  };
}
