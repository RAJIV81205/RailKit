import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SearchPayload = {
  success: boolean;
  data?: {
    stations?: Array<{ code: string; name: string; lat: number | null; lon: number | null }>;
    trains?: Array<{ trainNo: string; trainName: string }>;
    trainNo?: string;
    trainName?: string;
  };
  error?: string;
};

async function searchApi(url: string, apiKey: string): Promise<SearchPayload> {
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
    next: { revalidate: 60 },
  });
  const payload = await response.json() as SearchPayload;
  if (!response.ok || !payload.success) throw new Error(payload.error || "Search service unavailable.");
  return payload;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ success: true, data: { query, stations: [], trains: [] } });
  }

  const apiKey = process.env.RAILKIT_API_KEY;
  const backendUrl = process.env.RAILKIT_PRODUCTION_BACKEND_URL || "https://api.railkit.in";
  if (!apiKey) return NextResponse.json({ success: false, error: "RailKit API key is not configured on the server." }, { status: 503 });

  try {
    const encoded = encodeURIComponent(query);
    const isNumberQuery = /^\d{2,5}$/.test(query);
    const trainSearch = isNumberQuery
      ? searchApi(`${backendUrl}/api/v1/trains/${encoded}`, apiKey)
      : /^[a-zA-Z ]+$/.test(query)
        ? searchApi(`${backendUrl}/api/v1/trains/search?name=${encoded}`, apiKey)
        : Promise.resolve({ success: false } as SearchPayload);
    const [stationResult, trainResult] = await Promise.all([
      searchApi(`${backendUrl}/api/v1/stations/search?name=${encoded}`, apiKey),
      trainSearch,
    ]);
    return NextResponse.json({
      success: true,
      data: {
        query,
        stations: (stationResult.data?.stations || []).slice(0, 5),
        trains: (trainResult.data?.trains || []).slice(0, 10),
      },
    }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Search service unavailable." }, { status: 502 });
  }
}
