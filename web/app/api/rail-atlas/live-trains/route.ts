import { NextRequest, NextResponse } from "next/server";
import { rejectNonFirstPartyRequest } from "@/lib/rail-atlas-origin";
import { rejectMissingRailAtlasAccess } from "@/lib/rail-atlas-token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const originError = rejectNonFirstPartyRequest(request);
  if (originError) return originError;
  const accessError = rejectMissingRailAtlasAccess(request);
  if (accessError) return accessError;

  const apiKey = process.env.RAILKIT_API_KEY;
  const backendUrl =  "https://api.railkit.in" ;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "RailKit API key is not configured on the server." }, { status: 503 });
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1/trains/live-map`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: request.signal,
    });
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Live train map is unavailable." }, { status: 503 });
  }
}
