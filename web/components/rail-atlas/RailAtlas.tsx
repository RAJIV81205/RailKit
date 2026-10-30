"use client";

import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CircleMarker,
  Layer,
  LayerGroup,
  Map as LeafletMap,
  LeafletMouseEvent,
} from "leaflet";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  Check,
  ChevronDown,
  Clock3,
  Focus,
  House,
  Layers3,
  ListFilter,
  Minus,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  TrainFront,
  X,
} from "lucide-react";

type Station = {
  code: string;
  name: string;
  lat: number;
  lon: number;
};

type StationRecord = {
  code: string;
  name: string;
  lat: number | null;
  lon: number | null;
};

type StationCatalog = {
  totalStations: number;
  updatedAtIST: string | null;
  stations: StationRecord[];
};

type StationTrain = {
  trainNo: string;
  trainName: string;
  source: string;
  sourceName: string;
  dest: string;
  destName: string;
  trainType: string;
  classes: string;
  runDate: string;
  platform: string;
  cancelled: string | boolean | null;
  arrival: {
    actual: string;
    scheduled: string;
    delay: string;
    delayed?: boolean;
  };
  departure: {
    actual: string;
    scheduled: string;
    delay: string;
    delayed?: boolean;
  };
};

type StationBoard = {
  summary: string;
  totalTrains: number;
  trains: StationTrain[];
};

type StationBoardResponse = {
  success: boolean;
  data?: StationBoard;
  error?: string;
};

type GlobalSearchResult = {
  stations: Array<{
    code: string;
    name: string;
    lat: number | null;
    lon: number | null;
  }>;
  trains: Array<{ trainNo: string; trainName: string }>;
};

type GlobalSearchResponse = {
  success: boolean;
  data?: GlobalSearchResult;
  error?: string;
};

type TrainSelection = { trainNo: string; trainName: string; date?: string };

type LiveMapTrain = {
  trainNo: string;
  journeyDate: string;
  trainName: string;
  trainType: string;
  currentStation: { code: string; name: string; lat?: number; lon?: number };
  upcomingStation: { code: string | null; name: string | null };
};

type MappedLiveMapTrain = LiveMapTrain & {
  currentStation: LiveMapTrain["currentStation"] & { lat: number; lon: number };
};

function hasMappedPosition(train: LiveMapTrain): train is MappedLiveMapTrain {
  return (
    Number.isFinite(train.currentStation?.lat) &&
    Number.isFinite(train.currentStation?.lon)
  );
}

const LIVE_TRAIN_CATEGORIES = [
  { id: "vandeBharat", label: "Vande Bharat", color: "#fb923c" },
  {
    id: "rajdhaniDuronto",
    label: "Rajdhani / Duronto / Shatabdi",
    color: "#fb7185",
  },
  { id: "tourist", label: "Tourist Trains", color: "#6366f1" },
  { id: "tejas", label: "Tejas", color: "#ef4444" },
  { id: "namoBharat", label: "Namo Bharat", color: "#06b6d4" },
  { id: "superfast", label: "Superfast Express", color: "#60a5fa" },
  { id: "amritBharat", label: "Amrit Bharat", color: "#a855f7" },
  { id: "expressMail", label: "Express / Mail", color: "#2dd4bf" },
  { id: "garibRathHumsafar", label: "Garib Rath / Humsafar", color: "#f87171" },
  { id: "janShatabdi", label: "Jan Shatabdi", color: "#f472b6" },
  { id: "suburbanEmu", label: "Suburban / EMU", color: "#4ade80" },
  { id: "passenger", label: "Passenger", color: "#facc15" },
  { id: "special", label: "Special Trains", color: "#e879f9" },
  { id: "other", label: "Other", color: "#cbd5e1" },
] as const;

type LiveTrainCategory = (typeof LIVE_TRAIN_CATEGORIES)[number]["id"];
const ALL_LIVE_TRAIN_CATEGORIES = LIVE_TRAIN_CATEGORIES.map(
  (category) => category.id,
);

function liveTrainCategory(trainType: string): LiveTrainCategory {
  const type = trainType.toUpperCase();
  if (type.includes("AMRIT BHARAT")) return "amritBharat";
  if (type.includes("VANDE BHARAT")) return "vandeBharat";
  if (type.includes("JAN SHATABDI")) return "janShatabdi";
  if (/RAJDHANI|DURONTO|SHATABDI/.test(type)) return "rajdhaniDuronto";
  if (type.includes("TOURIST TRAIN")) return "tourist";
  if (type.includes("TEJAS")) return "tejas";
  if (type.includes("NAMO BHARAT")) return "namoBharat";
  if (/GARIB RATH|HUMSAFAR/.test(type)) return "garibRathHumsafar";
  if (type.includes("SUPERFAST")) return "superfast";
  if (/SUBURBAN|MEMU|\bEMU\b|\bDMU\b/.test(type)) return "suburbanEmu";
  if (type.includes("PASSENGER")) return "passenger";
  if (/SPECIAL|TRAIN ON DEMAND/.test(type)) return "special";
  if (/EXPRESS|MAIL/.test(type)) return "expressMail";
  return "other";
}

function liveTrainCategoryColor(trainType: string) {
  const category = liveTrainCategory(trainType);
  return LIVE_TRAIN_CATEGORIES.find((item) => item.id === category)?.color || "#cbd5e1";
}

function createLiveTrainIcon(color: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const context = canvas.getContext("2d")!;
  context.beginPath();
  context.moveTo(12, 3);
  context.lineTo(17, 18);
  context.lineTo(12, 15);
  context.lineTo(7, 18);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  return context.getImageData(0, 0, 24, 24);
}

type LiveMapResponse = {
  success: boolean;
  data?: {
    stale: boolean;
    lastSweepAt: string | null;
    count: number;
    mappedCount: number;
    trains: LiveMapTrain[];
  };
  error?: string;
};

type TrainTimelineItem = {
  index: number;
  type?: string;
  status?: string;
  stationCode: string;
  stationName?: string;
  lat?: number;
  lon?: number;
  platform?: string;
  distanceKm?: string | number;
  arrival?: { scheduled?: string; actual?: string; delay?: string };
  departure?: { scheduled?: string; actual?: string; delay?: string };
};

type TrainLiveData = {
  trainNo: string;
  trainName: string;
  date: string;
  statusNote: string;
  lastUpdate: string | null;
  progress: {
    journeyStatus: string;
    percent: number;
    currentStationIndex?: number | null;
    totalStations?: number;
    passedStations?: number;
    remainingStations: number;
    currentDistanceKm?: number | null;
    distanceRemainingKm: number | null;
  } | null;
  totalDistanceKm: number | null;
  averageSpeedKmph: number | null;
  start: {
    stationCode: string;
    stationName?: string;
    lat: number;
    lon: number;
  } | null;
  end: {
    stationCode: string;
    stationName?: string;
    lat: number;
    lon: number;
  } | null;
  currentPosition: {
    lat: number;
    lon: number;
    stationCode: string;
    stationName: string;
    bearing: number;
  } | null;
  route: [number, number][];
  timeline: TrainTimelineItem[];
  coachPosition?: TrainCoachPosition[];
  coachPositionTimeline?: Array<{
    stationCode?: string;
    stationName?: string;
    coachPosition: TrainCoachPosition[];
  }>;
};

type TrainCoachPosition = {
  type?: string;
  number?: string;
  position?: string;
  id?: string;
  operatedBy?: string;
  coachType?: string;
  coachNo?: string;
  manufacturedIn?: number | null;
  coachClass?: string;
  variant?: string;
};

type TrainLiveResponse = {
  success: boolean;
  data?: TrainLiveData;
  error?: string;
};

type TrainScheduleGroup = {
  key: string;
  stop: TrainTimelineItem;
  intermediates: TrainTimelineItem[];
  nextStop?: TrainTimelineItem;
};

type TurnstileWidget = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: "invisible";
      execution: "execute";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

function groupTrainSchedule(timeline: TrainTimelineItem[]) {
  const groups: TrainScheduleGroup[] = [];
  for (const item of timeline) {
    if (item.type === "intermediate") {
      groups.at(-1)?.intermediates.push(item);
      continue;
    }
    groups.push({ key: String(item.index), stop: item, intermediates: [] });
  }
  return groups.map((group, index) => ({
    ...group,
    key: `${group.stop.index}-${groups[index + 1]?.stop.index ?? "end"}`,
    nextStop: groups[index + 1]?.stop,
  }));
}

function formatScheduleTime(value?: string) {
  const normalized = String(value || "").trim();
  const status = normalized.replace(/\*/g, "").trim().toUpperCase();
  if (
    !normalized ||
    ["SRC", "DSTN", "UA", "NA", "N/A", "UNAVAILABLE"].includes(status)
  )
    return "--";
  return normalized.match(/\b\d{1,2}:\d{2}\b/)?.[0] || normalized;
}

function isActualTimeLate(actual: string, scheduled: string) {
  const actualMatch = actual.match(/^(\d{1,2}):(\d{2})$/);
  const scheduledMatch = scheduled.match(/^(\d{1,2}):(\d{2})$/);
  if (!actualMatch || !scheduledMatch) return false;
  const actualMinutes = Number(actualMatch[1]) * 60 + Number(actualMatch[2]);
  const scheduledMinutes = Number(scheduledMatch[1]) * 60 + Number(scheduledMatch[2]);
  let difference = actualMinutes - scheduledMinutes;
  if (difference > 12 * 60) difference -= 24 * 60;
  if (difference < -12 * 60) difference += 24 * 60;
  return difference > 0;
}

function StationBoardTime({
  time,
  cancelled,
}: {
  time: StationTrain["arrival"];
  cancelled: boolean;
}) {
  const scheduled = formatScheduleTime(time?.scheduled);
  const actual = formatScheduleTime(time?.actual);
  if (cancelled)
    return <strong className="font-site-code text-sm text-slate-500">—</strong>;

  const delayed =
    time?.delayed === true &&
    scheduled !== "--" &&
    actual !== "--" &&
    scheduled !== actual;
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 font-site-code text-sm leading-5">
      {delayed ? (
        <span className="sr-only">
          Scheduled {scheduled}, actual {actual}
        </span>
      ) : null}
      {delayed ? (
        <span
          className="text-xs text-slate-500 line-through decoration-slate-500"
          aria-hidden="true"
        >
          {scheduled}
        </span>
      ) : null}
      <strong
        className={delayed ? "text-red-700" : "text-slate-900"}
        aria-hidden={delayed || undefined}
      >
        {actual !== "--" ? actual : scheduled}
      </strong>
    </span>
  );
}

function isCancelledScheduleValue(value?: string) {
  return /^cancel(?:led)?$/i.test(String(value || "").trim());
}

function isCancelledScheduleStop(stop: TrainTimelineItem) {
  return (
    /cancel/i.test(String(stop.status || "")) ||
    isCancelledScheduleValue(stop.arrival?.actual) ||
    isCancelledScheduleValue(stop.departure?.actual)
  );
}

function renewRailAtlasSessionOnUnauthorized(response: Response) {
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("rail-atlas:session-expired"));
  }
}

const INDIA_MAP_BOUNDS: [[number, number], [number, number]] = [
  [6.754256, 68.186249],
  [37.077615, 97.415161],
];

function getStationMarkerRadius(zoom: number) {
  return 1.2;
}

function isMappedStation(station: StationRecord): station is Station {
  return (
    Number.isFinite(station.lat) &&
    Number.isFinite(station.lon) &&
    station.lat! >= 6 &&
    station.lat! <= 38 &&
    station.lon! >= 68 &&
    station.lon! <= 98
  );
}

const STATION_GRID_CELL = 0.25;

function stationGridKey(lat: number, lon: number) {
  return `${Math.floor(lat / STATION_GRID_CELL)}:${Math.floor(lon / STATION_GRID_CELL)}`;
}

function indexStations(stations: Station[]) {
  const grid = new Map<string, Station[]>();
  for (const station of stations) {
    const key = stationGridKey(station.lat, station.lon);
    const bucket = grid.get(key);
    if (bucket) bucket.push(station);
    else grid.set(key, [station]);
  }
  return grid;
}

function stationsInBounds(
  grid: Map<string, Station[]>,
  south: number,
  west: number,
  north: number,
  east: number,
) {
  const matches: Station[] = [];
  const minLat = Math.floor(south / STATION_GRID_CELL);
  const maxLat = Math.floor(north / STATION_GRID_CELL);
  const minLon = Math.floor(west / STATION_GRID_CELL);
  const maxLon = Math.floor(east / STATION_GRID_CELL);
  for (let lat = minLat; lat <= maxLat; lat += 1) {
    for (let lon = minLon; lon <= maxLon; lon += 1) {
      for (const station of grid.get(`${lat}:${lon}`) || []) {
        if (
          station.lat >= south &&
          station.lat <= north &&
          station.lon >= west &&
          station.lon <= east
        )
          matches.push(station);
      }
    }
  }
  return matches;
}

function getStraightTrainRoute(data: TrainLiveData): [number, number][] {
  const stops = data.timeline
    .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon))
    .map((stop) => ({
      stationCode: stop.stationCode,
      point: [stop.lat!, stop.lon!] as [number, number],
    }));

  if (data.start && stops[0]?.stationCode !== data.start.stationCode) {
    stops.unshift({
      stationCode: data.start.stationCode,
      point: [data.start.lat, data.start.lon],
    });
  }
  if (data.end && stops.at(-1)?.stationCode !== data.end.stationCode) {
    stops.push({
      stationCode: data.end.stationCode,
      point: [data.end.lat, data.end.lon],
    });
  }

  return stops.reduce<[number, number][]>((route, stop) => {
    const previous = route.at(-1);
    if (
      !previous ||
      previous[0] !== stop.point[0] ||
      previous[1] !== stop.point[1]
    )
      route.push(stop.point);
    return route;
  }, []);
}

