import { NextResponse } from "next/server";
import { authenticateWithGoogleCode } from "@/lib/auth/google";
import { createAuthorizationCode, getGoogleState } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("mcp_google_state="));
  const encodedState = cookie?.slice("mcp_google_state=".length);
  const state = encodedState
    ? getGoogleState(decodeURIComponent(encodedState))
    : null;
  const googleState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !googleState || state.nonce !== googleState || !code)
    return Response.json(
      { error: "Invalid Google OAuth state" },
      { status: 400 },
    );

  try {
    const callbackUri =
      process.env.MCP_GOOGLE_REDIRECT_URI ||
      `${url.origin}/oauth/google/callback`;
    const result = await authenticateWithGoogleCode(code, request, callbackUri);
    if (!result.ok)
      return Response.json(
        { error: result.message },
        { status: result.status },
      );
    const mcpCode = createAuthorizationCode({
      clientId: state.clientId,
      redirectUri: state.redirectUri,
      codeChallenge: state.codeChallenge,
      railkitApiKey: result.user.apiKey,
      email: result.user.email,
      name: result.user.name,
    });
    const target = new URL(state.redirectUri);
    target.searchParams.set("code", mcpCode);
    if (state.oauthState) target.searchParams.set("state", state.oauthState);
    const response = NextResponse.redirect(target);
    response.cookies.set("mcp_google_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return Response.json(
      { error: "Google authentication failed" },
      { status: 500 },
    );
  }
}
