import { getClient, isAllowedRedirectUri } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

function page() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect RailKit</title><style>body{font:16px system-ui;max-width:460px;margin:12vh auto;padding:24px;background:#f7f7f8}main{background:white;padding:28px;border-radius:16px;box-shadow:0 4px 24px #0001}a{display:block;text-align:center;background:#111;color:#fff;text-decoration:none;padding:12px;border-radius:8px;margin-top:24px}small{color:#666;display:block;margin-top:14px}.error{color:#b91c1c}</style></head><body><main><h1>Connect RailKit</h1><p>Sign in with Google to let ChatGPT read your RailKit data.</p><a href="{{google_url}}">Continue with Google</a><small>Your stored RailKit API key stays server-side and is never shown to ChatGPT.</small></main></body></html>`;
}

function html(body: string, status = 200) {
  return new Response(body, { status, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    // Redirect URI is validated as HTTPS (or loopback HTTP) before use below.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost http://127.0.0.1; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  } });
}

function values(url: URL) {
  return Object.fromEntries(["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope"].map((key) => [key, url.searchParams.get(key) || ""]));
}

function attr(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const value = values(url);
  const client = getClient(value.client_id);
  if (value.response_type !== "code" || !client || !isAllowedRedirectUri(value.redirect_uri) || !client.redirectUris.includes(value.redirect_uri) || !value.code_challenge || value.code_challenge_method !== "S256") return html("Invalid OAuth request", 400);
  const googleUrl = new URL("/oauth/google/start", url.origin);
  for (const [key, val] of Object.entries(value)) googleUrl.searchParams.set(key, val);
  return html(page().replaceAll("{{google_url}}", attr(googleUrl.toString())));
}
