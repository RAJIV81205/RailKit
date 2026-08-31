import { getUserFromAccessToken } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export function GET(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const user = match?.[1] ? getUserFromAccessToken(match[1].trim()) : null;
  if (!user) {
    return Response.json(
      { error: "invalid_token", error_description: "A valid access token is required" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="railkit"' } },
    );
  }
  return Response.json(
    {
      sub: user.email,
      email: user.email,
      email_verified: true,
      name: user.name,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
