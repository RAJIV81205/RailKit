import { createClientId, isAllowedRedirectUri } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { redirect_uris?: unknown; client_name?: string };
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((value): value is string => typeof value === "string") : [];
    if (!redirectUris.length || redirectUris.length > 10 || redirectUris.some((uri) => uri.length > 500 || !isAllowedRedirectUri(uri))) {
      return Response.json({ error: "invalid_client_metadata", error_description: "redirect_uris required" }, { status: 400 });
    }
    const clientName = typeof body.client_name === "string" ? body.client_name.trim().slice(0, 100) : "MCP client";
    const clientId = createClientId(redirectUris);
    return Response.json({
      client_id: clientId,
      client_name: clientName || "MCP client",
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }, { status: 201 });
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
}
