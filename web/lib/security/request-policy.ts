type RequestLike = Pick<Request, "url" | "method" | "headers">;

type Rejection = { status: number; message: string };

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SERVER_CALLBACKS = new Set([
  "/api/payment/cashfree-webhook",
  "/api/webhooks/email",
  "/api/cron/check-plans",
]);

export function getApiRequestRejection(request: RequestLike): Rejection | null {
  const url = new URL(request.url);
  if (url.search.length > 2048) {
    return { status: 414, message: "Request URL is too long" };
  }

  if (!WRITE_METHODS.has(request.method.toUpperCase())) return null;

  const maxBodyBytes = url.pathname === "/api/admin/email" || SERVER_CALLBACKS.has(url.pathname)
    ? 256 * 1024
    : 64 * 1024;
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader !== null) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0) {
      return { status: 400, message: "Invalid Content-Length" };
    }
    if (length > maxBodyBytes) {
      return { status: 413, message: "Request body is too large" };
    }
  }

  // Webhook providers and the scheduled job authenticate with their own secrets.
  if (SERVER_CALLBACKS.has(url.pathname)) return null;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { status: 403, message: "Cross-site request blocked" };
  }
  if (origin ? origin !== url.origin : fetchSite !== "same-origin") {
    return { status: 403, message: "Same-origin request required" };
  }

  return null;
}
