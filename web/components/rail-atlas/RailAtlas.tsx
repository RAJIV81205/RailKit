"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CircleMarker, Layer, LayerGroup, Map as LeafletMap } from "leaflet";
import { ChevronDown, Clock3, Layers3, Navigation, RefreshCw, Search, TrainFront, X } from "lucide-react";

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
  arrival: { actual: string; scheduled: string; delay: string; delayed?: boolean };
  departure: { actual: string; scheduled: string; delay: string; delayed?: boolean };
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
  stations: Array<{ code: string; name: string; lat: number | null; lon: number | null }>;
  trains: Array<{ trainNo: string; trainName: string }>;
};

type GlobalSearchResponse = {
  success: boolean;
  data?: GlobalSearchResult;
  error?: string;
};

type TrainSelection = { trainNo: string; trainName: string; date?: string };

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
  progress: { journeyStatus: string; percent: number; currentStationIndex?: number | null; totalStations?: number; passedStations?: number; remainingStations: number; currentDistanceKm?: number | null; distanceRemainingKm: number | null } | null;
  totalDistanceKm: number | null;
  averageSpeedKmph: number | null;
  start: { stationCode: string; stationName?: string; lat: number; lon: number } | null;
  end: { stationCode: string; stationName?: string; lat: number; lon: number } | null;
  currentPosition: { lat: number; lon: number; stationCode: string; stationName: string; bearing: number } | null;
  route: [number, number][];
  timeline: TrainTimelineItem[];
};

type TrainLiveResponse = { success: boolean; data?: TrainLiveData; error?: string };

type TrainScheduleGroup = {
  key: string;
  stop: TrainTimelineItem;
  intermediates: TrainTimelineItem[];
  nextStop?: TrainTimelineItem;
};

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
  if (!normalized || ["SRC", "DSTN", "UA", "NA", "N/A", "UNAVAILABLE"].includes(status)) return "--";
  return normalized.match(/\b\d{1,2}:\d{2}\b/)?.[0] || normalized;
}

function isCancelledScheduleValue(value?: string) {
  return /^cancel(?:led)?$/i.test(String(value || "").trim());
}

function isCancelledScheduleStop(stop: TrainTimelineItem) {
  return /cancel/i.test(String(stop.status || ""))
    || isCancelledScheduleValue(stop.arrival?.actual)
    || isCancelledScheduleValue(stop.departure?.actual);
}

const INDIA_MAP_BOUNDS: [[number, number], [number, number]] = [
  [6, 68],
  [38, 98],
];

function getStationMarkerRadius(zoom: number) {
  if (zoom >= 13) return 7;
  if (zoom >= 10) return 5.5;
  if (zoom >= 7) return 4;
  return 2.25;
}

function isMappedStation(station: StationRecord): station is Station {
  return Number.isFinite(station.lat) && Number.isFinite(station.lon)
    && station.lat! >= 6 && station.lat! <= 38
    && station.lon! >= 68 && station.lon! <= 98;
}

