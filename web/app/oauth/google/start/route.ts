import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createGoogleState, getClient, isAllowedRedirectUri } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

function redirectUri(request: Request) {
  return process.env.MCP_GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/oauth/google/callback`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") || "";
  const target = url.searchParams.get("redirect_uri") || "";
  const challenge = url.searchParams.get("code_challenge") || "";
  const responseType = url.searchParams.get("response_type") || "";
  const method = url.searchParams.get("code_challenge_method") || "";
  const oauthState = url.searchParams.get("state") || "";
  const client = getClient(clientId);
  if (responseType !== "code" || method !== "S256" || !challenge || !client || !isAllowedRedirectUri(target) || !client.redirectUris.includes(target)) return Response.json({ error: "invalid_request" }, { status: 400 });

  const nonce = crypto.randomBytes(32).toString("base64url");
  const state = createGoogleState({ nonce, clientId, redirectUri: target, codeChallenge: challenge, oauthState });
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state: nonce,
    prompt: "select_account",
  }).toString();
  const response = NextResponse.redirect(google);
  response.cookies.set("mcp_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
