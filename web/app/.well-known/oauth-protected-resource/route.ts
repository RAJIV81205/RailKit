export const dynamic = "force-static";

export function GET() {
  return Response.json({
    resource: "https://railkit.in/api/mcp",
    authorization_servers: ["https://railkit.in"],
    scopes_supported: ["openid", "email", "profile", "railkit:read"],
  });
}