function useStationBoard(station: Station | null) {
  const [board, setBoard] = useState<StationBoard | null>(null);
  const [hours, setHours] = useState<4 | 8>(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!station) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError("");
      setBoard(null);
      setHours(4);
    });

    const fetchBoard = async (windowHours: 4 | 8) => {
      const response = await fetch(`/api/rail-atlas/station-live?code=${encodeURIComponent(station.code)}&hours=${windowHours}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json() as StationBoardResponse;
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || "Upcoming trains are unavailable.");
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
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Upcoming trains are unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refresh, station]);

  return { board, hours, loading, error, retry: () => setRefresh((value) => value + 1) };
}

function useGlobalSearch(query: string) {
  const [results, setResults] = useState<GlobalSearchResult>({ stations: [], trains: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      const clearTimer = window.setTimeout(() => {
        setResults({ stations: [], trains: [] });
        setLoading(false);
        setError("");
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/rail-atlas/search?q=${encodeURIComponent(value)}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json() as GlobalSearchResponse;
          if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || "Search is unavailable.");
          return payload.data;
        })
        .then((data) => {
          if (!controller.signal.aborted) setResults(data);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setResults({ stations: [], trains: [] });
            setError(reason instanceof Error ? reason.message : "Search is unavailable.");
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
  }, [query]);

  return { results, loading, error };
}

function useTrainLive(selection: TrainSelection | null) {
  const [data, setData] = useState<TrainLiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setData(null);
      setError("");
      setLoading(true);
    });
    const params = new URLSearchParams({ trainNo: selection.trainNo });
    if (selection.date) params.set("date", selection.date);
    fetch(`/api/rail-atlas/train-live?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as TrainLiveResponse;
        if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || "Live train data is unavailable.");
        return payload.data;
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Live train data is unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh, selection]);

  return { data, loading, error, retry: () => setRefresh((value) => value + 1) };
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
    <aside className="absolute right-3 bottom-3 left-3 z-[950] flex h-[42dvh] min-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:top-16 lg:left-auto lg:h-auto lg:min-h-0 lg:w-[min(410px,calc(100%-1.5rem))]" aria-label={`${station.name} station details`}>
      <header className="border-b border-slate-200 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 font-site-code text-xs font-bold text-white">{station.code}</span>
              <h2 className="truncate text-lg font-bold tracking-tight" title={station.name}>{station.name}</h2>
            </div>
            <p className="mt-1 font-site-code text-xs text-slate-500">Station · {station.lat.toFixed(4)}, {station.lon.toFixed(4)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700" aria-label="Close station details"><X size={18} /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold"><Clock3 size={16} aria-hidden="true" /> Upcoming trains</h3>
            <p className="mt-0.5 text-xs text-slate-500">Next {hours} hours</p>
          </div>
          {board ? <span className="rounded-full bg-blue-50 px-2.5 py-1 font-site-code text-xs font-bold text-blue-700">{board.totalTrains}</span> : null}
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div><RefreshCw className="mx-auto animate-spin text-blue-700" size={22} aria-hidden="true" /><p className="mt-3 text-sm text-slate-600">Checking the next 4 hours…</p></div>
          </div>
        ) : null}

        {error ? (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-red-800 px-3 py-2 font-semibold text-white transition-colors hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">Try again</button>
          </div>
        ) : null}

        {!loading && !error && board?.trains.length === 0 ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div><TrainFront className="mx-auto text-slate-400" size={26} aria-hidden="true" /><p className="mt-3 font-semibold text-slate-800">No upcoming trains</p><p className="mt-1 text-sm text-slate-500">No trains were found in the next 8 hours.</p></div>
          </div>
        ) : null}

        {board && board.trains.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-2">
            {board.trains.map((train) => {
              const cancelled = train.cancelled === true || (typeof train.cancelled === "string" && !["", "false", "null"].includes(train.cancelled.toLowerCase()));
              const arrival = train.arrival?.actual || train.arrival?.scheduled || "—";
              const departure = train.departure?.actual || train.departure?.scheduled || "—";
              return (
                <button type="button" onClick={() => onSelectTrain(train)} key={`${train.trainNo}-${train.runDate}-${train.arrival?.scheduled}-${train.departure?.scheduled}`} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-blue-700">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <p className="shrink-0 font-site-code text-xs font-bold text-blue-700">{train.trainNo}</p>
                        <h4 className="truncate text-sm font-bold text-slate-900" title={train.trainName}>{train.trainName}</h4>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-600" title={`${train.sourceName} to ${train.destName}`}>{train.source} · {train.sourceName} → {train.dest} · {train.destName}</p>
                    </div>
                    {cancelled ? <span className="max-w-24 shrink-0 truncate whitespace-nowrap rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-800">Cancelled</span> : train.departure?.delayed || train.arrival?.delayed ? <span className="max-w-24 shrink-0 truncate whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">{train.departure?.delay || train.arrival?.delay}</span> : <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">On time</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200 rounded-lg bg-slate-50 px-2 py-1.5">
                    <div className="min-w-0 pr-2"><span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Arr</span><strong className="block truncate font-site-code text-sm text-slate-900">{cancelled ? "—" : arrival}</strong></div>
                    <div className="min-w-0 px-2"><span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Dep</span><strong className="block truncate font-site-code text-sm text-slate-900">{cancelled ? "—" : departure}</strong></div>
                    <div className="min-w-0 pl-2"><span className="block text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Platform</span><strong className="block truncate font-site-code text-sm text-slate-900">{train.platform || "—"}</strong></div>
                  </div>
                  {train.classes ? <p className="mt-1.5 truncate text-xs text-slate-500" title={train.classes}>Coaches · {train.classes}</p> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function TrainDetailsPanel({ selection, data, loading, error, onClose, onRetry }: {
  selection: TrainSelection;
  data: TrainLiveData | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const progress = data?.progress;
  const scheduleRef = useRef<HTMLOListElement>(null);
  const scheduleGroups = useMemo(() => groupTrainSchedule(data?.timeline || []), [data]);
  const cancellationNote = useMemo(() => {
    const cancelledStops = scheduleGroups.map((group) => group.stop).filter(isCancelledScheduleStop);
    if (cancelledStops.length === 0) return "";
    const first = cancelledStops[0];
    const last = cancelledStops.at(-1)!;
    if (cancelledStops.length === 1) return `${first.stationName || first.stationCode} is marked cancelled in this schedule.`;
    return `${cancelledStops.length} stops are marked cancelled from ${first.stationName || first.stationCode} to ${last.stationName || last.stationCode}.`;
  }, [scheduleGroups]);
  const currentSegmentKey = useMemo(() => scheduleGroups.find((group) => group.intermediates.some((stop) => stop.status === "current" || stop.stationCode === data?.currentPosition?.stationCode))?.key, [data?.currentPosition?.stationCode, scheduleGroups]);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data?.timeline.length) return;
    const initialSegments = currentSegmentKey ? new Set([currentSegmentKey]) : new Set<string>();
    let frame = 0;
    queueMicrotask(() => {
      setExpandedSegments(initialSegments);
      frame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        scheduleRef.current?.querySelector<HTMLElement>('[aria-current="location"]')?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentSegmentKey, data]);

  const toggleSegment = (key: string) => {
    setExpandedSegments((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside className="absolute right-3 bottom-3 left-3 z-[950] flex h-[78dvh] min-h-80 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 shadow-[0_24px_70px_rgba(15,23,42,0.28)] lg:top-16 lg:left-auto lg:h-auto lg:w-[min(480px,calc(100%-1.5rem))]" aria-label={`${selection.trainName} live train details`}>
      <header className="border-b border-slate-200 bg-white px-4 pt-4 pb-3 text-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="rounded-md bg-blue-700 px-2 py-1 font-site-code text-xs font-black text-white">{selection.trainNo}</span><span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-emerald-700 uppercase"><i className="size-1.5 rounded-full bg-emerald-500" /> Live run</span></div>
            <h2 className="mt-2 truncate text-lg font-bold tracking-tight">{data?.trainName || selection.trainName}</h2>
            <p className="mt-1 text-xs text-slate-500">{data?.start?.stationCode && data?.end?.stationCode ? `${data.start.stationCode} → ${data.end.stationCode} · ` : ""}{data?.date || selection.date || "today"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={onRetry} disabled={loading} className="flex h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" aria-label="Refresh live train details"><RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" /><span>Refresh</span></button>
            <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" aria-label="Close live train details"><X size={19} /></button>
          </div>
        </div>

        {!loading && !error && data ? <>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-blue-700 text-white"><Navigation size={15} aria-hidden="true" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{data.currentPosition ? `${data.currentPosition.stationName} (${data.currentPosition.stationCode})` : "Position unavailable"}</p><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-600">{data.statusNote}</p></div>
          </div>
          {progress ? <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold capitalize text-slate-600">{progress.journeyStatus.replace("_", " ")}</span><strong className="text-blue-700">{Math.round(progress.percent)}%</strong></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Journey progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} /></div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 py-2 text-center">
              <div><strong className="block font-site-code text-sm text-slate-900">{progress.remainingStations}</strong><span className="text-[10px] text-slate-500">stations left</span></div>
              <div><strong className="block font-site-code text-sm text-slate-900">{progress.distanceRemainingKm ?? "—"}</strong><span className="text-[10px] text-slate-500">km left</span></div>
              <div><strong className="block font-site-code text-sm text-slate-900">{data.averageSpeedKmph ?? "—"}</strong><span className="text-[10px] text-slate-500">avg km/h</span></div>
            </div>
          </div> : null}
        </> : null}
      </header>

      {loading ? <div className="grid flex-1 place-items-center p-6 text-center"><div><RefreshCw className="mx-auto animate-spin text-blue-700" size={22} aria-hidden="true" /><p className="mt-3 text-sm text-slate-600">Building the live schedule…</p></div></div> : null}
      {error ? <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg bg-red-800 px-3 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">Try again</button></div> : null}

      {!loading && !error && data ? <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <div><h3 className="text-xs font-black tracking-[0.08em] text-slate-900 uppercase">Route schedule</h3><p className="mt-0.5 text-[11px] font-medium text-slate-500">{scheduleGroups.length} stops · {data.totalDistanceKm ?? "—"} km</p></div>
        </div>
        {cancellationNote ? <div role="note" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs leading-5 text-red-800"><strong>Schedule notice:</strong> {cancellationNote}</div> : null}

        {scheduleGroups.length > 0 ? <ol ref={scheduleRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-3" aria-label="Train station timeline">
          {scheduleGroups.map((group) => {
            const stop = group.stop;
            const isCurrent = stop.status === "current" || stop.stationCode === data.currentPosition?.stationCode;
            const isPassed = stop.status === "passed";
            const scheduledArrival = formatScheduleTime(stop.arrival?.scheduled);
            const scheduledDeparture = formatScheduleTime(stop.departure?.scheduled);
            const actualArrival = formatScheduleTime(stop.arrival?.actual);
            const actualDeparture = formatScheduleTime(stop.departure?.actual);
            const arrivalDelayed = Boolean(stop.arrival?.delay && !/on time/i.test(stop.arrival.delay));
            const departureDelayed = Boolean(stop.departure?.delay && !/on time/i.test(stop.departure.delay));
            const arrivalCancelled = isCancelledScheduleValue(stop.arrival?.actual);
            const departureCancelled = isCancelledScheduleValue(stop.departure?.actual);
            const stopCancelled = isCancelledScheduleStop(stop);
            const expanded = expandedSegments.has(group.key);
            return <li key={group.key}>
              <article aria-current={isCurrent ? "location" : undefined} className={`grid min-h-[68px] grid-cols-[68px_24px_minmax(0,1fr)_68px] items-center rounded-xl px-2 py-2 transition-colors ${isCurrent ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-white"}`}>
                <div className="min-w-0 text-left"><strong className="block font-site-code text-xs leading-4 text-slate-800">{scheduledArrival}</strong><strong className={`block font-site-code text-xs leading-4 ${actualArrival === "--" ? "text-slate-400" : arrivalCancelled ? "font-bold text-red-600" : arrivalDelayed ? "text-rose-600" : "text-emerald-700"}`}>{actualArrival}</strong></div>
                <div className="relative h-full" aria-hidden="true"><span className={`absolute -top-2 -bottom-2 left-1/2 w-px -translate-x-1/2 ${isPassed ? "bg-blue-500" : "bg-slate-300"}`} /><span className={`absolute top-1/2 left-1/2 grid size-4 -translate-1/2 place-items-center rounded-full border-[3px] border-slate-50 ${stopCancelled ? "bg-red-600" : isCurrent ? "bg-blue-600 ring-4 ring-blue-100" : isPassed ? "bg-blue-700" : "bg-amber-400"}`} /></div>
                <div className="min-w-0 px-3"><h4 className={`truncate text-sm font-bold ${stopCancelled ? "text-slate-500 line-through decoration-red-500 decoration-2" : "text-slate-950"}`} title={stop.stationName}>{stop.stationName || stop.stationCode}</h4><div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-slate-500"><strong className="font-site-code text-slate-700">{stop.stationCode}</strong><span>·</span><span>{stop.distanceKm === "" || stop.distanceKm == null ? "—" : `${stop.distanceKm} km`}</span><span className="rounded bg-slate-200 px-1.5 py-0.5 font-bold text-slate-700">PF {stop.platform || "—"}</span></div></div>
                <div className="min-w-0 text-right"><strong className="block font-site-code text-xs leading-4 text-slate-800">{scheduledDeparture}</strong><strong className={`block font-site-code text-xs leading-4 ${actualDeparture === "--" ? "text-slate-400" : departureCancelled ? "font-bold text-red-600" : departureDelayed ? "text-rose-600" : "text-emerald-700"}`}>{actualDeparture}</strong></div>
              </article>

              {group.intermediates.length > 0 ? <div>
                <button type="button" onClick={() => toggleSegment(group.key)} aria-expanded={expanded} aria-controls={`segment-${group.key}`} className={`grid min-h-10 w-full grid-cols-[68px_24px_minmax(0,1fr)_68px] items-center rounded-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${expanded ? "bg-blue-50" : "hover:bg-white"}`}>
                  <span /><span className="relative h-full" aria-hidden="true"><i className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-slate-300" /><i className="absolute top-1/2 -right-2 left-1/2 h-px bg-slate-300" /></span><span className="min-w-0 px-2"><span className="block truncate text-[11px] font-semibold text-slate-600">{group.intermediates.length} passing stations</span></span><ChevronDown size={15} className={`mx-auto text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {expanded ? <ol id={`segment-${group.key}`}>
                  {group.intermediates.map((intermediate) => {
                    const intermediateCurrent = intermediate.status === "current" || intermediate.stationCode === data.currentPosition?.stationCode;
                    return <li key={`${intermediate.stationCode}-${intermediate.index}`} aria-current={intermediateCurrent ? "location" : undefined} className={`grid min-h-10 grid-cols-[68px_24px_minmax(0,1fr)_68px] items-center rounded-lg py-1.5 ${intermediateCurrent ? "bg-blue-100 ring-1 ring-blue-300" : ""}`}>
                      <span className="text-right text-[9px] font-bold text-slate-400 uppercase">Passes</span><span className="relative h-full" aria-hidden="true"><i className="absolute -top-1.5 -bottom-1.5 left-1/2 w-px -translate-x-1/2 bg-slate-300" /><i className={`absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full ${intermediateCurrent ? "bg-blue-700 ring-4 ring-blue-100" : "bg-slate-400"}`} /></span><div className="min-w-0 px-3"><strong className="block truncate text-xs font-semibold text-slate-700" title={intermediate.stationName}>{intermediate.stationName || intermediate.stationCode}</strong><span className="font-site-code text-[10px] text-slate-500">{intermediate.stationCode}</span></div><span className="pr-1 text-right font-site-code text-[10px] text-slate-500">{intermediate.distanceKm === "" || intermediate.distanceKm == null ? "—" : `${intermediate.distanceKm} km`}</span>
                    </li>;
                  })}
                </ol> : null}
              </div> : null}
            </li>;
          })}
        </ol> : <div className="grid flex-1 place-items-center p-6 text-center"><p className="text-sm text-slate-600">Station timeline unavailable for this run.</p></div>}
      </div> : null}
    </aside>
  );
}

export function RailAtlas() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const railwayLayerRef = useRef<Layer | null>(null);
  const stationLayerRef = useRef<LayerGroup | null>(null);
  const selectedLayerRef = useRef<LayerGroup | null>(null);
  const trainLayerRef = useRef<LayerGroup | null>(null);
  const stationMarkersRef = useRef<CircleMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<TrainSelection | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [showStations, setShowStations] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const stationBoard = useStationBoard(selected);
  const globalSearch = useGlobalSearch(query);
  const trainLive = useTrainLive(selectedTrain);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/india-stations.json", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Station data unavailable")))
      .then((response: StationCatalog) => {
        const nextStations = response.stations.filter(isMappedStation).sort((a, b) => a.name.localeCompare(b.name));
        setStations(nextStations);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Station data unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !mapNodeRef.current) return;
      const map = L.map(mapNodeRef.current, {
        center: [22.9, 79.2],
        zoom: 5,
        minZoom: 5,
        maxZoom: 18,
        maxBounds: INDIA_MAP_BOUNDS,
        maxBoundsViscosity: 1,
        preferCanvas: true,
        zoomControl: false,
      });
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
        const radius = getStationMarkerRadius(map.getZoom());
        stationMarkersRef.current.forEach((marker) => marker.setRadius(radius));
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    }).catch(() => {
      if (!disposed) setError("Map library unavailable");
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!showTracks || selectedTrain) {
      railwayLayerRef.current?.removeFrom(mapRef.current);
      return;
    }
    if (railwayLayerRef.current) {
      railwayLayerRef.current.addTo(mapRef.current);
      return;
    }
    const controller = new AbortController();
    Promise.all([
      fetch("/data/india-railways.json", { signal: controller.signal }).then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("Railway network data unavailable"))
      ) as Promise<{ lines: [number, number][][] }>,
      import("leaflet"),
    ]).then(([data, L]) => {
      if (controller.signal.aborted || !mapRef.current) return;
      railwayLayerRef.current = L.polyline(data.lines, {
        pane: "railwayLines",
        renderer: L.canvas({ pane: "railwayLines", padding: 0.5, tolerance: 2 }),
        color: "#155f96",
        weight: 1.7,
        opacity: 0.75,
        interactive: false,
      }).addTo(mapRef.current);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Railway network data unavailable");
    });
    return () => controller.abort();
  }, [mapReady, selectedTrain, showTracks]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || stations.length === 0) return;
    if (!showStations || selectedTrain) {
      stationLayerRef.current?.removeFrom(mapRef.current);
      return;
    }
    if (stationLayerRef.current) {
      stationLayerRef.current.addTo(mapRef.current);
      return;
    }
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      stationLayerRef.current?.removeFrom(mapRef.current);
      const renderer = L.canvas({ pane: "stationMarkers", padding: 0.4, tolerance: 9 });
      const layer = L.layerGroup();
      stationMarkersRef.current = stations.map((station) =>
        L.circleMarker([station.lat, station.lon], {
          pane: "stationMarkers",
          renderer,
          radius: getStationMarkerRadius(mapRef.current?.getZoom() || 5),
          weight: 1.15,
          color: "#ffffff",
          fillColor: "#d97706",
          fillOpacity: 0.92,
          opacity: 1,
          bubblingMouseEvents: false,
        })
          .bindTooltip(`${station.name} (${station.code})`, { direction: "top" })
          .on("click", () => {
            setSelectedTrain(null);
            setSelected(station);
          })
          .addTo(layer)
      );
      stationLayerRef.current = layer.addTo(mapRef.current);
    }).catch(() => {
      if (!cancelled) setError("Station markers unavailable");
    });
    return () => { cancelled = true; };
  }, [mapReady, selectedTrain, showStations, stations]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!showStations || !selected) {
      selectedLayerRef.current?.removeFrom(mapRef.current);
      return;
    }
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      selectedLayerRef.current?.removeFrom(mapRef.current);
      const ring = L.circleMarker([selected.lat, selected.lon], {
        pane: "selectedStation",
        radius: 13,
        weight: 3,
        color: "#ffffff",
        fillColor: "#1769aa",
        fillOpacity: 0.95,
        interactive: false,
      });
      ring.bindTooltip(selected.code, { permanent: true, direction: "top", offset: [0, -12] });
      selectedLayerRef.current = L.layerGroup([ring]).addTo(mapRef.current);
      const targetZoom = Math.max(mapRef.current.getZoom(), 8);
      mapRef.current.flyTo([selected.lat, selected.lon], targetZoom, { duration: 0.55 });
    }).catch(() => {
      if (!cancelled) setError("Selected station marker unavailable");
    });
    return () => { cancelled = true; };
  }, [mapReady, selected, showStations]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    trainLayerRef.current?.removeFrom(mapRef.current);
    trainLayerRef.current = null;
    if (!selectedTrain || !trainLive.data) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || !trainLive.data) return;
      const data = trainLive.data;
      const layers: Layer[] = [];
      if (data.route.length > 1) {
        layers.push(L.polyline(data.route, { pane: "activeTrain", color: "#dc2626", weight: 4, opacity: 0.92, interactive: false }));
      }
      data.timeline
        .filter((stop) => stop.type !== "intermediate" && Number.isFinite(stop.lat) && Number.isFinite(stop.lon))
        .filter((stop) => stop.stationCode !== data.start?.stationCode && stop.stationCode !== data.end?.stationCode)
        .forEach((stop) => {
          const stopCancelled = isCancelledScheduleStop(stop);
          layers.push(L.circleMarker([stop.lat!, stop.lon!], {
            pane: "activeTrain",
            radius: 4.5,
            color: stopCancelled ? "#ffffff" : "#b91c1c",
            weight: 2,
            fillColor: stopCancelled ? "#dc2626" : "#ffffff",
            fillOpacity: 1,
            bubblingMouseEvents: false,
          }).bindTooltip(`${stop.stationName || stop.stationCode} (${stop.stationCode})`, { direction: "top" }));
        });
      if (data.start) layers.push(L.circleMarker([data.start.lat, data.start.lon], { pane: "activeTrain", radius: 7, color: "#ffffff", weight: 2, fillColor: "#059669", fillOpacity: 1, interactive: false }).bindTooltip(`Start · ${data.start.stationCode}`, { direction: "top" }));
      if (data.end) layers.push(L.circleMarker([data.end.lat, data.end.lon], { pane: "activeTrain", radius: 7, color: "#ffffff", weight: 2, fillColor: "#dc2626", fillOpacity: 1, interactive: false }).bindTooltip(`End · ${data.end.stationCode}`, { direction: "top" }));
      if (data.currentPosition) {
        const rotation = Number.isFinite(data.currentPosition.bearing) ? data.currentPosition.bearing : 0;
        const icon = L.divIcon({
          className: "",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          html: `<div style="width:38px;height:38px;display:grid;place-items:center;border:3px solid white;border-radius:50%;background:#1d4ed8;box-shadow:0 6px 18px rgba(15,23,42,.35);transform:rotate(${rotation}deg)"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 20 21l-8-4-8 4 8-19Z" fill="white"/></svg></div>`,
        });
        layers.push(L.marker([data.currentPosition.lat, data.currentPosition.lon], { pane: "activeTrain", icon, interactive: false, zIndexOffset: 1000 }).bindTooltip(`${data.trainNo} · ${data.currentPosition.stationCode}`, { permanent: true, direction: "top", offset: [0, -20] }));
      }
      trainLayerRef.current = L.layerGroup(layers).addTo(mapRef.current);
      if (data.route.length > 1) mapRef.current.fitBounds(L.latLngBounds(data.route), { padding: [40, 40], maxZoom: 9, animate: true });
    }).catch(() => {
      if (!cancelled) setError("Live train route could not be displayed");
    });
    return () => { cancelled = true; };
  }, [mapReady, selectedTrain, trainLive.data]);

  const chooseSearchStation = (result: GlobalSearchResult["stations"][number]) => {
    const station = stations.find((item) => item.code === result.code)
      || (isMappedStation(result) ? result : null);
    if (!station) return;
    setSelectedTrain(null);
    setSelected(station);
    setQuery("");
  };

  const chooseTrain = (train: TrainSelection) => {
    setSelected(null);
    setSelectedTrain(train);
    setQuery("");
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-slate-200 text-slate-900">
      <section className="absolute inset-0" aria-label="Indian railway network map">
        <div ref={mapNodeRef} className="absolute inset-0 bg-slate-200" />
      </section>

      <div className="absolute top-3 left-3 z-[1000] w-[min(440px,calc(100%-1.5rem))]">
        <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <label className="flex h-11 items-center gap-2">
            <Search size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Search stations and trains</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-500" placeholder="Search station, train number or name" aria-label="Search station, train number or name" autoComplete="off" />
            {query ? <button type="button" onClick={() => setQuery("")} className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Clear search"><X size={16} /></button> : null}
          </label>
        </div>
        {query.trim().length >= 2 ? (
          <div className="mt-2 max-h-[min(60dvh,460px)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
            {globalSearch.loading ? <p className="px-4 py-3 text-sm text-slate-500">Searching stations and trains…</p> : null}
            {globalSearch.error ? <p className="px-4 py-3 text-sm text-red-700">{globalSearch.error}</p> : null}
            {!globalSearch.loading && !globalSearch.error && globalSearch.results.stations.length === 0 && globalSearch.results.trains.length === 0 ? <p className="px-4 py-3 text-sm text-slate-600">No stations or trains found.</p> : null}
            {globalSearch.results.stations.length > 0 ? <div className="border-b border-slate-200 p-2">
              <p className="px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">Stations</p>
              {globalSearch.results.stations.map((station) => <button key={station.code} type="button" onClick={() => chooseSearchStation(station)} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-800 font-site-code text-[10px] font-bold text-white">{station.code}</span>
                <span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{station.name}</strong><small className="block text-xs text-slate-500">Open station details</small></span>
              </button>)}
            </div> : null}
            {globalSearch.results.trains.length > 0 ? <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">Trains</p>
              {globalSearch.results.trains.map((train) => <button type="button" onClick={() => chooseTrain(train)} key={train.trainNo} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700"><span className="font-site-code text-xs font-bold text-blue-700">{train.trainNo}</span><span className="truncate text-sm font-semibold text-slate-800">{train.trainName}</span><span className="ml-auto text-[10px] font-semibold text-slate-500">Track</span></button>)}
            </div> : null}
          </div>
        ) : null}
      </div>

      <details className="group absolute top-3 right-3 z-[1000] w-12 rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur open:top-16 open:w-48 sm:w-48 sm:open:top-3">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 group-open:justify-start sm:justify-start [&::-webkit-details-marker]:hidden">
          <Layers3 size={17} aria-hidden="true" />
          <span className="hidden group-open:inline sm:inline">Map layers</span>
        </summary>
        <div className="border-t border-slate-200 p-2">
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2"><i className="size-2 rounded-full border border-white bg-amber-600 ring-1 ring-amber-800" /> Stations</span>
            <input className="size-4 accent-blue-700" type="checkbox" checked={showStations} onChange={(event) => setShowStations(event.target.checked)} />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2"><i className="h-[3px] w-5 bg-blue-700" /> Railway tracks</span>
            <input className="size-4 accent-blue-700" type="checkbox" checked={showTracks} onChange={(event) => setShowTracks(event.target.checked)} />
          </label>
        </div>
      </details>

      {selected ? <StationDetailsPanel station={selected} board={stationBoard.board} hours={stationBoard.hours} loading={stationBoard.loading} error={stationBoard.error} onClose={() => setSelected(null)} onRetry={stationBoard.retry} onSelectTrain={(train) => chooseTrain({ trainNo: train.trainNo, trainName: train.trainName, date: train.runDate })} /> : null}
      {selectedTrain ? <TrainDetailsPanel selection={selectedTrain} data={trainLive.data} loading={trainLive.loading} error={trainLive.error} onClose={() => setSelectedTrain(null)} onRetry={trainLive.retry} /> : null}

      {error ? <div role="alert" className="absolute right-3 bottom-3 left-3 z-[1000] mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">{error}. Run npm run update:station-data if the station file is missing.</div> : null}
    </main>
  );
}
