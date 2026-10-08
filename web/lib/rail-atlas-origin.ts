import { NextRequest, NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Blocks cross-origin browser calls to the public-facing Rail Atlas proxy routes. */
export function rejectNonFirstPartyRequest(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const productionOrigin = new URL(getSiteUrl()).origin;
  const isLocalDevelopment = process.env.NODE_ENV !== "production"
    && requestUrl.protocol === "http:"
    && isLoopback(requestUrl.hostname);
  const isServedFromSite = requestOrigin === productionOrigin || isLocalDevelopment;
  const originMatchesRequest = origin ? origin === requestOrigin : fetchSite === "same-origin";
  const fetchIsSameOrigin = !fetchSite || fetchSite === "same-origin";

  if (!isServedFromSite || !originMatchesRequest || !fetchIsSameOrigin) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return null;
}
