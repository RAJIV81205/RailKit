"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { CircleMarker, Layer, LayerGroup, Map as LeafletMap } from "leaflet";
import { Clock3, Layers3, RefreshCw, Search, TrainFront, X } from "lucide-react";

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

function StationDetailsPanel({
  station,
  board,
  hours,
  loading,
  error,
  onClose,
  onRetry,
}: {
  station: Station;
  board: StationBoard | null;
  hours: 4 | 8;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
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
                <article key={`${train.trainNo}-${train.runDate}-${train.arrival?.scheduled}-${train.departure?.scheduled}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
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
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function RailAtlas() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const railwayLayerRef = useRef<Layer | null>(null);
  const stationLayerRef = useRef<LayerGroup | null>(null);
  const selectedLayerRef = useRef<LayerGroup | null>(null);
  const stationMarkersRef = useRef<CircleMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<Station | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [showStations, setShowStations] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const stationBoard = useStationBoard(selected);
  const globalSearch = useGlobalSearch(query);

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
        minZoom: 4,
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
    if (!showTracks) {
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
  }, [mapReady, showTracks]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || stations.length === 0) return;
    if (!showStations) {
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
          .on("click", () => setSelected(station))
          .addTo(layer)
      );
      stationLayerRef.current = layer.addTo(mapRef.current);
    }).catch(() => {
      if (!cancelled) setError("Station markers unavailable");
    });
    return () => { cancelled = true; };
  }, [mapReady, showStations, stations]);

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

  const chooseSearchStation = (result: GlobalSearchResult["stations"][number]) => {
    const station = stations.find((item) => item.code === result.code)
      || (isMappedStation(result) ? result : null);
    if (!station) return;
    setSelected(station);
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
              {globalSearch.results.trains.map((train) => <div key={train.trainNo} className="flex min-h-11 items-center gap-3 rounded-lg px-2"><span className="font-site-code text-xs font-bold text-blue-700">{train.trainNo}</span><span className="truncate text-sm font-semibold text-slate-800">{train.trainName}</span></div>)}
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

      {selected ? <StationDetailsPanel station={selected} board={stationBoard.board} hours={stationBoard.hours} loading={stationBoard.loading} error={stationBoard.error} onClose={() => setSelected(null)} onRetry={stationBoard.retry} /> : null}

      {error ? <div role="alert" className="absolute right-3 bottom-3 left-3 z-[1000] mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">{error}. Run npm run update:station-data if the station file is missing.</div> : null}
    </main>
  );
}
