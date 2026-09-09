import { createHash } from "crypto";

const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

export type PaymentVerificationInput = {
  expectedAmount: number;
  expectedCurrency: string;
  expectedCustomerId: string;
  paymentStatus?: string | null;
  transactionReference?: string | null;
  orderAmount?: number | null;
  orderCurrency?: string | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  customerId?: string | null;
};

function toMinorUnits(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function normalizedCurrency(value?: string | null) {
  return value?.trim().toUpperCase() || null;
}

export function isSuccessfulPaymentStatus(status?: string | null) {
  return status?.trim().toUpperCase() === "SUCCESS";
}

export function getCashfreeIdempotencyKey(orderId: string) {
  const hash = createHash("sha256").update(orderId).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
}

export function validateSuccessfulPayment(input: PaymentVerificationInput) {
  if (!isSuccessfulPaymentStatus(input.paymentStatus)) {
    return { valid: false as const, reason: "payment is not successful" };
  }

  if (!input.transactionReference?.trim()) {
    return { valid: false as const, reason: "payment reference is missing" };
  }

  const expectedAmount = toMinorUnits(input.expectedAmount);
  const orderAmount = toMinorUnits(Number(input.orderAmount));
  const paymentAmount = toMinorUnits(Number(input.paymentAmount));
  if (
    expectedAmount === null ||
    orderAmount === null ||
    paymentAmount === null ||
    expectedAmount !== orderAmount ||
    expectedAmount !== paymentAmount
  ) {
    return { valid: false as const, reason: "payment amount does not match the order" };
  }

  const expectedCurrency = normalizedCurrency(input.expectedCurrency);
  if (
    !expectedCurrency ||
    normalizedCurrency(input.orderCurrency) !== expectedCurrency ||
    normalizedCurrency(input.paymentCurrency) !== expectedCurrency
  ) {
    return { valid: false as const, reason: "payment currency does not match the order" };
  }

  if (!input.customerId || input.customerId !== input.expectedCustomerId) {
    return { valid: false as const, reason: "payment customer does not match the order" };
  }

  return { valid: true as const };
}

export function validateWebhookTimestamp(timestamp: string, now = Date.now()) {
  if (!/^\d{10,16}$/.test(timestamp)) return false;
  const raw = Number(timestamp);
  if (!Number.isFinite(raw)) return false;
  const timestampMs = timestamp.length <= 10 ? raw * 1000 : raw;
  return Math.abs(now - timestampMs) <= WEBHOOK_MAX_AGE_MS;
}

export function normalizeNonSuccessfulOrderStatus(status?: string | null) {
  const normalized = status?.trim().toUpperCase();
  if (normalized === "EXPIRED") return "expired" as const;
  if (
    normalized === "TERMINATED" ||
    normalized === "CANCELLED" ||
    normalized === "USER_DROPPED"
  ) {
    return "cancelled" as const;
  }
  if (normalized === "FAILED") return "failed" as const;
  if (normalized === "ACTIVE") return "active" as const;
  return "created" as const;
}
