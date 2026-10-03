"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Layer, LayerGroup, Map as LeafletMap } from "leaflet";
import { Layers3, ListFilter, MapPin, Search, X } from "lucide-react";

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

const ROW_HEIGHT = 58;
const OVERSCAN = 8;

function isMappedStation(station: StationRecord): station is Station {
  return Number.isFinite(station.lat) && Number.isFinite(station.lon)
    && station.lat! >= 6 && station.lat! <= 38
    && station.lon! >= 68 && station.lon! <= 98;
}

export function RailAtlas() {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const railwayLayerRef = useRef<Layer | null>(null);
  const stationLayerRef = useRef<LayerGroup | null>(null);
  const selectedLayerRef = useRef<LayerGroup | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [totalStations, setTotalStations] = useState(0);
  const [selected, setSelected] = useState<Station | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stationPanelOpen, setStationPanelOpen] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [listHeight, setListHeight] = useState(500);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/india-stations.json", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Station data unavailable")))
      .then((response: StationCatalog) => {
        const nextStations = response.stations.filter(isMappedStation).sort((a, b) => a.name.localeCompare(b.name));
        setStations(nextStations);
        setTotalStations(response.totalStations || response.stations.length);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Station data unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
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
        preferCanvas: true,
        zoomControl: false,
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
        renderer: L.canvas({ padding: 0.5, tolerance: 2 }),
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
      const renderer = L.canvas({ padding: 0.4, tolerance: 5 });
      const layer = L.layerGroup();
      stations.forEach((station) => {
        L.circleMarker([station.lat, station.lon], {
          renderer,
          radius: 2,
          weight: 0.7,
          color: "#ffffff",
          fillColor: "#d97706",
          fillOpacity: 0.82,
          opacity: 0.9,
        })
          .bindTooltip(`${station.name} (${station.code})`, { direction: "top" })
          .on("click", () => setSelected(station))
          .addTo(layer);
      });
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
        radius: 13,
        weight: 3,
        color: "#ffffff",
        fillColor: "#1769aa",
        fillOpacity: 0.95,
        interactive: false,
      });
      ring.bindTooltip(selected.code, { permanent: true, direction: "top", offset: [0, -12] });
      selectedLayerRef.current = L.layerGroup([ring]).addTo(mapRef.current);
      mapRef.current.flyTo([selected.lat, selected.lon], 8, { duration: 0.55 });
    }).catch(() => {
      if (!cancelled) setError("Selected station marker unavailable");
    });
    return () => { cancelled = true; };
  }, [mapReady, selected, showStations]);

  useEffect(() => {
    if (!listRef.current) return;
    const observer = new ResizeObserver(([entry]) => setListHeight(entry.contentRect.height));
    observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [stationPanelOpen]);

  const filteredStations = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return needle ? stations.filter((station) => `${station.code} ${station.name}`.toUpperCase().includes(needle)) : stations;
  }, [query, stations]);

  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(listHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const visibleStations = filteredStations.slice(startIndex, startIndex + visibleCount);

  const chooseStation = (station: Station) => {
    setSelected(station);
    setStationPanelOpen(false);
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-slate-200 text-slate-900">
      <section className="absolute inset-0" aria-label="Indian railway network map">
        <div ref={mapNodeRef} className="absolute inset-0 bg-slate-200" />
      </section>

      <div className="absolute top-3 left-3 z-[900] flex items-center gap-2">
        <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <p className="font-site-code text-[10px] font-bold tracking-[0.16em] text-blue-700 uppercase">Rail Atlas</p>
          <p className="hidden text-xs font-medium text-slate-600 sm:block">India railway network</p>
        </div>
        <button
          type="button"
          aria-controls="station-browser"
          aria-expanded={stationPanelOpen}
          onClick={() => setStationPanelOpen((open) => !open)}
          className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 text-sm font-semibold text-slate-800 shadow-lg backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <ListFilter size={17} aria-hidden="true" />
          Stations
          <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 font-site-code text-[10px] text-slate-600 sm:inline">{stations.length.toLocaleString("en-IN")}</span>
        </button>
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

      {stationPanelOpen ? (
        <aside id="station-browser" className="absolute top-16 bottom-3 left-3 z-[900] flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Find a station</h1>
              <p className="mt-1 text-xs text-slate-500">{totalStations.toLocaleString("en-IN")} stations in the local catalog</p>
            </div>
            <button type="button" onClick={() => setStationPanelOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700" aria-label="Close station browser"><X size={18} /></button>
          </header>

          <label className="m-3 flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100">
            <Search size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
            <span className="sr-only">Filter stations</span>
            <input autoFocus className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500 md:text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or station code" />
            {query && <button className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-200" onClick={() => setQuery("")} type="button" aria-label="Clear station search"><X size={16} /></button>}
          </label>

          {loading ? <div className="px-4 py-2 text-sm text-slate-500">Loading stations…</div> : null}
          {!loading && filteredStations.length === 0 ? <div className="px-4 py-6 text-sm text-slate-600">No station matches “{query}”.</div> : null}

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
            <div className="relative" style={{ height: filteredStations.length * ROW_HEIGHT }}>
              <div className="absolute inset-x-0" style={{ top: startIndex * ROW_HEIGHT }}>
                {visibleStations.map((station) => (
                  <button
                    key={station.code}
                    onClick={() => chooseStation(station)}
                    className={`grid h-[58px] w-full grid-cols-[54px_minmax(0,1fr)_18px] items-center gap-2 border-b border-slate-100 px-3 text-left transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 ${selected?.code === station.code ? "bg-blue-50" : "bg-white"}`}
                  >
                    <span className="grid h-8 place-items-center rounded-md bg-slate-800 px-1 font-site-code text-[10px] font-bold text-white">{station.code}</span>
                    <span className="min-w-0"><strong className="block truncate text-sm">{station.name}</strong><small className="mt-0.5 block font-site-code text-[10px] text-slate-500">{station.lat.toFixed(2)}, {station.lon.toFixed(2)}</small></span>
                    <MapPin size={15} className="text-slate-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {error ? <div role="alert" className="absolute right-3 bottom-3 left-3 z-[1000] mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">{error}. Run npm run update:station-data if the station file is missing.</div> : null}
    </main>
  );
}
