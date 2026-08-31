import { getRailkitKeyFromAccessToken } from "@/lib/mcp/oauth";

export function getRailkitApiKey(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1].trim();
  if (!token) return null;
  return token.startsWith("mcp_") ? getRailkitKeyFromAccessToken(token) : token;
}
