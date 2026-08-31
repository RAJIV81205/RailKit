import { createAccessToken, exchangeAuthorizationCode } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = new URLSearchParams(await request.text());
    if (body.get("grant_type") !== "authorization_code") return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    const apiKey = exchangeAuthorizationCode(String(body.get("code") || ""), String(body.get("client_id") || ""), String(body.get("redirect_uri") || ""), String(body.get("code_verifier") || ""));
    if (!apiKey) return Response.json({ error: "invalid_grant" }, { status: 400 });
    return Response.json({ access_token: createAccessToken(apiKey), token_type: "Bearer", expires_in: 30 * 24 * 60 * 60, scope: "railkit:read" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
}
