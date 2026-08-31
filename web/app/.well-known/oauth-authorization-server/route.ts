export const dynamic = "force-static";

export function GET() {
  return Response.json({
    issuer: "https://railkit.in",
    authorization_endpoint: "https://railkit.in/authorize",
    token_endpoint: "https://railkit.in/token",
    registration_endpoint: "https://railkit.in/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["railkit:read"],
  });
}
