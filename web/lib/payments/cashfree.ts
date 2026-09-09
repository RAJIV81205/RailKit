import { Cashfree, CFEnvironment } from "cashfree-pg";

const envName = process.env.CASHFREE_ENVIRONMENT?.toLowerCase();
if (envName !== "sandbox" && envName !== "production") {
  throw new Error("CASHFREE_ENVIRONMENT must be explicitly set to sandbox or production");
}
const isSandbox = envName === "sandbox";

const clientId = isSandbox
  ? process.env.CASHFREE_CLIENT_TEST_ID || process.env.CASHFREE_CLIENT_ID
  : process.env.CASHFREE_CLIENT_ID;
const clientSecret = isSandbox
  ? process.env.CASHFREE_CLIENT_TEST_SECRET || process.env.CASHFREE_CLIENT_SECRET
  : process.env.CASHFREE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error(
    isSandbox
      ? "CASHFREE_CLIENT_TEST_ID and CASHFREE_CLIENT_TEST_SECRET are required for sandbox"
      : "CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET are required"
  );
}

const environment = isSandbox ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;

export const cashfree = new Cashfree(environment, clientId, clientSecret);

export function getCashfreeCheckoutMode() {
  return isSandbox ? "sandbox" : "production";
}

export function getWebhookUrl() {
  const directWebhookUrl = process.env.PAYMENT_WEBHOOK_URL;
  if (directWebhookUrl) {
    return directWebhookUrl;
  }

  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    throw new Error("Set PAYMENT_WEBHOOK_URL or APP_BASE_URL");
  }

  return `${appBaseUrl.replace(/\/$/, "")}/api/payment/cashfree-webhook`;
}

export function getAppReturnUrl() {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is required");
  }

  return `${appBaseUrl.replace(/\/$/, "")}/pricing?payment_return=1&order_id={order_id}`;
}

export function getExternalOrderDataUrl() {
  return (
    process.env.PAYMENT_ORDER_DATA_URL ||
    "https://rapidbite.rajivdubey.tech/railkit/orderData"
  );
}
