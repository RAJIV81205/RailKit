import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { routeAlongRailways } from "../../../../lib/rail-route";

export const dynamic = "force-dynamic";

type StationRecord = { code: string; name: string; lat: number | null; lon: number | null };
type TimelineItem = {
  type?: string;
  status?: string;
  stationCode?: string;
  stationName?: string;
  distanceKm?: string | number;
  arrival?: { scheduled?: string; actual?: string; delay?: string };
  departure?: { scheduled?: string; actual?: string; delay?: string };
};

let stationsPromise: Promise<Map<string, StationRecord>> | null = null;

async function getStations() {
  if (!stationsPromise) {
    stationsPromise = fs.readFile(path.join(process.cwd(), "public", "data", "india-stations.json"), "utf8")
      .then((source) => JSON.parse(source) as { stations: StationRecord[] })
      .then((payload) => new Map(payload.stations.map((station) => [station.code, station])));
  }
  return stationsPromise;
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}-${values.month}-${values.year}`;
}

function normalizeDate(value: string) {
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return todayInIndia();
  const months: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const month = months[match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()];
  return month ? `${match[1].padStart(2, "0")}-${month}-${match[3]}` : todayInIndia();
}

function bearing(from: [number, number], to: [number, number]) {
  const lat1 = from[0] * Math.PI / 180;
  const lat2 = to[0] * Math.PI / 180;
  const deltaLon = (to[1] - from[1]) * Math.PI / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export async function GET(request: NextRequest) {
  const trainNo = request.nextUrl.searchParams.get("trainNo")?.trim() || "";
  const date = normalizeDate(request.nextUrl.searchParams.get("date")?.trim() || "");
  if (!/^\d{5}$/.test(trainNo)) {
    return NextResponse.json({ success: false, error: "Train number must be exactly five digits." }, { status: 400 });
  }

  const apiKey = process.env.RAILKIT_API_KEY;
  const backendUrl = process.env.RAILKIT_PRODUCTION_BACKEND_URL || "https://api.railkit.in";
  if (!apiKey) return NextResponse.json({ success: false, error: "RailKit API key is not configured on the server." }, { status: 503 });

  try {
    const response = await fetch(`${backendUrl}/api/v1/trains/${trainNo}/live/${date}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: request.signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success || !payload?.data) {
      return NextResponse.json({ success: false, error: payload?.error || "Live train data is unavailable." }, { status: response.status || 502 });
    }

    const stations = await getStations();
    const timeline = (Array.isArray(payload.data.timeline) ? payload.data.timeline : []) as TimelineItem[];
    const mappedTimeline = timeline.map((item, index) => {
      const code = String(item.stationCode || "").toUpperCase();
      const station = stations.get(code);
      return station && Number.isFinite(station.lat) && Number.isFinite(station.lon)
        ? { ...item, index, stationCode: code, lat: station.lat as number, lon: station.lon as number }
        : null;
    }).filter(Boolean) as Array<TimelineItem & { index: number; stationCode: string; lat: number; lon: number }>;

    const routeWaypoints = mappedTimeline.filter((item, index) => item.type === "stoppage" || index === 0 || index === mappedTimeline.length - 1);
    const route = await routeAlongRailways(routeWaypoints.map((item) => [item.lat, item.lon]));
    const currentCode = String(payload.data.currentStationCode || "").toUpperCase();
    let currentIndex = mappedTimeline.findIndex((item) => item.stationCode === currentCode);
    if (currentIndex < 0) currentIndex = mappedTimeline.findIndex((item) => item.status === "current");
    if (currentIndex < 0 && mappedTimeline.length) currentIndex = payload.data.progress?.journeyStatus === "completed" ? mappedTimeline.length - 1 : 0;
    const current = currentIndex >= 0 ? mappedTimeline[currentIndex] : null;
    const directionTarget = currentIndex >= 0
      ? mappedTimeline[currentIndex + 1] || mappedTimeline[currentIndex - 1] || current
      : null;
    let routeBearing = current && directionTarget ? bearing([current.lat, current.lon], [directionTarget.lat, directionTarget.lon]) : 0;
    if (current && route.length > 1) {
      let nearestRouteIndex = 0;
      let nearestRouteDistance = Number.POSITIVE_INFINITY;
      route.forEach((point, index) => {
        const pointDistance = Math.hypot(point[0] - current.lat, point[1] - current.lon);
        if (pointDistance < nearestRouteDistance) {
          nearestRouteDistance = pointDistance;
          nearestRouteIndex = index;
        }
      });
      const nextRoutePoint = route[nearestRouteIndex + 1] || route[nearestRouteIndex - 1];
      if (nextRoutePoint) routeBearing = bearing(route[nearestRouteIndex], nextRoutePoint);
    }

    return NextResponse.json({
      success: true,
      data: {
        trainNo: payload.data.trainNo || trainNo,
        trainName: payload.data.trainName || "Train",
        date,
        statusNote: payload.data.statusNote || "Live position unavailable",
        lastUpdate: payload.data.lastUpdate || null,
        progress: payload.data.progress || null,
        start: mappedTimeline[0] || null,
        end: mappedTimeline.at(-1) || null,
        currentPosition: current ? {
          lat: current.lat,
          lon: current.lon,
          stationCode: current.stationCode,
          stationName: current.stationName || stations.get(current.stationCode)?.name || current.stationCode,
          bearing: routeBearing,
        } : null,
        route,
      },
    }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=30" } });
  } catch {
    return NextResponse.json({ success: false, error: "Production live-train service is unavailable." }, { status: 503 });
  }
}
