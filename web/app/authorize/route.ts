import { createAuthorizationCode, getClient, isAllowedRedirectUri } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

function page(message = "") {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect RailKit</title><style>body{font:16px system-ui;max-width:460px;margin:12vh auto;padding:24px;background:#f7f7f8}main{background:white;padding:28px;border-radius:16px;box-shadow:0 4px 24px #0001}input,button{width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border:1px solid #ccc;border-radius:8px}button{background:#111;color:#fff;cursor:pointer}small{color:#666}.error{color:#b91c1c}</style></head><body><main><h1>Connect RailKit</h1><p>Enter RailKit API key to let ChatGPT read train data.</p>${message ? `<p class="error">${message}</p>` : ""}<form method="post"><label>RailKit API key<input name="railkit_api_key" type="password" required autocomplete="off"></label><input type="hidden" name="client_id" value="{{client_id}}"><input type="hidden" name="redirect_uri" value="{{redirect_uri}}"><input type="hidden" name="code_challenge" value="{{code_challenge}}"><input type="hidden" name="state" value="{{state}}"><button type="submit">Connect</button></form><small>Key is encrypted into a short-lived access token and never logged.</small></main></body></html>`;
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
  return html(page().replaceAll("{{client_id}}", attr(value.client_id)).replaceAll("{{redirect_uri}}", attr(value.redirect_uri)).replaceAll("{{code_challenge}}", attr(value.code_challenge)).replaceAll("{{state}}", attr(value.state)));
}

export async function POST(request: Request) {
  const form = await request.formData();
  const clientId = String(form.get("client_id") || "");
  const redirectUri = String(form.get("redirect_uri") || "");
  const challenge = String(form.get("code_challenge") || "");
  const state = String(form.get("state") || "");
  const apiKey = String(form.get("railkit_api_key") || "").trim();
  const client = getClient(clientId);
  if (!client || !isAllowedRedirectUri(redirectUri) || !client.redirectUris.includes(redirectUri) || !challenge || !apiKey || apiKey.length > 500) return html("Invalid authorization request", 400);
  const code = createAuthorizationCode({ clientId, redirectUri, codeChallenge: challenge, railkitApiKey: apiKey });
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
    },
  });
}