function focusTrainOnMap(map: LeafletMap, lat: number, lon: number) {
  const zoom = 8;
  const point = map.project([lat, lon], zoom);
  const center =
    window.innerWidth >= 1024
      ? map.unproject(
          point.subtract([Math.min(210, map.getSize().x * 0.2), 0]),
          zoom,
        )
      : map.unproject(point.add([0, map.getSize().y * 0.28]), zoom);
  map.flyTo(center, zoom, { duration: 0.65 });
}

function focusTrainRouteOnMap(map: LeafletMap, route: [number, number][]) {
  if (route.length < 2) {
    if (route.length === 1) focusTrainOnMap(map, route[0][0], route[0][1]);
    return;
  }
  const desktop = window.innerWidth >= 1024;
  const mobilePanelHeight = desktop ? 0 : Math.round(map.getSize().y * 0.68);
  map.fitBounds(route, {
    paddingTopLeft: desktop ? [420, 72] : [28, 48],
    paddingBottomRight: desktop ? [48, 72] : [28, mobilePanelHeight + 32],
    maxZoom: 8,
    animate: true,
    duration: 0.65,
  });
}

function useRailAtlasAccess(scriptReady: boolean) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    let disposed = false;
    let requesting = false;
    let challengeRunning = false;
    let widgetId: string | null = null;
    let renewalTimer: number | undefined;
    let sessionExpiresAt = 0;

    const isLocalDevelopment =
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const turnstileEnabled = Boolean(siteKey) && !isLocalDevelopment;

    const startChallenge = () => {
      if (!widgetId || !window.turnstile) return;
      window.turnstile.reset(widgetId);
      window.turnstile.execute(widgetId);
    };

    const requestAccess = async (turnstileToken?: string) => {
      if (requesting || disposed) return;
      requesting = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch("/api/rail-atlas/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(turnstileToken ? { turnstileToken } : {}),
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          success?: boolean;
          error?: string;
        };
        if (!response.ok || !payload.success)
          throw new Error(payload.error || "Rail Atlas security check failed.");
        if (disposed) return;
        setError("");
        setReady(true);
        sessionExpiresAt = Date.now() + 5 * 60 * 1000;
        window.clearTimeout(renewalTimer);
        renewalTimer = window.setTimeout(renewAccess, 4 * 60 * 1000);
      } catch (reason) {
        if (!disposed) {
          setReady(false);
          setError(
            controller.signal.aborted
              ? "Rail Atlas session refresh timed out. Please retry."
              : reason instanceof Error
                ? reason.message
                : "Rail Atlas security check failed.",
          );
        }
      } finally {
        window.clearTimeout(timeout);
        requesting = false;
        challengeRunning = false;
      }
    };

    const renewAccess = () => {
      if (disposed) return;
      setReady(false);
      if (turnstileEnabled) {
        if (challengeRunning) return;
        challengeRunning = true;
        startChallenge();
      } else {
        void requestAccess();
      }
    };

    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() >= sessionExpiresAt - 60_000
      )
        renewAccess();
    };
    const onSessionExpired = () => renewAccess();
    const turnstile = window.turnstile;
    const container = containerRef.current;
    if (turnstileEnabled && (!scriptReady || !container || !turnstile)) return;
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("rail-atlas:session-expired", onSessionExpired);

    if (!turnstileEnabled) {
      void requestAccess();
      return () => {
        disposed = true;
        window.clearTimeout(renewalTimer);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener(
          "rail-atlas:session-expired",
          onSessionExpired,
        );
      };
    }

    widgetId = turnstile!.render(container!, {
      sitekey: siteKey!,
      action: "rail_atlas_access",
      size: "invisible",
      execution: "execute",
      callback: (token) => {
        void requestAccess(token);
      },
      "error-callback": () =>
        setError("Security check failed to load. Please reload the page."),
      "expired-callback": () =>
        setError("Security check expired. Please reload the page."),
    });
    startChallenge();

    return () => {
      disposed = true;
      window.clearTimeout(renewalTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(
        "rail-atlas:session-expired",
        onSessionExpired,
      );
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [scriptReady, siteKey]);

  return { ready, error, containerRef };
}

function useStationBoard(station: Station | null, accessReady: boolean) {
  const [board, setBoard] = useState<StationBoard | null>(null);
  const [hours, setHours] = useState<4 | 8>(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!station || !accessReady) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      setBoard(null);
      setHours(4);
    });

    const fetchBoard = async (windowHours: 4 | 8) => {
      const response = await fetch(
        `/api/rail-atlas/station-live?code=${encodeURIComponent(station.code)}&hours=${windowHours}`,
        {
          cache: "no-store",
          signal: controller.signal,
        },
      );
      renewRailAtlasSessionOnUnauthorized(response);
      const payload = (await response.json()) as StationBoardResponse;
      if (!response.ok || !payload.success || !payload.data)
        throw new Error(payload.error || "Upcoming trains are unavailable.");
      return payload.data;
    };

    fetchBoard(4)
      .then((fourHourBoard) => {
        if (fourHourBoard.trains.length > 0) {
          setBoard(fourHourBoard);
          return;
        }
        return fetchBoard(8).then((eightHourBoard) => {
          if (controller.signal.aborted) return;
          setHours(8);
          setBoard(eightHourBoard);
        });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Upcoming trains are unavailable.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accessReady, refresh, station]);

  return {
    board,
    hours,
    loading,
    error,
    retry: () => setRefresh((value) => value + 1),
  };
}

function useGlobalSearch(query: string, accessReady: boolean) {
  const [results, setResults] = useState<GlobalSearchResult>({
    stations: [],
    trains: [],
  });
  const [loading, setLoading] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      const clearTimer = window.setTimeout(() => {
        setResults({ stations: [], trains: [] });
        setLoading(false);
        setResolvedQuery("");
        setError("");
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }
    if (!accessReady) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/rail-atlas/search?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          renewRailAtlasSessionOnUnauthorized(response);
          const payload = (await response.json()) as GlobalSearchResponse;
          if (!response.ok || !payload.success || !payload.data)
            throw new Error(payload.error || "Search is unavailable.");
          return payload.data;
        })
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data);
            setResolvedQuery(value);
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setResults({ stations: [], trains: [] });
            setError(
              reason instanceof Error
                ? reason.message
                : "Search is unavailable.",
            );
            setResolvedQuery(value);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [accessReady, query]);

  return {
    results,
    loading:
      query.trim().length >= 2 && (loading || resolvedQuery !== query.trim()),
    error,
  };
}

