import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getRailkitApiKey } from "@/lib/mcp/auth";
import { createRailkitMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Bearer resource_metadata="https://railkit.in/.well-known/oauth-protected-resource"',
    },
  });
}

async function handler(request: Request) {
  const railkitApiKey = getRailkitApiKey(request);
  if (!railkitApiKey) return unauthorized();
  if (
    request.method === "GET" &&
    !request.headers.get("accept")?.includes("text/event-stream")
  ) {
    return Response.json(
      { error: "MCP GET requires text/event-stream" },
      { status: 405 },
    );
  }

  try {
    const server = createRailkitMcpServer(railkitApiKey);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    console.error(
      "MCP request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json({ error: "MCP request failed" }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
