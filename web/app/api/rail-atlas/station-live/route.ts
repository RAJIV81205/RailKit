import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase() || "";
  const hours = Number(request.nextUrl.searchParams.get("hours") || 4);

  if (!/^[A-Z0-9]{1,5}$/.test(code) || ![4, 8].includes(hours)) {
    return NextResponse.json({ success: false, error: "Invalid station code or time window." }, { status: 400 });
  }

  const apiKey = process.env.RAILKIT_API_KEY;
  const backendUrl = process.env.RAILKIT_PRODUCTION_BACKEND_URL || "https://api.railkit.in";
  if (!apiKey) {
    return NextResponse.json({ success: false, error: "RailKit API key is not configured on the server." }, { status: 503 });
  }

  try {
    const response = await fetch(`${backendUrl}/api/v1/stations/${code}/live?hrs=${hours}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: request.signal,
    });
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Production train service is unavailable." }, { status: 503 });
  }
}
