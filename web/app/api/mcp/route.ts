import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getRailkitApiKey } from "@/lib/mcp/auth";
import { createRailkitMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    return await transport.handleRequest(request);
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