function useTrainLive(selection: TrainSelection | null, accessReady: boolean) {
  const [data, setData] = useState<TrainLiveData | null>(null);
  const [dataKey, setDataKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [refreshRequest, setRefreshRequest] = useState(0);
  const trainNo = selection?.trainNo ?? "";
  const date = selection?.date ?? "";
  const selectionKey = `${trainNo}:${date}`;
  const latestDataRef = useRef<{ key: string; data: TrainLiveData | null }>({
    key: "",
    data: null,
  });
  latestDataRef.current = { key: dataKey, data };

  useEffect(() => {
    if (!trainNo) {
      setData(null);
      setDataKey("");
      setLoading(false);
      setRefreshing(false);
      setError("");
      setRefreshError("");
      return;
    }
    if (!accessReady) {
      setLoading(
        !(
          latestDataRef.current.key === selectionKey &&
          latestDataRef.current.data
        ),
      );
      return;
    }

    let disposed = false;
    let inFlight = false;
    let pollTimer = 0;
    let activeController: AbortController | null = null;
    const hasCurrentData = () =>
      latestDataRef.current.key === selectionKey &&
      Boolean(latestDataRef.current.data);
    setLoading(!hasCurrentData());
    setRefreshing(hasCurrentData());
    setError("");
    setRefreshError("");

    const fetchLatest = async () => {
      if (disposed || inFlight || document.visibilityState !== "visible")
        return;
      inFlight = true;
      activeController = new AbortController();
      const controller = activeController;
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      if (hasCurrentData()) setRefreshing(true);
      try {
        const params = new URLSearchParams({ trainNo });
        if (date) params.set("date", date);
        const response = await fetch(`/api/rail-atlas/train-live?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        renewRailAtlasSessionOnUnauthorized(response);
        const payload = (await response.json()) as TrainLiveResponse;
        if (!response.ok || !payload.success || !payload.data)
          throw new Error(payload.error || "Live train data is unavailable.");
        if (disposed) return;
        setData(payload.data);
        setDataKey(selectionKey);
        latestDataRef.current = { key: selectionKey, data: payload.data };
        setError("");
        setRefreshError("");
      } catch (reason) {
        if (!disposed && !controller.signal.aborted) {
          const message =
            reason instanceof Error
              ? reason.message
              : "Live train data is unavailable.";
          if (hasCurrentData()) setRefreshError(message);
          else setError(message);
        } else if (!disposed && controller.signal.aborted) {
          const message =
            "Live train refresh timed out. Check your connection and retry.";
          if (hasCurrentData()) setRefreshError(message);
          else setError(message);
        }
      } finally {
        window.clearTimeout(timeout);
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed) {
          setLoading(false);
          setRefreshing(false);
          pollTimer = window.setTimeout(() => {
            void fetchLatest();
          }, 60_000);
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(pollTimer);
        void fetchLatest();
      }
    };
    const onPageShow = () => {
      void fetchLatest();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    void fetchLatest();

    return () => {
      disposed = true;
      window.clearTimeout(pollTimer);
      activeController?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [accessReady, date, refreshRequest, selectionKey, trainNo]);

  const currentData = dataKey === selectionKey ? data : null;
  return {
    data: currentData,
    loading: Boolean(trainNo) && !currentData && (loading || accessReady),
    refreshing: Boolean(trainNo) && Boolean(currentData) && refreshing,
    error: currentData ? "" : error,
    refreshError: currentData ? refreshError : "",
    retry: () => setRefreshRequest((value) => value + 1),
  };
}

function StationDetailsPanel({
  station,
  board,
  hours,
  loading,
  error,
  onClose,
  onRetry,
  onSelectTrain,
}: {
  station: Station;
  board: StationBoard | null;
  hours: 4 | 8;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onSelectTrain: (train: StationTrain) => void;
}) {
  return (
    <aside
      className="absolute right-3 bottom-3 left-3 z-[950] flex h-[42dvh] min-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:top-16 lg:left-auto lg:h-auto lg:min-h-0 lg:w-[min(410px,calc(100%-1.5rem))]"
      aria-label={`${station.name} station details`}
    >
      <header className="border-b border-slate-200 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 font-site-code text-xs font-bold text-white">
                {station.code}
              </span>
              <h2
                className="truncate text-lg font-bold tracking-tight"
                title={station.name}
              >
                {station.name}
              </h2>
            </div>
            <p className="mt-1 font-site-code text-xs text-slate-500">
              Station · {station.lat.toFixed(4)}, {station.lon.toFixed(4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label="Close station details"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Clock3 size={16} aria-hidden="true" /> Upcoming trains
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Next {hours} hours</p>
          </div>
          {board ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 font-site-code text-xs font-bold text-blue-700">
              {board.totalTrains}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <RefreshCw
                className="mx-auto animate-spin text-blue-700"
                size={22}
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-slate-600">
                Checking the next 4 hours…
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg bg-red-800 px-3 py-2 font-semibold text-white transition-colors hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && board?.trains.length === 0 ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <TrainFront
                className="mx-auto text-slate-400"
                size={26}
                aria-hidden="true"
              />
              <p className="mt-3 font-semibold text-slate-800">
                No upcoming trains
              </p>
              <p className="mt-1 text-sm text-slate-500">
                No trains were found in the next 8 hours.
              </p>
            </div>
          </div>
        ) : null}

        {board && board.trains.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-2">
            {board.trains.map((train) => {
              const cancelled =
                train.cancelled === true ||
                (typeof train.cancelled === "string" &&
                  !["", "false", "null"].includes(
                    train.cancelled.toLowerCase(),
                  ));
              const delayedTime = [train.departure, train.arrival].find(
                (time) => time?.delayed,
              );
              return (
                <button
                  type="button"
                  onClick={() => onSelectTrain(train)}
                  key={`${train.trainNo}-${train.runDate}-${train.arrival?.scheduled}-${train.departure?.scheduled}`}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-blue-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <p className="shrink-0 font-site-code text-xs font-bold text-blue-700">
                          {train.trainNo}
                        </p>
                        <h4
                          className="truncate text-sm font-bold text-slate-900"
                          title={train.trainName}
                        >
                          {train.trainName}
                        </h4>
                      </div>
                      <p
                        className="mt-1 truncate text-xs text-slate-600"
                        title={`${train.sourceName} to ${train.destName}`}
                      >
                        {train.source} · {train.sourceName} → {train.dest} ·{" "}
                        {train.destName}
                      </p>
                    </div>
                    {cancelled ? (
                      <span className="max-w-24 shrink-0 truncate whitespace-nowrap rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                        Cancelled
                      </span>
                    ) : delayedTime ? (
                      <span className="max-w-24 shrink-0 truncate whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
                        {delayedTime.delay || "Delayed"}
                      </span>
                    ) : (
                      <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                        On time
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 px-2 py-1.5">
                    <div className="min-w-0 pr-2">
                      <span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                        Arr
                      </span>
                      <StationBoardTime
                        time={train.arrival}
                        cancelled={cancelled}
                      />
                    </div>
                    <div className="min-w-0 px-2">
                      <span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                        Dep
                      </span>
                      <StationBoardTime
                        time={train.departure}
                        cancelled={cancelled}
                      />
                    </div>
                    <div className="min-w-0 pl-2">
                      <span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                        Platform
                      </span>
                      <strong className="block truncate font-site-code text-sm text-slate-900">
                        {train.platform || "—"}
                      </strong>
                    </div>
                  </div>
                  {train.classes ? (
                    <p
                      className="mt-1.5 truncate text-xs text-slate-500"
                      title={train.classes}
                    >
                      Coaches · {train.classes}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function CoachCar({
  coach,
  trainNo,
  trainName,
  index,
  isLastCoach,
}: {
  coach: TrainCoachPosition;
  trainNo: string;
  trainName: string;
  index: number;
  isLastCoach: boolean;
}) {
  const id = `vb-${trainNo}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "");
  const seats = coach.variant?.match(/-(\d+)-V\d+/i)?.[1] || "—";
  const coachNoX = isLastCoach ? 226 : 548;
  const coachX = isLastCoach ? 423 : 777;
  const seatsX = isLastCoach ? 652 : 974;
  if (index === 0 || isLastCoach) {
    return (
      <svg
        className="block h-auto w-full select-none drop-shadow-xl"
        viewBox="0 0 1200 390"
        role="img"
        aria-label={`Vande Bharat ${isLastCoach ? "trailing" : "leading"} driving coach, coach ${coach.number || "unavailable"}, unique coach number ${coach.coachNo || "unavailable"}, ${seats} seats`}
      >
        <defs>
          <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#454e5a" />
            <stop offset="1" stopColor="#252c36" />
          </linearGradient>
          <linearGradient id={`${id}-window`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#6b90ae" />
            <stop offset="1" stopColor="#26384e" />
          </linearGradient>
          <linearGradient id={`${id}-nose`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ff9b27" />
            <stop offset=".5" stopColor="#ff7007" />
            <stop offset="1" stopColor="#e85c04" />
          </linearGradient>
        </defs>
        <g transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined}>
        <rect x="1164" y="128" width="32" height="164" rx="8" fill="#252a32" stroke="#68717a" strokeWidth="5" />
        <path d="M18 283 Q11 261 32 234 L95 166 Q171 88 303 100 L354 113 H1162 Q1172 113 1172 124 V292 H82 Q30 292 18 283Z" fill="#d9dce0" stroke="#343b45" strokeWidth="4" />
        <path d="M28 248 L102 171 Q175 105 307 114 H1167 V253 H83 Q40 257 28 248Z" fill={`url(#${id}-shell)`} />
        <path d="M21 263 Q58 234 99 185 Q178 92 307 99 H1164 V133 H311 Q187 129 113 199 L36 283Z" fill={`url(#${id}-nose)`} />
        <path d="M24 273 Q100 247 165 246 H1167 V293 H79 Q34 292 24 273Z" fill="#f0f1f3" />
        <path d="M35 287 Q93 259 170 260 H1165 V271 H159 Q93 269 49 295Z" fill="#ff7009" />
        <path d="M64 229 L113 175 Q175 116 256 120 L209 151 Q156 174 120 210 L91 235Z" fill="#162332" stroke="#738c9d" strokeWidth="3" />
        <path d="M117 173 Q172 130 238 128" stroke="#a6c7da" strokeWidth="5" fill="none" />
        <path d="M66 228 L101 218 L83 237 L57 242Z" fill="#182735" stroke="#a6b2bd" strokeWidth="2" />
        <rect x="330" y="100" width="120" height="12" rx="3" fill="#626b75" />
        <rect x="820" y="99" width="155" height="14" rx="3" fill="#5e6771" />
        <path d="M837 103 H958" stroke="#242d35" strokeWidth="5" strokeDasharray="3 5" />
        <rect x="312" y="147" width="67" height="145" rx="3" fill="#fa760c" stroke="#19212b" strokeWidth="5" />
        <rect x="330" y="165" width="32" height="64" rx="5" fill={`url(#${id}-window)`} stroke="#202833" strokeWidth="5" />
        <rect x="370" y="233" width="5" height="15" rx="2" fill="#dbe1e8" />
        <g fill={`url(#${id}-window)`} stroke="#151c24" strokeWidth="5">
          <rect x="412" y="218" width="115" height="42" rx="7" /><rect x="548" y="218" width="115" height="42" rx="7" />
          <rect x="684" y="218" width="115" height="42" rx="7" /><rect x="820" y="218" width="115" height="42" rx="7" />
          <rect x="956" y="218" width="115" height="42" rx="7" />
        </g>
        <rect x="410" y="143" width="670" height="71" rx="12" fill="#121922" stroke="#84909b" strokeWidth="2" />
        <path d="M686 153 V203 M868 153 V203" stroke="#b1b9c1" strokeWidth="2" />
        </g>
        <g fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
          <g fontSize="15" fontWeight="700" fill="#c8d0d9"><text x={coachNoX} y="163">COACH NO.</text><text x={coachX} y="163">COACH</text><text x={seatsX} y="163">SEATS</text></g>
          <g fontSize="39" fontWeight="800" fill="#ffffff">
            <text x={coachNoX} y="203" textLength={isLastCoach ? 156 : 216} lengthAdjust="spacingAndGlyphs">{coach.coachNo || "—"}</text>
            <text x={coachX} y="203">{coach.number || "—"}</text>
            <text x={seatsX} y="203">{seats}</text>
          </g>
        </g>
        <g fontFamily="Arial,Helvetica,sans-serif" fontWeight="700" fill="#152a4d" textAnchor={isLastCoach ? "end" : undefined}>
          <text x={isLastCoach ? 1058 : 142} y="269" fontSize="19">VANDE BHARAT</text><text x={isLastCoach ? 1035 : 165} y="286" fontSize="11" letterSpacing="2">EXPRESS</text>
          <text x={isLastCoach ? 337 : 863} y="286" fontSize="14">INDIAN RAILWAYS</text>
        </g>
        <path transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined} d="M138 293 H158" stroke="#f68a13" strokeWidth="3" /><path transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined} d="M158 293 H178" stroke="white" strokeWidth="3" /><path transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined} d="M178 293 H198" stroke="#168d53" strokeWidth="3" />
        <g transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined} fill="#303842" stroke="#1b232d" strokeWidth="3">
          <rect x="455" y="293" width="160" height="27" rx="4" /><rect x="635" y="293" width="150" height="28" rx="4" />
          <rect x="800" y="293" width="130" height="27" rx="4" /><path d="M154 297 H365 L348 331 H172Z" /><path d="M914 297 H1128 L1110 331 H933Z" />
        </g>
        <g transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined} fill="#222a34" stroke="#8b959f" strokeWidth="6"><circle cx="198" cy="334" r="29" /><circle cx="323" cy="334" r="29" /><circle cx="954" cy="334" r="29" /><circle cx="1080" cy="334" r="29" /></g>
        <g transform={isLastCoach ? "translate(1200 0) scale(-1 1)" : undefined} fill="#697582" stroke="#1a222b" strokeWidth="5"><circle cx="198" cy="334" r="12" /><circle cx="323" cy="334" r="12" /><circle cx="954" cy="334" r="12" /><circle cx="1080" cy="334" r="12" /></g>
      </svg>
    );
  }
  return (
    <svg
      className="block h-auto w-full select-none drop-shadow-xl"
      viewBox="0 0 1200 370"
      role="img"
      aria-label={`${coach.number || "Coach"}, unique coach number ${coach.coachNo || "unavailable"}, ${seats} seats`}
    >
      <defs>
        <linearGradient id={`${id}-body`} x2="0" y2="1">
          <stop stopColor="#434a54" />
          <stop offset="1" stopColor="#242b35" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x2="0" y2="1">
          <stop stopColor="#6286a2" />
          <stop offset="1" stopColor="#263b52" />
        </linearGradient>
      </defs>
      <rect x="15" y="104" width="1170" height="190" rx="17" fill="#c9cdd1" stroke="#242933" strokeWidth="5" />
      <rect x="2" y="139" width="23" height="120" rx="5" fill="#303741" />
      <rect x="1175" y="139" width="23" height="120" rx="5" fill="#303741" />
      <rect x="35" y="87" width="1130" height="30" rx="12" fill="#ff6d0a" />
      <path d="M45 101 H1155" stroke="#ffad48" strokeWidth="4" />
      <rect x="220" y="76" width="180" height="15" rx="5" fill="#5d6670" />
      <rect x="800" y="76" width="180" height="15" rx="5" fill="#5d6670" />
      <rect x="30" y="117" width="1140" height="136" rx="9" fill={`url(#${id}-body)`} />
      <path d="M30 247 H1170 V293 H30Z" fill="#d6d8db" />
      <path d="M165 117 L260 210 H285 L190 117Z M940 253 L986 293 H1015 L970 253Z" fill="#ff700b" />
      <rect x="30" y="254" width="1140" height="12" fill="#ff730c" />
      <g fill="#ff790e" stroke="#1e252c" strokeWidth="5">
        <rect x="65" y="123" width="68" height="169" rx="3" />
        <rect x="1067" y="123" width="68" height="169" rx="3" />
      </g>
      <g fill={`url(#${id}-glass)`} stroke="#1b222a" strokeWidth="5">
        <rect x="85" y="153" width="28" height="54" rx="10" />
        <rect x="1087" y="153" width="28" height="54" rx="10" />
      </g>
      <g fill={`url(#${id}-glass)`} stroke="#151b22" strokeWidth="6">
        <rect x="166" y="218" width="112" height="37" rx="5" />
        <rect x="298" y="218" width="112" height="37" rx="5" />
        <rect x="430" y="218" width="112" height="37" rx="5" />
        <rect x="562" y="218" width="112" height="37" rx="5" />
        <rect x="694" y="218" width="112" height="37" rx="5" />
        <rect x="826" y="218" width="112" height="37" rx="5" />
      </g>
      <rect x="250" y="126" width="700" height="86" rx="13" fill="#151b23" stroke="#77818b" strokeWidth="2" />
      <path d="M545 139 V199 M755 139 V199" stroke="#aab4c0" strokeWidth="2" />
      <g fontFamily="Arial, Helvetica, sans-serif" textAnchor="middle">
        <g fontSize="17" fontWeight="700" fill="#c4ccd5">
          <text x="397" y="150">COACH NO.</text>
          <text x="650" y="150">COACH</text>
          <text x="852" y="150">SEATS</text>
        </g>
        <g fontSize="48" fontWeight="800" fill="#ffffff">
          <text x="397" y="196" textLength="210" lengthAdjust="spacingAndGlyphs">{coach.coachNo || "—"}</text>
          <text x="650" y="196">{coach.number || "—"}</text>
          <text x="852" y="196">{seats}</text>
        </g>
      </g>
      <g fontFamily="Arial, Helvetica, sans-serif" fill="#1b293a" fontWeight="700">
        <text x="166" y="284" fontSize="18">{trainName.toUpperCase()}</text>
        <text x="872" y="284" fontSize="15">INDIAN RAILWAYS</text>
      </g>
      <g fill="#303741" stroke="#1c222a" strokeWidth="3">
        <rect x="370" y="293" width="140" height="28" rx="4" />
        <rect x="525" y="293" width="170" height="29" rx="4" />
        <rect x="710" y="293" width="120" height="27" rx="4" />
        <path d="M125 297 H335 L310 331 H150Z" />
        <path d="M865 297 H1075 L1050 331 H890Z" />
      </g>
      <g fill="#202832" stroke="#77818b" strokeWidth="6">
        <circle cx="175" cy="331" r="30" /><circle cx="290" cy="331" r="30" />
        <circle cx="910" cy="331" r="30" /><circle cx="1025" cy="331" r="30" />
      </g>
      <g fill="#65707d" stroke="#1d242d" strokeWidth="5">
        <circle cx="175" cy="331" r="13" /><circle cx="290" cy="331" r="13" />
        <circle cx="910" cy="331" r="13" /><circle cx="1025" cy="331" r="13" />
      </g>
    </svg>
  );
}

function CoachConsist({
  coaches,
  trainNo,
  trainName,
  accentColor,
}: {
  coaches: TrainCoachPosition[];
  trainNo: string;
  trainName: string;
  accentColor: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; scrollLeft: number; pointerId: number; moved: boolean } | null>(null);
  const suppressCoachClickRef = useRef(false);
  const snapTimerRef = useRef<number | null>(null);
  const springingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ordered = useMemo(
    () => [...coaches].sort((a, b) => Number(a.position) - Number(b.position)),
    [coaches],
  );
  const move = (direction: -1 | 1) =>
    stripRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  const mostVisibleCoachIndex = (strip: HTMLDivElement) => {
    const stripBounds = strip.getBoundingClientRect();
    let visibleIndex = 0;
    let mostVisibleWidth = -1;
    strip.querySelectorAll<HTMLElement>("[data-coach-index]").forEach((item) => {
      const bounds = item.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(bounds.right, stripBounds.right) - Math.max(bounds.left, stripBounds.left),
      );
      if (visibleWidth > mostVisibleWidth) {
        mostVisibleWidth = visibleWidth;
        visibleIndex = Number(item.dataset.coachIndex || 0);
      }
    });
    return visibleIndex;
  };
  const springToMostVisibleCoach = () => {
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => {
      const strip = stripRef.current;
      if (!strip) return;
      const index = mostVisibleCoachIndex(strip);
      const coach = strip.querySelector<HTMLElement>(`[data-coach-index="${index}"]`);
      if (!coach) return;
      setActiveIndex(index);
      const stripBounds = strip.getBoundingClientRect();
      const coachBounds = coach.getBoundingClientRect();
      const offset = coachBounds.left + coachBounds.width / 2 - (stripBounds.left + strip.clientWidth / 2);
      if (Math.abs(offset) < 3) return;
      springingRef.current = true;
      strip.scrollBy({ left: offset, behavior: "smooth" });
      window.setTimeout(() => { springingRef.current = false; }, 500);
    }, 140);
  };
  useEffect(() => () => {
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
  }, []);
  const activeCoach = ordered[activeIndex] || ordered[0];
  const seatCount = activeCoach?.variant?.match(/-(\d+)-V\d+/i)?.[1] || "—";
  const coachDetails = activeCoach
    ? [
        ["Coach", activeCoach.number],
        ["Coach number", activeCoach.coachNo],
        ["Seats", seatCount],
        ["Type", activeCoach.type],
        ["Coach type", activeCoach.coachType],
        ["Position", activeCoach.position],
        ["Coach ID", activeCoach.id],
        ["Class", activeCoach.coachClass],
        ["Operator", activeCoach.operatedBy],
        ["Manufactured", activeCoach.manufacturedIn],
        ["Variant", activeCoach.variant],
      ] as const
    : [];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Train coach positions">
      <header className="flex items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-slate-100">Coach composition</p>
          <p className="mt-0.5 text-[11px] text-slate-400">{ordered.length} coaches · drag to explore</p>
        </div>
        <div className="flex gap-1">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => move(direction)}
              className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-slate-300"
              aria-label={direction < 0 ? "Previous coaches" : "Next coaches"}
            >
              {direction < 0 ? <span aria-hidden="true">‹</span> : <span aria-hidden="true">›</span>}
            </button>
          ))}
        </div>
      </header>
      {ordered.length ? (
        <>
          <div
            ref={stripRef}
            className={`flex h-[142px] flex-none items-center overflow-x-auto overscroll-x-contain px-3 py-2 [scrollbar-width:thin] ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
            style={{
              scrollBehavior: "auto",
              touchAction: "pan-x",
              paddingLeft: "max(12px, calc((100% - min(76vw, 310px)) / 2))",
              paddingRight: "max(12px, calc((100% - min(76vw, 310px)) / 2))",
            }}
            onScroll={(event) => {
              const strip = event.currentTarget;
              setActiveIndex(mostVisibleCoachIndex(strip));
              if (!dragging && !springingRef.current) springToMostVisibleCoach();
            }}
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse" || event.button !== 0 || !stripRef.current) return;
              if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
              springingRef.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                x: event.clientX,
                scrollLeft: stripRef.current.scrollLeft,
                pointerId: event.pointerId,
                moved: false,
              };
              setDragging(true);
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              if (!dragRef.current || dragRef.current.pointerId !== event.pointerId || !stripRef.current) return;
              if (Math.abs(event.clientX - dragRef.current.x) > 4) {
                dragRef.current.moved = true;
              }
              stripRef.current.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.x);
            }}
            onPointerUp={() => {
              const didMove = Boolean(dragRef.current?.moved);
              suppressCoachClickRef.current = didMove;
              if (didMove) window.setTimeout(() => { suppressCoachClickRef.current = false; }, 250);
              dragRef.current = null;
              setDragging(false);
              springToMostVisibleCoach();
            }}
            onPointerCancel={() => { dragRef.current = null; setDragging(false); springToMostVisibleCoach(); }}
            onDragStart={(event) => event.preventDefault()}
          >
            {ordered.map((coach, index) => (
              <button
                key={`${coach.id || coach.number || "coach"}-${coach.position || index}`}
                type="button"
                data-coach-index={index}
                aria-pressed={activeIndex === index}
                aria-label={`Coach ${index + 1} of ${ordered.length}: ${coach.number || "unnumbered"}`}
                onClick={(event) => {
                  if (suppressCoachClickRef.current) {
                    suppressCoachClickRef.current = false;
                    event.preventDefault();
                    return;
                  }
                  setActiveIndex(index);
                  event.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
                className={`-mr-2 w-[min(76vw,310px)] flex-none rounded-lg p-1 transition-[opacity,transform] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 ${activeIndex === index ? "relative z-10 scale-[1.03] opacity-100" : "scale-[0.96] opacity-35 hover:opacity-70"}`}
                style={{ outlineColor: accentColor }}
              >
                <CoachCar
                  coach={coach}
                  trainNo={trainNo}
                  trainName={trainName}
                  index={index}
                  isLastCoach={index === ordered.length - 1}
                />
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-slate-700 px-4 py-3">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: accentColor }}>Selected coach</p>
                <h3 className="mt-0.5 truncate text-base font-semibold text-white">
                  {activeCoach?.number || "Coach details"}
                </h3>
              </div>
              <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 font-site-code text-[11px] text-slate-300">
                {ordered.length ? `${activeIndex + 1} of ${ordered.length}` : ""}
              </span>
            </div>
            <dl className="grid min-h-[330px] flex-1 grid-cols-2 grid-rows-6 gap-2">
              {coachDetails.map(([label, value]) => (
                <div
                  key={label}
                  className={`flex min-h-0 min-w-0 flex-col justify-center rounded-xl border border-slate-700/80 bg-slate-800/45 px-3 py-2 ${label === "Variant" ? "col-span-2" : ""}`}
                >
                  <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{label}</dt>
                  <dd
                    className="mt-1 truncate font-site-code text-sm font-medium text-slate-100"
                    style={label === "Coach number" ? { color: accentColor } : undefined}
                    title={String(value ?? "—")}
                  >
                    {value == null || value === "" ? "—" : value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center px-5 text-center text-sm text-slate-400">
          Coach positions aren’t available for this run yet.
        </div>
      )}
    </section>
  );
}

function TrainDetailsPanel({
  selection,
  trainType,
  data,
  loading,
  refreshing,
  error,
  refreshError,
  focusOnly,
  onClose,
  onRetry,
  onFocusTrain,
}: {
  selection: TrainSelection;
  trainType: string;
  data: TrainLiveData | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refreshError: string;
  focusOnly: boolean;
  onClose: () => void;
  onRetry: () => void;
  onFocusTrain: () => void;
}) {
  const accentColor = liveTrainCategoryColor(trainType);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const isFullyCancelled = Boolean(
    data?.statusNote && /\bcancel(?:led|lation)?\b/i.test(data.statusNote),
  );
  const stops = data?.timeline || [];
  const scheduleGroups = useMemo(() => groupTrainSchedule(stops), [stops]);
  const currentStationCode = data?.currentPosition?.stationCode;
  const currentStop =
    (currentStationCode
      ? stops.find((stop) => stop.stationCode === currentStationCode)
      : undefined) || stops.find((stop) => stop.status === "current");
  const currentDelay =
    currentStop?.departure?.delay || currentStop?.arrival?.delay || "";
  const currentSegmentKey = useMemo(
    () =>
      scheduleGroups.find((group) => group.intermediates.includes(currentStop!))
        ?.key,
    [currentStop, scheduleGroups],
  );
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set(),
  );
  const isVandeBharat = liveTrainCategory(trainType) === "vandeBharat";
  const [detailsTab, setDetailsTab] = useState<"route" | "coaches">("route");
  const coachPositions = useMemo(() => {
    const entries = data?.coachPositionTimeline || [];
    if (currentStationCode) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].stationCode?.toUpperCase() === currentStationCode.toUpperCase()) {
          return entries[index].coachPosition || [];
        }
      }
    }
    return data?.coachPosition?.length
      ? data.coachPosition
      : entries[0]?.coachPosition || [];
  }, [currentStationCode, data?.coachPosition, data?.coachPositionTimeline]);

  useEffect(() => {
    setDetailsTab("route");
  }, [selection.trainNo, selection.date]);

  useEffect(() => {
    if (!data?.timeline.length) return;
    const initialSegments = currentSegmentKey
      ? new Set([currentSegmentKey])
      : new Set<string>();
    let frame = 0;
    queueMicrotask(() => {
      setExpandedSegments(initialSegments);
      frame = window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          scheduleRef.current
            ?.querySelector<HTMLElement>('[aria-current="location"]')
            ?.scrollIntoView({
              block: "center",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
            });
        }),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentSegmentKey, data?.timeline.length, currentStationCode]);

  const toggleSegment = (key: string) => {
    setExpandedSegments((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-[20000] flex h-[68dvh] min-h-80 flex-col overflow-hidden rounded-t-2xl border-t border-slate-700 bg-[#111827] text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)] lg:inset-y-0 lg:right-auto lg:left-0 lg:h-auto lg:w-[390px] lg:rounded-none lg:border-t-0 lg:border-r"
      aria-label={`${selection.trainName} live train details`}
    >
      <header className="shrink-0 border-b border-slate-700 px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-site-code text-base font-bold leading-5 text-white">
              {selection.trainNo}
            </h2>
            <p
              className="truncate text-xs text-slate-300"
              title={data?.trainName || selection.trainName}
            >
              {data?.trainName || selection.trainName}
            </p>
          </div>
          <button
            type="button"
            onClick={onFocusTrain}
            disabled={!data?.currentPosition && !data?.route?.length}
            aria-pressed={focusOnly}
            className={`grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 lg:hidden ${focusOnly ? "text-white" : "text-slate-400"}`}
            style={focusOnly ? { color: accentColor, backgroundColor: `color-mix(in srgb, ${accentColor} 14%, transparent)` } : undefined}
            aria-label={
              focusOnly ? "Show all trains" : "Focus selected train only"
            }
            title={focusOnly ? "Show all trains" : "Focus selected train only"}
          >
            <Focus size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            aria-label="Close train details"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 font-medium text-slate-200">
            {data?.date || selection.date || "Current run"}
          </span>
          {data?.start?.stationCode && data?.end?.stationCode ? (
            <span className="truncate text-slate-400">
              {data.start.stationCode} → {data.end.stationCode}
            </span>
          ) : null}
          {data?.progress && !isFullyCancelled ? (
            <span className="ml-auto font-site-code" style={{ color: accentColor }}>
              {Math.round(data.progress.percent)}%
            </span>
          ) : null}
        </div>
        {data?.progress && !isFullyCancelled ? (
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-slate-700"
            role="progressbar"
            aria-label="Journey progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(data.progress.percent)}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, data.progress.percent))}%`, backgroundColor: accentColor }}
            />
          </div>
        ) : null}
      </header>

      {detailsTab === "route" ? (
        <div className="grid shrink-0 grid-cols-[60px_1fr_60px] items-center border-b border-slate-700 px-3 py-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          <span>Arrival</span>
          <span className="text-center">
            {scheduleGroups.length
              ? `${scheduleGroups.length} stops · ${data?.totalDistanceKm ?? "—"} km`
              : "Route schedule"}
          </span>
          <span className="text-right">Departure</span>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
          <div>
            <RefreshCw
              className="mx-auto animate-spin motion-reduce:animate-none"
              style={{ color: accentColor }}
              size={22}
              aria-hidden="true"
            />
            <p className="mt-3 text-sm text-slate-300">
              Building live schedule…
            </p>
          </div>
        </div>
      ) : null}
      {error && !data ? (
        <div className="m-4 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-11 rounded-lg bg-red-600 px-3 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            Try again
          </button>
        </div>
      ) : null}
      {data ? (
        <>
          {refreshError ? (
            <p
              role="status"
              className="border-b border-amber-500/30 bg-amber-950/30 px-4 py-2 text-xs text-amber-200"
            >
              Refresh failed. Showing last update.
            </p>
          ) : null}
          {isFullyCancelled ? (
            <p
              role="note"
              className="border-b border-red-500/30 bg-red-950/30 px-4 py-2 text-xs text-red-200"
            >
              Service cancelled today.
            </p>
          ) : null}
          {isVandeBharat ? (
            <div className="flex shrink-0 border-b border-slate-700 px-3 pt-2" role="tablist" aria-label="Train details">
              {(["route", "coaches"] as const).map((tab) => {
                const active = detailsTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDetailsTab(tab)}
                    className={`min-h-9 border-b-2 px-3 text-xs font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 ${active ? "text-slate-100" : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    style={active ? { borderColor: accentColor, color: accentColor } : undefined}
                  >
                    {tab === "route" ? "Route" : `Coaches${coachPositions.length ? ` · ${coachPositions.length}` : ""}`}
                  </button>
                );
              })}
            </div>
          ) : null}
          {isVandeBharat && detailsTab === "coaches" ? (
            <CoachConsist
              coaches={coachPositions}
              trainNo={data.trainNo || selection.trainNo}
              trainName={data.trainName || selection.trainName}
              accentColor={accentColor}
            />
          ) : (
          <div
            ref={scheduleRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
          >
            {scheduleGroups.length ? (
              <ol
                className="relative before:pointer-events-none before:absolute before:top-5 before:bottom-5 before:left-[72px] before:w-px before:bg-slate-600 before:content-['']"
                aria-label="Train station timeline"
              >
                {scheduleGroups.map((group) => {
                  const stop = group.stop;
                  const current = stop === currentStop;
                  const passed = stop.status === "passed";
                  const cancelled =
                    isFullyCancelled || isCancelledScheduleStop(stop);
                  const scheduledArrival = formatScheduleTime(
                    stop.arrival?.scheduled,
                  );
                  const scheduledDeparture = formatScheduleTime(
                    stop.departure?.scheduled,
                  );
                  const actualArrival = formatScheduleTime(
                    stop.arrival?.actual,
                  );
                  const actualDeparture = formatScheduleTime(
                    stop.departure?.actual,
                  );
                  const arrivalDelayed = isActualTimeLate(actualArrival, scheduledArrival);
                  const departureDelayed = isActualTimeLate(actualDeparture, scheduledDeparture);
                  const expanded = expandedSegments.has(group.key);
                  return (
                    <li key={group.key}>
                      <article
                        aria-current={current ? "location" : undefined}
                        className="relative grid min-h-[58px] grid-cols-[56px_24px_minmax(0,1fr)_56px] items-center rounded-lg px-1 py-1.5 hover:bg-slate-800/60"
                        style={current ? { backgroundColor: `color-mix(in srgb, ${accentColor} 10%, #1e293b)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accentColor} 55%, transparent)` } : undefined}
                      >
                        <div className="min-w-0 text-left font-site-code text-[10px] leading-4">
                          <span className="block text-slate-300">
                            {scheduledArrival}
                          </span>
                          <span
                            className={`block ${cancelled ? "text-red-400" : arrivalDelayed ? "text-red-400" : actualArrival !== "--" ? "text-slate-200" : "text-slate-500"}`}
                          >
                            {cancelled
                              ? "CANCEL"
                              : actualArrival !== "--"
                                ? actualArrival
                                : ""}
                          </span>
                        </div>
                        <span
                          className="relative z-10 grid h-full place-items-center"
                          aria-hidden="true"
                        >
                          <i
                            className={`size-2.5 rounded-full ring-[3px] ring-[#111827] ${cancelled ? "bg-red-500" : passed ? "bg-slate-400" : "bg-amber-400"}`}
                            style={current && !cancelled ? { backgroundColor: accentColor } : undefined}
                          />
                        </span>
                        <div className="min-w-0 px-1.5">
                          <strong
                            className={`block truncate text-[13px] leading-4 ${cancelled ? "text-slate-500 line-through" : current ? "" : "text-slate-100"}`}
                            style={current && !cancelled ? { color: accentColor } : undefined}
                            title={stop.stationName}
                          >
                            {stop.stationName || stop.stationCode}
                          </strong>
                          <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                            {stop.stationCode} ·{" "}
                            {stop.distanceKm === "" || stop.distanceKm == null
                              ? "—"
                              : `${stop.distanceKm} km`}
                            {stop.platform ? ` · PF ${stop.platform}` : ""}
                          </span>
                        </div>
                        <div className="min-w-0 text-right font-site-code text-[10px] leading-4">
                          <span className="block text-slate-300">
                            {scheduledDeparture}
                          </span>
                          <span
                            className={`block ${cancelled ? "text-red-400" : departureDelayed ? "text-red-400" : actualDeparture !== "--" ? "text-slate-200" : "text-slate-500"}`}
                          >
                            {cancelled
                              ? "CANCEL"
                              : actualDeparture !== "--"
                                ? actualDeparture
                                : ""}
                          </span>
                        </div>
                      </article>
                      {group.intermediates.length ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => toggleSegment(group.key)}
                            aria-expanded={expanded}
                            aria-controls={`segment-${group.key}`}
                            className={`grid min-h-10 w-full grid-cols-[56px_24px_minmax(0,1fr)_56px] items-center rounded-lg px-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${expanded ? "bg-slate-800" : "hover:bg-slate-800/60"}`}
                          >
                            <span />
                            <span
                              className="relative z-10 h-full"
                              aria-hidden="true"
                            >
                              <i className="absolute top-1/2 -right-1 left-1/2 h-px bg-slate-600" />
                            </span>
                            <span className="min-w-0 px-1.5">
                              <span className="block truncate text-[11px] font-semibold text-slate-400">
                                {group.intermediates.length} passing stations
                              </span>
                            </span>
                            <ChevronDown
                              size={15}
                              className={`mx-auto text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                              aria-hidden="true"
                            />
                          </button>
                          {expanded ? (
                            <ol id={`segment-${group.key}`}>
                              {group.intermediates.map((intermediate) => {
                                const intermediateCurrent =
                                  intermediate === currentStop;
                                const scheduledArrival = formatScheduleTime(
                                  intermediate.arrival?.scheduled,
                                );
                                const actualArrival = formatScheduleTime(
                                  intermediate.arrival?.actual,
                                );
                                const scheduledDeparture = formatScheduleTime(
                                  intermediate.departure?.scheduled,
                                );
                                const actualDeparture = formatScheduleTime(
                                  intermediate.departure?.actual,
                                );
                                const arrivalDelayed = isActualTimeLate(actualArrival, scheduledArrival);
                                const departureDelayed = isActualTimeLate(actualDeparture, scheduledDeparture);
                                const arrivalEarly = actualArrival !== "--" && scheduledArrival !== "--" && actualArrival !== scheduledArrival && !arrivalDelayed;
                                const departureEarly = actualDeparture !== "--" && scheduledDeparture !== "--" && actualDeparture !== scheduledDeparture && !departureDelayed;
                                return (
                                  <li
                                    key={`${intermediate.stationCode}-${intermediate.index}`}
                                    aria-current={
                                      intermediateCurrent
                                        ? "location"
                                        : undefined
                                    }
                                    className="grid min-h-12 grid-cols-[56px_24px_minmax(0,1fr)_56px] items-center rounded-lg px-1 py-1"
                                    style={intermediateCurrent ? { backgroundColor: `color-mix(in srgb, ${accentColor} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accentColor} 55%, transparent)` } : undefined}
                                  >
                                    <div className="min-w-0 text-left font-site-code text-[11px] leading-4">
                                      <span
                                        className={`block ${actualArrival === "--" ? "text-slate-400" : arrivalDelayed ? "text-red-400" : arrivalEarly ? "text-emerald-400" : "text-slate-200"}`}
                                      >
                                        {actualArrival !== "--"
                                          ? actualArrival
                                          : scheduledArrival}
                                      </span>
                                      {actualArrival !== "--" &&
                                      scheduledArrival !== "--" &&
                                      actualArrival !== scheduledArrival ? (
                                        <span className="block text-[10px] text-slate-500">
                                          {scheduledArrival}
                                        </span>
                                      ) : null}
                                    </div>
                                    <span
                                      className="relative z-10 h-full"
                                      aria-hidden="true"
                                    >
                                      <i
                                        className={`absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full ${intermediateCurrent ? "" : "bg-slate-500"}`}
                                        style={intermediateCurrent ? { backgroundColor: accentColor, boxShadow: `0 0 0 4px color-mix(in srgb, ${accentColor} 20%, transparent)` } : undefined}
                                      />
                                    </span>
                                    <div className="min-w-0 px-1.5">
                                      <strong
                                        className={`block truncate text-[13px] font-semibold ${intermediateCurrent ? "" : "text-slate-200"}`}
                                        style={intermediateCurrent ? { color: accentColor } : undefined}
                                        title={intermediate.stationName}
                                      >
                                        {intermediate.stationName ||
                                          intermediate.stationCode}
                                      </strong>
                                      <span className="font-site-code text-[11px] text-slate-400">
                                        {intermediate.stationCode} ·{" "}
                                        {intermediate.distanceKm === "" ||
                                        intermediate.distanceKm == null
                                          ? "—"
                                          : `${intermediate.distanceKm} km`}
                                      </span>
                                    </div>
                                    <div className="min-w-0 text-right font-site-code text-[11px] leading-4">
                                      <span
                                        className={`block ${actualDeparture === "--" ? "text-slate-400" : departureDelayed ? "text-red-400" : departureEarly ? "text-emerald-400" : "text-slate-200"}`}
                                      >
                                        {actualDeparture !== "--"
                                          ? actualDeparture
                                          : scheduledDeparture}
                                      </span>
                                      {actualDeparture !== "--" &&
                                      scheduledDeparture !== "--" &&
                                      actualDeparture !== scheduledDeparture ? (
                                        <span className="block text-[10px] text-slate-500">
                                          {scheduledDeparture}
                                        </span>
                                      ) : null}
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="p-6 text-center text-sm text-slate-400">
                Station timeline unavailable for this run.
              </p>
            )}
          </div>
          )}
          <footer className="flex shrink-0 items-center gap-3 border-t border-slate-700 bg-slate-950/60 py-3 pr-4 pl-24">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <strong className="truncate text-sm text-white">
                  {isFullyCancelled
                    ? "Service cancelled"
                    : data.currentPosition
                      ? `At ${data.currentPosition.stationName}`
                      : "Position unavailable"}
                </strong>
                {currentDelay &&
                !/on time|^0\s*(?:m|min)?$/i.test(currentDelay.trim()) ? (
                  <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 font-site-code text-[10px] font-bold text-white">
                    {currentDelay}
                  </span>
                ) : null}
              </div>
              <p
                className="mt-0.5 truncate text-[11px] text-slate-400"
                title={data.statusNote}
              >
                {data.statusNote || data.lastUpdate || "Latest train report"}
              </p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              disabled={loading || refreshing}
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white shadow-lg disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              style={{ backgroundColor: accentColor }}
              aria-label="Refresh live train details"
            >
              <RefreshCw
                size={18}
                className={
                  refreshing ? "animate-spin motion-reduce:animate-none" : ""
                }
                aria-hidden="true"
              />
            </button>
          </footer>
        </>
      ) : null}
    </aside>
  );
}

export function RailAtlas() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const glMapRef = useRef<MapLibreMap | null>(null);
  const refreshLiveMapRef = useRef<(() => void) | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const layersButtonRef = useRef<HTMLButtonElement>(null);
  const legendButtonRef = useRef<HTMLButtonElement>(null);
  const railwayLayerRef = useRef<Layer | null>(null);
  const stationLayerRef = useRef<LayerGroup | null>(null);
  const liveTrainHitTestRef = useRef<
    ((x: number, y: number) => MappedLiveMapTrain | null) | null
  >(null);
  const selectedLayerRef = useRef<LayerGroup | null>(null);
  const trainLayerRef = useRef<LayerGroup | null>(null);
  const focusedTrainRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<TrainSelection | null>(
    null,
  );
  const [focusSelectedTrainOnly, setFocusSelectedTrainOnly] = useState(false);
  const selectedTrainActiveRef = useRef(false);
  selectedTrainActiveRef.current = Boolean(selectedTrain);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [showStations, setShowStations] = useState(false);
  const [showTracks, setShowTracks] = useState(false);
  const [showLiveTrains, setShowLiveTrains] = useState(true);
  const [visibleTrainCategories, setVisibleTrainCategories] = useState<
    LiveTrainCategory[]
  >(ALL_LIVE_TRAIN_CATEGORIES);
  const [liveTrainLayerReady, setLiveTrainLayerReady] = useState(false);
  const [liveMapTrains, setLiveMapTrains] = useState<MappedLiveMapTrain[]>([]);
  const [liveMapState, setLiveMapState] = useState<
    "loading" | "ready" | "stale" | "error"
  >("loading");
  const [liveMapError, setLiveMapError] = useState("");
  const [mapZoom, setMapZoom] = useState(5);
  const [minMapZoom, setMinMapZoom] = useState(3);
  const [layersOpen, setLayersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const atlasAccess = useRailAtlasAccess(turnstileScriptReady);
  const stationBoard = useStationBoard(selected, atlasAccess.ready);
  const globalSearch = useGlobalSearch(query, atlasAccess.ready);
  const trainLive = useTrainLive(selectedTrain, atlasAccess.ready);
  const selectedTrainType = selectedTrain
    ? liveMapTrains.find(
        (train) =>
          train.trainNo === selectedTrain.trainNo &&
          (!selectedTrain.date || train.journeyDate === selectedTrain.date),
      )?.trainType || "Other"
    : "Other";
  const selectedTrainAccent = liveTrainCategoryColor(selectedTrainType);
  const selectedTrainAccentRef = useRef(selectedTrainAccent);
  selectedTrainAccentRef.current = selectedTrainAccent;
  const stationGrid = useMemo(() => indexStations(stations), [stations]);
  const stationByCode = useMemo(
    () => new Map(stations.map((station) => [station.code, station])),
    [stations],
  );
  const liveTrainCounts = useMemo(() => {
    const counts = Object.fromEntries(
      ALL_LIVE_TRAIN_CATEGORIES.map((category) => [category, 0]),
    ) as Record<LiveTrainCategory, number>;
    for (const train of liveMapTrains)
      counts[liveTrainCategory(train.trainType)] += 1;
    return counts;
  }, [liveMapTrains]);
  const visibleTrainCategorySet = useMemo(
    () => new Set(visibleTrainCategories),
    [visibleTrainCategories],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/india-stations.json", { signal: controller.signal })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Station data unavailable")),
      )
      .then((response: StationCatalog) => {
        const nextStations = response.stations
          .filter(isMappedStation)
          .sort((a, b) => a.name.localeCompare(b.name));
        setStations(nextStations);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Station data unavailable",
          );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    let disposed = false;
    import("leaflet")
      .then(async (L) => {
        if (disposed || !mapNodeRef.current) return;
        const [bridge, maplibre] = await Promise.all([
          import("@maplibre/maplibre-gl-leaflet"),
          import("maplibre-gl"),
        ]);
        maplibre.setWorkerUrl(
          new URL(
            "maplibre-gl/dist/maplibre-gl-worker.mjs",
            import.meta.url,
          ).toString(),
        );
        const map = L.map(mapNodeRef.current, {
          center: [22.9, 79.2],
          zoom: 5,
          minZoom: 3,
          maxZoom: 18,
          maxBounds: INDIA_MAP_BOUNDS,
          maxBoundsViscosity: 1,
          preferCanvas: true,
          zoomControl: false,
          attributionControl: false
        });
        const indiaBoundsZoom = map.getBoundsZoom(
          INDIA_MAP_BOUNDS,
          false,
          L.point(24, 24),
        );
        map.setMinZoom(indiaBoundsZoom);
        setMinMapZoom(indiaBoundsZoom);
        const railwayPane = map.createPane("railwayLines");
        railwayPane.style.zIndex = "410";
        railwayPane.style.pointerEvents = "none";
        map.createPane("stationMarkers").style.zIndex = "440";
        const activeTrainPane = map.createPane("activeTrain");
        activeTrainPane.style.zIndex = "465";
        const selectedStationPane = map.createPane("selectedStation");
        selectedStationPane.style.zIndex = "470";
        selectedStationPane.style.pointerEvents = "none";
        map.on("zoomend", () => {
          const zoom = map.getZoom();
          setMapZoom(zoom);
          const radius = getStationMarkerRadius(zoom);
          stationLayerRef.current?.eachLayer((layer) => {
            if ("setRadius" in layer && typeof layer.setRadius === "function")
              layer.setRadius(radius);
          });
        });

        const darkBasemap = bridge
          .maplibreGL({
            style: "https://tiles.openfreemap.org/styles/dark",
          })
          .addTo(map);
        const glMap = darkBasemap.getMaplibreMap();
        glMapRef.current = glMap;
        glMap.once("load", () => {
          const countryBoundaryLayer = "boundary_country_z5-";
          if (glMap.getLayer(countryBoundaryLayer)) {
            // Replace disputed tile boundaries with the India boundary data used only here.
            glMap.setFilter(countryBoundaryLayer, [
              "all",
              ["==", ["get", "admin_level"], 2],
              ["!", ["has", "claimed_by"]],
            ]);
          }
          glMap.addSource("railkit-india-boundaries", {
            type: "geojson",
            data: `${window.location.origin}/data/india-boundaries.geojson`,
          });
          const insertBefore = glMap.getLayer(countryBoundaryLayer)
            ? countryBoundaryLayer
            : undefined;
          glMap.addLayer(
            {
              id: "railkit-india-boundary-fill",
              type: "fill",
              source: "railkit-india-boundaries",
              paint: {
                "fill-color": "#233956",
                "fill-opacity": 0.12,
              },
            },
            insertBefore,
          );
          glMap.addLayer(
            {
              id: "railkit-india-boundary-line",
              type: "line",
              source: "railkit-india-boundaries",
              layout: {
                "line-cap": "round",
                "line-join": "round",
              },
              paint: {
                "line-color": "#d1d5db",
                "line-width": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  3,
                  0.8,
                  8,
                  1.4,
                  14,
                  2.1,
                ],
                "line-opacity": 0.45,
              },
            },
            insertBefore,
          );
        });
        mapRef.current = map;
        setMapReady(true);
        map.fitBounds(INDIA_MAP_BOUNDS, { padding: [24, 24], animate: false });
      })
      .catch(() => {
        if (!disposed) setError("Map library unavailable");
      });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      glMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    let frame = 0;
    let cancelled = false;
    const invalidateWhenVisible = () => {
      if (document.visibilityState === "hidden") return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map) return;
        map.invalidateSize({ pan: false, debounceMoveend: true });
        import("leaflet").then((L) => {
          if (cancelled || mapRef.current !== map) return;
          const indiaBoundsZoom = map.getBoundsZoom(
            INDIA_MAP_BOUNDS,
            false,
            L.point(24, 24),
          );
          map.setMinZoom(indiaBoundsZoom);
          setMinMapZoom(indiaBoundsZoom);
        });
      });
    };
    document.addEventListener("visibilitychange", invalidateWhenVisible);
    window.addEventListener("pageshow", invalidateWhenVisible);
    window.addEventListener("orientationchange", invalidateWhenVisible);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", invalidateWhenVisible);
      window.removeEventListener("pageshow", invalidateWhenVisible);
      window.removeEventListener("orientationchange", invalidateWhenVisible);
    };
  }, [mapReady]);

  useEffect(() => {
    if (!layersOpen && !legendOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setLayersOpen(false);
        setLegendOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (legendOpen) {
        setLegendOpen(false);
        legendButtonRef.current?.focus();
      } else {
        setLayersOpen(false);
        layersButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [layersOpen, legendOpen]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!showTracks) {
      railwayLayerRef.current?.removeFrom(mapRef.current);
      railwayLayerRef.current = null;
      return;
    }
    if (railwayLayerRef.current) {
      if (!selectedTrainActiveRef.current)
        railwayLayerRef.current.addTo(mapRef.current);
      return;
    }
    const controller = new AbortController();
    let disposed = false;
    let layer: LayerGroup | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let idleScheduled = false;
    Promise.all([
      fetch("/data/india-railways.json", { signal: controller.signal }).then(
        (response) =>
          response.ok
            ? response.json()
            : Promise.reject(new Error("Railway network data unavailable")),
      ) as Promise<{ lines: [number, number][][] }>,
      import("leaflet"),
    ])
      .then(([data, L]) => {
        if (disposed || controller.signal.aborted || !mapRef.current) return;
        const renderer = L.canvas({
          pane: "railwayLines",
          padding: 0.5,
          tolerance: 2,
        });
        layer = L.layerGroup();
        if (!selectedTrainActiveRef.current) layer.addTo(mapRef.current);
        railwayLayerRef.current = layer;
        let cursor = 0;
        const renderBatch = (deadline?: IdleDeadline) => {
          idleScheduled = false;
          if (disposed || !layer) return;
          let batchCount = 0;
          while (
            cursor < data.lines.length &&
            batchCount < 1000 &&
            (!deadline || deadline.timeRemaining() > 3 || batchCount === 0)
          ) {
            const next = data.lines.slice(cursor, cursor + 100);
            cursor += next.length;
            batchCount += next.length;
            if (next.length)
              layer.addLayer(
                L.polyline(next, {
                  pane: "railwayLines",
                  renderer,
                  color: "#155f96",
                  weight: 1.7,
                  opacity: 0.75,
                  interactive: false,
                }),
              );
          }
          if (cursor >= data.lines.length || disposed) return;
          if ("requestIdleCallback" in window) {
            idleScheduled = true;
            idleHandle = window.requestIdleCallback(renderBatch, {
              timeout: 300,
            });
          } else {
            timeoutHandle = setTimeout(() => renderBatch(), 0);
          }
        };
        if ("requestIdleCallback" in window) {
          idleScheduled = true;
          idleHandle = window.requestIdleCallback(renderBatch, {
            timeout: 300,
          });
        } else {
          timeoutHandle = setTimeout(() => renderBatch(), 0);
        }
      })
      .catch((reason) => {
        if (!disposed && !controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Railway network data unavailable",
          );
      });
    return () => {
      disposed = true;
      controller.abort();
      if (
        idleScheduled &&
        idleHandle !== null &&
        "cancelIdleCallback" in window
      )
        window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) clearTimeout(timeoutHandle);
      if (layer) {
        layer.remove();
        if (railwayLayerRef.current === layer) railwayLayerRef.current = null;
      }
    };
  }, [mapReady, showTracks]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = railwayLayerRef.current;
    if (!map || !layer) return;
    if (selectedTrain || !showTracks) layer.removeFrom(map);
    else layer.addTo(map);
  }, [selectedTrain, showTracks, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !atlasAccess.ready || !showLiveTrains) return;

    let disposed = false;
    let controller: AbortController | null = null;
    const fetchLiveTrains = async () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      const activeController = new AbortController();
      controller = activeController;
      setLiveMapState("loading");
      try {
        const response = await fetch("/api/rail-atlas/live-trains", {
          signal: activeController.signal,
          cache: "no-store",
        });
        renewRailAtlasSessionOnUnauthorized(response);
        const payload: LiveMapResponse = await response.json();
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Live trains unavailable");
        }
        if (disposed) return;
        setLiveMapTrains(payload.data.trains.filter(hasMappedPosition));
        setLiveMapState(payload.data.stale ? "stale" : "ready");
        setLiveMapError("");
      } catch (reason) {
        if (disposed || activeController.signal.aborted) return;
        setLiveMapState("error");
        setLiveMapError(
          reason instanceof Error ? reason.message : "Live trains unavailable",
        );
      }
    };
    refreshLiveMapRef.current = () => {
      void fetchLiveTrains();
    };
    void fetchLiveTrains();
    document.addEventListener("visibilitychange", fetchLiveTrains);
    const interval = setInterval(fetchLiveTrains, 120_000);
    return () => {
      disposed = true;
      controller?.abort();
      refreshLiveMapRef.current = null;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", fetchLiveTrains);
    };
  }, [mapReady, atlasAccess.ready, showLiveTrains]);

  useEffect(() => {
    const glMap = glMapRef.current;
    if (!mapReady || !glMap) return;
    let disposed = false;
    let installed = false;
    const setup = () => {
      if (disposed || installed || !glMap.getStyle()?.layers?.length) return;
      installed = true;
      glMap.off("styledata", setup);
      glMap.off("load", setup);
      for (const category of LIVE_TRAIN_CATEGORIES) {
        const id = `railkit-train-${category.id}`;
        if (!glMap.hasImage(id))
          glMap.addImage(id, createLiveTrainIcon(category.color), {
            pixelRatio: 2,
          });
      }
      if (!glMap.getSource("railkit-live-trains")) {
        glMap.addSource("railkit-live-trains", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!glMap.getLayer("railkit-live-train-arrows")) {
        glMap.addLayer({
          id: "railkit-live-train-arrows",
          type: "symbol",
          source: "railkit-live-trains",
          layout: {
            "icon-image": ["get", "icon"],
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              0.9,
              8,
              1.1,
              12,
              1.5,
            ],
          },
        });
      }
      setLiveTrainLayerReady(true);
    };
    glMap.on("styledata", setup);
    glMap.on("load", setup);
    setup();
    return () => {
      disposed = true;
      glMap.off("styledata", setup);
      glMap.off("load", setup);
    };
  }, [mapReady]);

  useEffect(() => {
    const glMap = glMapRef.current;
    if (!mapReady || !liveTrainLayerReady || !glMap) return;
    glMap.setLayoutProperty(
      "railkit-live-train-arrows",
      "visibility",
      showLiveTrains ? "visible" : "none",
    );
    const shownTrains =
      focusSelectedTrainOnly && selectedTrain
        ? liveMapTrains.filter(
            (train) =>
              train.trainNo === selectedTrain.trainNo &&
              (!selectedTrain.date || train.journeyDate === selectedTrain.date),
          )
        : liveMapTrains;
    const features = shownTrains.map((train) => {
      const next = train.upcomingStation.code
        ? stationByCode.get(train.upcomingStation.code)
        : undefined;
      const dx = next
        ? (next.lon - train.currentStation.lon) *
          Math.cos((train.currentStation.lat * Math.PI) / 180)
        : 0;
      const dy = next ? next.lat - train.currentStation.lat : 1;
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [train.currentStation.lon, train.currentStation.lat],
        },
        properties: {
          icon: `railkit-train-${liveTrainCategory(train.trainType)}`,
          category: liveTrainCategory(train.trainType),
          trainNo: train.trainNo,
          journeyDate: train.journeyDate,
          bearing: (Math.atan2(dx, dy) * 180) / Math.PI,
        },
      };
    });
    (glMap.getSource("railkit-live-trains") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [
    mapReady,
    liveTrainLayerReady,
    showLiveTrains,
    selectedTrain,
    focusSelectedTrainOnly,
    liveMapTrains,
    stationByCode,
  ]);

  useEffect(() => {
    const glMap = glMapRef.current;
    if (!mapReady || !liveTrainLayerReady || !glMap) return;
    glMap.setFilter("railkit-live-train-arrows", [
      "in",
      ["get", "category"],
      ["literal", visibleTrainCategories],
    ]);
  }, [mapReady, liveTrainLayerReady, visibleTrainCategories]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !showLiveTrains || liveMapTrains.length === 0)
      return;
    const selectTrain = (train: MappedLiveMapTrain) => {
      map.closePopup();
      setSelected(null);
      setSelectedTrain({
        trainNo: train.trainNo,
        trainName: train.trainName,
        date: train.journeyDate,
      });
    };
    const trainsAt = (x: number, y: number) => {
      return liveMapTrains.filter((train) => {
        if (
          focusSelectedTrainOnly &&
          selectedTrain &&
          (train.trainNo !== selectedTrain.trainNo ||
            (selectedTrain.date && train.journeyDate !== selectedTrain.date))
        )
          return false;
        if (!visibleTrainCategorySet.has(liveTrainCategory(train.trainType)))
          return false;
        const point = map.latLngToContainerPoint([
          train.currentStation.lat,
          train.currentStation.lon,
        ]);
        return (
          Math.abs(point.x - x) <= 10 &&
          Math.abs(point.y - y) <= 10 &&
          Math.hypot(point.x - x, point.y - y) <= 10
        );
      });
    };
    liveTrainHitTestRef.current = (x, y) => trainsAt(x, y)[0] || null;
    const handleClick = (event: LeafletMouseEvent) => {
      const matches = trainsAt(event.containerPoint.x, event.containerPoint.y);
      if (matches.length === 0) return;
      if (matches.length === 1) {
        selectTrain(matches[0]);
        return;
      }
      void import("leaflet").then((L) => {
        const list = document.createElement("div");
        list.className = "max-h-60 min-w-48 overflow-y-auto";
        for (const train of matches) {
          const button = document.createElement("button");
          button.type = "button";
          button.className =
            "block min-h-11 w-full rounded px-2 py-1 text-left text-sm hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700";
          button.textContent = `${train.trainNo} · ${train.trainName || train.trainType || "Train"}`;
          button.addEventListener("click", () => selectTrain(train));
          list.append(button);
        }
        L.popup({ maxWidth: 280 })
          .setLatLng(event.latlng)
          .setContent(list)
          .openOn(map);
      });
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
      liveTrainHitTestRef.current = null;
    };
  }, [
    mapReady,
    showLiveTrains,
    liveMapTrains,
    visibleTrainCategorySet,
    focusSelectedTrainOnly,
    selectedTrain,
  ]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!showStations || selectedTrain || stations.length === 0) {
      stationLayerRef.current?.removeFrom(mapRef.current);
      stationLayerRef.current = null;
      return;
    }
    const map = mapRef.current;
    let cancelled = false;
    let cleanupVisibleStations: (() => void) | undefined;
    import("leaflet")
      .then((L) => {
        if (cancelled || mapRef.current !== map) return;
        const renderer = L.canvas({
          pane: "stationMarkers",
          padding: 0.2,
          tolerance: 9,
        });
        const layer = L.layerGroup().addTo(map);
        const markers = new Map<string, CircleMarker>();
        let syncFrame = 0;
        stationLayerRef.current = layer;

        const syncVisibleStations = () => {
          const bounds = map.getBounds().pad(0.08);
          const candidates = stationsInBounds(
            stationGrid,
            bounds.getSouth(),
            bounds.getWest(),
            bounds.getNorth(),
            bounds.getEast(),
          );
          const visibleCodes = new Set(
            candidates.map((station) => station.code),
          );
          for (const [code, marker] of markers) {
            if (visibleCodes.has(code)) continue;
            layer.removeLayer(marker);
            markers.delete(code);
          }
          for (const station of candidates) {
            if (markers.has(station.code)) continue;
            const marker = L.circleMarker([station.lat, station.lon], {
              pane: "stationMarkers",
              renderer,
              radius: getStationMarkerRadius(map.getZoom()),
              weight: 0.8,
              color: "#475569",
              fillColor: "#cbd5e1",
              fillOpacity: 0.76,
              opacity: 0.72,
              interactive: false,
              bubblingMouseEvents: false,
            }).addTo(layer);
            markers.set(station.code, marker);
          }
        };
        const scheduleVisibleStationSync = () => {
          if (syncFrame) return;
          syncFrame = window.requestAnimationFrame(() => {
            syncFrame = 0;
            syncVisibleStations();
          });
        };

        syncVisibleStations();
        map.on("moveend zoomend", scheduleVisibleStationSync);
        cleanupVisibleStations = () => {
          map.off("moveend zoomend", scheduleVisibleStationSync);
          if (syncFrame) window.cancelAnimationFrame(syncFrame);
          layer.removeFrom(map);
          markers.clear();
          if (stationLayerRef.current === layer) stationLayerRef.current = null;
        };
      })
      .catch(() => {
        if (!cancelled) setError("Station markers unavailable");
      });
    return () => {
      cancelled = true;
      cleanupVisibleStations?.();
    };
  }, [mapReady, selectedTrain, showStations, stations, stationGrid]);

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      (!showStations && !showLiveTrains) ||
      (showStations && stations.length === 0 && liveMapTrains.length === 0)
    )
      return;
    const map = mapRef.current;
    let cancelled = false;
    let cleanupInteraction: (() => void) | undefined;
    import("leaflet").then((L) => {
      if (cancelled || mapRef.current !== map) return;
      let hoverTooltip: ReturnType<typeof L.tooltip> | null = null;
      const findNearest = (event: LeafletMouseEvent, tolerance: number) => {
        const clickPoint = event.containerPoint;
        const cornerA = map.containerPointToLatLng(
          clickPoint.subtract([tolerance, tolerance]),
        );
        const cornerB = map.containerPointToLatLng(
          clickPoint.add([tolerance, tolerance]),
        );
        const candidates = stationsInBounds(
          stationGrid,
          Math.min(cornerA.lat, cornerB.lat),
          Math.min(cornerA.lng, cornerB.lng),
          Math.max(cornerA.lat, cornerB.lat),
          Math.max(cornerA.lng, cornerB.lng),
        );
        let nearest: Station | null = null;
        let nearestDistance = tolerance;
        for (const station of candidates) {
          const stationPoint = map.latLngToContainerPoint([
            station.lat,
            station.lon,
          ]);
          const distance = clickPoint.distanceTo(stationPoint);
          if (distance < nearestDistance) {
            nearest = station;
            nearestDistance = distance;
          }
        }
        return nearest;
      };
      let moveFrame = 0;
      let latestMove: LeafletMouseEvent | null = null;
      const handleMapMove = (event: LeafletMouseEvent) => {
        latestMove = event;
        if (moveFrame) return;
        moveFrame = window.requestAnimationFrame(() => {
          moveFrame = 0;
          if (!latestMove) return;
          const train = showLiveTrains
            ? liveTrainHitTestRef.current?.(
                latestMove.containerPoint.x,
                latestMove.containerPoint.y,
              )
            : null;
          const nearest = !train && showStations ? findNearest(latestMove, 16) : null;
          map.getContainer().style.cursor = train || nearest ? "pointer" : "";
          if (!train && !nearest) {
            if (hoverTooltip) {
              map.removeLayer(hoverTooltip);
              hoverTooltip = null;
            }
            return;
          }
          if (!hoverTooltip)
            hoverTooltip = L.tooltip({
              direction: "top",
              offset: [0, -10],
              opacity: 0.96,
            });
          hoverTooltip
            .setContent(
              train
                ? `${train.trainNo} - ${train.trainName || "Train"}`
                : nearest!.code,
            )
            .setLatLng(
              train
                ? [train.currentStation.lat, train.currentStation.lon]
                : [nearest!.lat, nearest!.lon],
            );
          if (!map.hasLayer(hoverTooltip)) hoverTooltip.addTo(map);
        });
      };
      const handleMapClick = (event: LeafletMouseEvent) => {
        if (
          selectedTrain ||
          liveTrainHitTestRef.current?.(
            event.containerPoint.x,
            event.containerPoint.y,
          )
        )
          return;
        if (!showStations) return;
        const nearest = findNearest(event, 22);
        if (nearest) setSelected(nearest);
      };
      map.on("mousemove", handleMapMove);
      map.on("click", handleMapClick);
      const handleMapOut = () => {
        map.getContainer().style.cursor = "";
        if (hoverTooltip) {
          map.removeLayer(hoverTooltip);
          hoverTooltip = null;
        }
      };
      map.on("mouseout", handleMapOut);
      cleanupInteraction = () => {
        map.off("mousemove", handleMapMove);
        map.off("click", handleMapClick);
        map.off("mouseout", handleMapOut);
        if (moveFrame) window.cancelAnimationFrame(moveFrame);
        map.getContainer().style.cursor = "";
        if (hoverTooltip) map.removeLayer(hoverTooltip);
      };
    });
    return () => {
      cancelled = true;
      cleanupInteraction?.();
    };
  }, [
    mapReady,
    selectedTrain,
    showStations,
    showLiveTrains,
    liveMapTrains,
    visibleTrainCategorySet,
    focusSelectedTrainOnly,
    stationGrid,
    stations,
  ]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!showStations || !selected) {
      selectedLayerRef.current?.removeFrom(mapRef.current);
      return;
    }
    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !mapRef.current) return;
        selectedLayerRef.current?.removeFrom(mapRef.current);
        const ring = L.circleMarker([selected.lat, selected.lon], {
          pane: "selectedStation",
          radius: 7,
          weight: 1.5,
          color: "#ffffff",
          fillColor: "#1769aa",
          fillOpacity: 0.95,
          interactive: false,
        });
        ring.bindTooltip(selected.code, {
          permanent: true,
          direction: "top",
          offset: [0, -12],
        });
        selectedLayerRef.current = L.layerGroup([ring]).addTo(mapRef.current);
        const targetZoom = Math.max(mapRef.current.getZoom(), 8);
        mapRef.current.flyTo([selected.lat, selected.lon], targetZoom, {
          duration: 0.55,
        });
      })
      .catch(() => {
        if (!cancelled) setError("Selected station marker unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [mapReady, selected, showStations]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    trainLayerRef.current?.removeFrom(mapRef.current);
    trainLayerRef.current = null;
    if (!selectedTrain) focusedTrainRef.current = "";
    if (!selectedTrain || !trainLive.data) return;
    let cancelled = false;
    import("leaflet")
      .then((L) => {
        if (cancelled || !mapRef.current || !trainLive.data) return;
        const data = trainLive.data;
        const route = getStraightTrainRoute(data);
        const isFullyCancelled = Boolean(
          data.statusNote && /\bcancel(?:led|lation)?\b/i.test(data.statusNote),
        );
        const layers: Layer[] = [];
        if (route.length > 1) {
          layers.push(
            L.polyline(route, {
              pane: "activeTrain",
              color: isFullyCancelled ? "#94a3b8" : "#cbd5e1",
              weight: 2.5,
              opacity: isFullyCancelled ? 0.6 : 0.8,
              dashArray: isFullyCancelled ? "7 7" : undefined,
              interactive: false,
            }),
          );
        }
        data.timeline
          .filter(
            (stop) =>
              stop.type !== "intermediate" &&
              Number.isFinite(stop.lat) &&
              Number.isFinite(stop.lon),
          )
          .filter(
            (stop) =>
              stop.stationCode !== data.start?.stationCode &&
              stop.stationCode !== data.end?.stationCode,
          )
          .forEach((stop) => {
            const stopCancelled =
              isFullyCancelled || isCancelledScheduleStop(stop);
            layers.push(
              L.circleMarker([stop.lat!, stop.lon!], {
                pane: "activeTrain",
                radius: 3.5,
                color: stopCancelled ? "#fecaca" : "#e2e8f0",
                weight: 2,
                fillColor: stopCancelled ? "#dc2626" : "#1e293b",
                fillOpacity: 1,
                bubblingMouseEvents: false,
              }).bindTooltip(
                `${stop.stationName || stop.stationCode} (${stop.stationCode})`,
                { direction: "top" },
              ),
            );
          });
        if (data.start)
          layers.push(
            L.circleMarker([data.start.lat, data.start.lon], {
              pane: "activeTrain",
              radius: 7,
              color: "#ffffff",
              weight: 2,
              fillColor: isFullyCancelled ? "#64748b" : "#059669",
              fillOpacity: 1,
              interactive: false,
            }).bindTooltip(`Start · ${data.start.stationCode}`, {
              direction: "top",
            }),
          );
        if (data.end)
          layers.push(
            L.circleMarker([data.end.lat, data.end.lon], {
              pane: "activeTrain",
              radius: 7,
              color: "#ffffff",
              weight: 2,
              fillColor: isFullyCancelled ? "#64748b" : "#7c3aed",
              fillOpacity: 1,
              interactive: false,
            }).bindTooltip(`End · ${data.end.stationCode}`, {
              direction: "top",
            }),
          );
        if (data.currentPosition && !isFullyCancelled) {
          const rotation = Number.isFinite(data.currentPosition.bearing)
            ? data.currentPosition.bearing
            : 0;
          const icon = L.divIcon({
            className: "",
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            html: `<div style="width:34px;height:34px;display:grid;place-items:center;border:2px solid ${selectedTrainAccentRef.current};border-radius:50%;background:${selectedTrainAccentRef.current};box-shadow:0 0 0 5px color-mix(in srgb, ${selectedTrainAccentRef.current} 24%, transparent),0 6px 18px rgba(0,0,0,.45);transform:rotate(${rotation}deg)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 20 21l-8-4-8 4 8-19Z" fill="white"/></svg></div>`,
          });
          layers.push(
            L.marker([data.currentPosition.lat, data.currentPosition.lon], {
              pane: "activeTrain",
              icon,
              interactive: false,
              zIndexOffset: 1000,
            }),
          );
        }
        trainLayerRef.current = L.layerGroup(layers).addTo(mapRef.current);
        const focusKey = `${selectedTrain.trainNo}:${selectedTrain.date || ""}`;
        if (focusedTrainRef.current !== focusKey) {
          focusedTrainRef.current = focusKey;
          if (route.length > 1) focusTrainRouteOnMap(mapRef.current, route);
          else if (data.currentPosition)
            focusTrainOnMap(
              mapRef.current,
              data.currentPosition.lat,
              data.currentPosition.lon,
            );
        }
      })
      .catch(() => {
        if (!cancelled) setError("Live train route could not be displayed");
      });
    return () => {
      cancelled = true;
    };
  }, [mapReady, selectedTrain, trainLive.data]);

  const chooseSearchStation = (
    result: GlobalSearchResult["stations"][number],
  ) => {
    const station =
      stations.find((item) => item.code === result.code) ||
      (isMappedStation(result) ? result : null);
    if (!station) return;
    setSelectedTrain(null);
    setFocusSelectedTrainOnly(false);
    setSelected(station);
    setQuery("");
  };

  const chooseTrain = (train: TrainSelection) => {
    setSelected(null);
    setFocusSelectedTrainOnly(false);
    setSelectedTrain(train);
    setQuery("");
  };

  const focusSelectedTrain = () => {
    const nextFocused = !focusSelectedTrainOnly;
    setFocusSelectedTrainOnly(nextFocused);
    if (!nextFocused || !mapRef.current || !trainLive.data) return;
    const route = getStraightTrainRoute(trainLive.data);
    if (route.length > 1) focusTrainRouteOnMap(mapRef.current, route);
    else if (trainLive.data.currentPosition) {
      focusTrainOnMap(
        mapRef.current,
        trainLive.data.currentPosition.lat,
        trainLive.data.currentPosition.lon,
      );
    }
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-[#0b0e14] text-slate-100">
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setTurnstileScriptReady(true)}
        />
      ) : null}
      <div
        ref={atlasAccess.containerRef}
        className="hidden"
        aria-hidden="true"
      />
      <h1 className="sr-only">
        Rail Atlas: Indian railway map, stations and live trains
      </h1>
      <p className="sr-only">
        Search Indian railway stations and trains, explore the track network,
        check upcoming trains at a station, and view a train&apos;s latest
        reported position and route.
      </p>
      <section
        className="absolute inset-0"
        aria-label="Indian railway network map"
      >
        <div ref={mapNodeRef} className="absolute inset-0 bg-[#0b0e14]" />
      </section>

      {showLiveTrains && !selectedTrain ? (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          title={liveMapError || undefined}
          className="absolute top-3 right-3 z-[900] max-w-[45vw] rounded-2xl border border-slate-600/70 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-xl backdrop-blur-xl"
        >
          {liveMapTrains.length.toLocaleString("en-IN")} trains mapped
        </div>
      ) : null}

      <div
        className={`absolute top-3 left-3 z-[1000] w-[min(480px,calc(100%-1.5rem))] ${selectedTrain ? "lg:left-[calc(390px+1rem)]" : ""}`}
      >
        <div className="rounded-2xl border border-slate-600/70 bg-slate-950/90 p-1.5 text-slate-100 shadow-xl backdrop-blur-xl transition-colors focus-within:border-sky-500/70 focus-within:ring-2 focus-within:ring-sky-400/20">
          <div className="flex h-11 items-center gap-2 px-1">
            <label className="flex min-w-0 flex-1 cursor-text items-center gap-3">
              <Search
                className="ml-1 shrink-0 text-slate-300"
                size={18}
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <span className="sr-only">
                Search station name, train name or number
              </span>
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setQuery("");
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-100 outline-none placeholder:font-normal placeholder:text-slate-400"
                placeholder={
                  selectedTrain
                    ? "Search another train or station"
                    : "Search train, station, or route…"
                }
                autoComplete="off"
              />
            </label>
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                aria-label="Clear search"
              >
                <X size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        {query.trim().length >= 2 ? (
          <div
            id="rail-atlas-search-results"
            className="mt-2 max-h-[min(60dvh,460px)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl"
            aria-busy={globalSearch.loading}
          >
            {globalSearch.loading ? (
              <div
                role="status"
                aria-label="Searching stations and trains"
                className="space-y-2 p-3"
              >
                <span className="sr-only">Searching stations and trains…</span>
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="flex h-12 items-center gap-3 rounded-lg px-2"
                  >
                    <span className="size-8 shrink-0 animate-pulse rounded-md bg-slate-700 motion-reduce:animate-none" />
                    <span
                      className="h-3.5 animate-pulse rounded bg-slate-700 motion-reduce:animate-none"
                      style={{ width: `${65 - index * 12}%` }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {!globalSearch.loading && globalSearch.error ? (
              <p className="px-4 py-3 text-sm text-red-300">
                {globalSearch.error}
              </p>
            ) : null}
            {!globalSearch.loading &&
            !globalSearch.error &&
            globalSearch.results.stations.length === 0 &&
            globalSearch.results.trains.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">
                No stations or trains found.
              </p>
            ) : null}
            {!globalSearch.loading &&
            !globalSearch.error &&
            globalSearch.results.stations.length > 0 ? (
              <div className="border-b border-slate-700 p-2">
                <p className="px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
                  Stations
                </p>
                {globalSearch.results.stations.map((station) => (
                  <button
                    key={station.code}
                    type="button"
                    onClick={() => chooseSearchStation(station)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-800 font-site-code text-[10px] font-bold text-white">
                      {station.code}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm text-slate-100">
                        {station.name}
                      </strong>
                      <small className="block text-xs text-slate-400">
                        Open station details
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {!globalSearch.loading &&
            !globalSearch.error &&
            globalSearch.results.trains.length > 0 ? (
              <div className="p-2">
                <p className="px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
                  Trains
                </p>
                {globalSearch.results.trains.map((train) => (
                  <button
                    type="button"
                    onClick={() => chooseTrain(train)}
                    key={train.trainNo}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"
                  >
                    <span className="font-site-code text-xs font-bold text-sky-300">
                      {train.trainNo}
                    </span>
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {train.trainName}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold text-slate-400">
                      Track
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        ref={controlsRef}
        className={`absolute right-3 bottom-4 z-[900] ${selectedTrain ? "hidden lg:block" : ""}`}
        aria-label="Map controls"
      >
        <div className="flex w-14 flex-col gap-1 rounded-2xl border border-slate-600/70 bg-slate-950/90 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            disabled={!mapReady || mapZoom >= 18}
            aria-label="Zoom in"
            title="Zoom in"
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-200 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            disabled={!mapReady || mapZoom <= minMapZoom + 0.01}
            aria-label="Zoom out"
            title="Zoom out"
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-200 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <Minus size={20} strokeWidth={2} aria-hidden="true" />
          </button>
          <span className="mx-2 border-t border-slate-700" aria-hidden="true" />
          <button
            ref={layersButtonRef}
            type="button"
            onClick={() => {
              setLayersOpen((open) => !open);
              setLegendOpen(false);
            }}
            aria-label="Map layers"
            aria-expanded={layersOpen}
            aria-controls={layersOpen ? "rail-atlas-layer-options" : undefined}
            title="Map layers"
            className={`grid size-11 cursor-pointer place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${layersOpen ? "bg-sky-500/20 text-sky-300" : "text-slate-200 hover:bg-slate-700 hover:text-white"}`}
          >
            <Layers3 size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            ref={legendButtonRef}
            type="button"
            onClick={() => {
              setLegendOpen((open) => !open);
              setLayersOpen(false);
            }}
            aria-label="Train legend"
            aria-expanded={legendOpen}
            aria-controls={legendOpen ? "rail-atlas-train-legend" : undefined}
            title="Train legend"
            className={`grid size-11 cursor-pointer place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${legendOpen ? "bg-sky-500/20 text-sky-300" : "text-slate-200 hover:bg-slate-700 hover:text-white"}`}
          >
            <ListFilter size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
          {selectedTrain ? (
            <button
              type="button"
              onClick={focusSelectedTrain}
              disabled={
                !trainLive.data?.currentPosition &&
                !trainLive.data?.route?.length
              }
              aria-label={
                focusSelectedTrainOnly
                  ? "Show all trains"
                  : "Focus selected train only"
              }
              title={
                focusSelectedTrainOnly
                  ? "Show all trains"
                  : "Focus selected train only"
              }
              aria-pressed={focusSelectedTrainOnly}
              className={`grid size-11 cursor-pointer place-items-center rounded-xl transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${focusSelectedTrainOnly ? "bg-sky-500/20 text-sky-300" : "text-slate-200"}`}
            >
              <Focus size={19} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
          <span className="mx-2 border-t border-slate-700" aria-hidden="true" />
          <button
            type="button"
            onClick={() => refreshLiveMapRef.current?.()}
            disabled={
              !showLiveTrains ||
              liveMapState === "loading" ||
              !atlasAccess.ready
            }
            aria-label="Refresh live trains"
            title="Refresh live trains"
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-200 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <RefreshCw
              size={18}
              strokeWidth={1.8}
              className={
                liveMapState === "loading"
                  ? "animate-spin motion-reduce:animate-none"
                  : ""
              }
              aria-hidden="true"
            />
          </button>
          <Link
            href="/"
            aria-label="Back to RailKit site"
            title="Back to site"
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-200 no-underline transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            <House size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
        {layersOpen ? (
          <div
            id="rail-atlas-layer-options"
            className="absolute right-[calc(100%+0.75rem)] bottom-0 w-56 rounded-2xl border border-slate-700 bg-slate-950/95 p-2 text-slate-100 shadow-2xl backdrop-blur-xl"
            aria-label="Map layers"
          >
            <p className="border-b border-slate-700 px-2 pt-1 pb-2 text-sm font-semibold">
              Map layers
            </p>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-800">
              <span className="flex items-center gap-2">
                <i
                  className="size-2 rounded-full bg-amber-500"
                  aria-hidden="true"
                />{" "}
                Stations
              </span>
              <input
                className="size-4 accent-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                type="checkbox"
                checked={showStations}
                onChange={(event) => {
                  setShowStations(event.target.checked);
                  if (event.target.checked) setShowLiveTrains(false);
                }}
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-800">
              <span className="flex items-center gap-2">
                <i className="h-[3px] w-5 bg-sky-400" aria-hidden="true" />{" "}
                Railway tracks
              </span>
              <input
                className="size-4 accent-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                type="checkbox"
                checked={showTracks}
                onChange={(event) => {
                  setShowTracks(event.target.checked);
                  if (event.target.checked) setShowLiveTrains(false);
                }}
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-800">
              <span className="flex items-center gap-2">
                <i
                  className="size-2 rounded-full bg-emerald-400"
                  aria-hidden="true"
                />{" "}
                Live trains
              </span>
              <input
                className="size-4 accent-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                type="checkbox"
                checked={showLiveTrains}
                onChange={(event) => {
                  setShowLiveTrains(event.target.checked);
                  if (event.target.checked) {
                    setShowStations(false);
                    setShowTracks(false);
                  }
                }}
              />
            </label>
          </div>
        ) : null}
        {legendOpen ? (
          <div
            id="rail-atlas-train-legend"
            className="absolute right-[calc(100%+0.75rem)] bottom-0 w-[min(280px,calc(100vw-5.5rem))] max-h-[min(75dvh,540px)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/95 p-3 text-slate-100 shadow-2xl backdrop-blur-xl"
            aria-label="Train legend"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-1 pb-2">
              <h2 className="text-sm font-semibold">Map Details</h2>
              <button
                type="button"
                onClick={() =>
                  setVisibleTrainCategories(
                    visibleTrainCategories.length
                      ? []
                      : ALL_LIVE_TRAIN_CATEGORIES,
                  )
                }
                className="min-h-11 cursor-pointer rounded-md px-2 text-xs font-semibold text-sky-400 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                {visibleTrainCategories.length ? "Hide All" : "Show All"}
              </button>
            </div>
            <div className="pt-1">
              {LIVE_TRAIN_CATEGORIES.map((category) => {
                const active = visibleTrainCategorySet.has(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setVisibleTrainCategories((current) =>
                        current.includes(category.id)
                          ? current.filter((id) => id !== category.id)
                          : [...current, category.id],
                      )
                    }
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 text-left text-[13px] transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${active ? "text-slate-100" : "text-slate-500"}`}
                  >
                    <Check
                      size={15}
                      strokeWidth={2}
                      className={`shrink-0 ${active ? "opacity-100" : "opacity-0"}`}
                      aria-hidden="true"
                    />
                    <i
                      className={`size-3.5 shrink-0 rounded-full ${active ? "opacity-100" : "opacity-40"}`}
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {category.label}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-site-code text-[11px] tabular-nums text-slate-400">
                      {liveTrainCounts[category.id].toLocaleString("en-IN")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <StationDetailsPanel
          station={selected}
          board={stationBoard.board}
          hours={stationBoard.hours}
          loading={stationBoard.loading}
          error={stationBoard.error}
          onClose={() => setSelected(null)}
          onRetry={stationBoard.retry}
          onSelectTrain={(train) =>
            chooseTrain({
              trainNo: train.trainNo,
              trainName: train.trainName,
              date: train.runDate,
            })
          }
        />
      ) : null}
      {selectedTrain ? (
        <TrainDetailsPanel
          selection={selectedTrain}
          trainType={selectedTrainType}
          data={trainLive.data}
          loading={trainLive.loading}
          refreshing={trainLive.refreshing}
          error={trainLive.error}
          refreshError={trainLive.refreshError}
          focusOnly={focusSelectedTrainOnly}
          onFocusTrain={focusSelectedTrain}
          onClose={() => {
            setSelectedTrain(null);
            setFocusSelectedTrainOnly(false);
          }}
          onRetry={trainLive.retry}
        />
      ) : null}

      {atlasAccess.error ? (
        <div
          role="alert"
          className="absolute right-3 bottom-3 left-3 z-[1100] mx-auto max-w-lg rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          <p>{atlasAccess.error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 min-h-9 cursor-pointer rounded-lg bg-red-800 px-3 py-1.5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
          >
            Retry security check
          </button>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="absolute right-3 bottom-3 left-3 z-[1000] mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
        >
          {error}. Run npm run update:station-data if the station file is
          missing.
        </div>
      ) : null}
    </main>
  );
}
