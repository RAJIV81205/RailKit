"use client";

import { useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  cancelList,
  checkPNRStatus,
  configure,
  fareLookup,
  getAvailability,
  getTrainHistory,
  getTrainInfo,
  liveAtStation,
  searchTrainBetweenStations,
  stationByCode,
  stationsByName,
  trackTrain,
  trainByNumber,
  trainTimetableAtStation,
  trainsByName,
} from "railkit";

type Variant = "light" | "dark";
type Action =
  | "pnr"
  | "train"
  | "track"
  | "history"
  | "station"
  | "search"
  | "availability"
  | "fare"
  | "cancelled"
  | "stationCode"
  | "stationSearch"
  | "trainLookup"
  | "trainNameSearch"
  | "timetable";

type FormState = {
  pnr: string;
  trainNumber: string;
  journeyDate: string;
  stationCode: string;
  stationHours: string;
  fromStation: string;
  toStation: string;
  name: string;
  timetableDate: string;
  classCode: string;
  quota: string;
};

type Endpoint = {
  id: Action;
  label: string;
  path: string;
  description: string;
};

const groups: { label: string; items: Endpoint[] }[] = [
  {
    label: "Core",
    items: [
      {
        id: "pnr",
        label: "PNR Status",
        path: "/api/checkPNRStatus/:pnr",
        description: "Check passenger booking and current PNR status.",
      },
      {
        id: "train",
        label: "Train Info",
        path: "/api/getTrainInfo/:trainNumber",
        description: "Get train details and its complete route.",
      },
      {
        id: "track",
        label: "Track Train",
        path: "/api/trackTrain/:trainNumber/:date",
        description: "Get the live running status of a train.",
      },
      {
        id: "history",
        label: "Train History",
        path: "/api/trainHistory/:trainNumber/:date",
        description: "Retrieve the completed journey timeline.",
      },
      {
        id: "station",
        label: "Live at Station",
        path: "/api/liveAtStation/:stationCode",
        description: "See upcoming trains at a station.",
      },
      {
        id: "timetable",
        label: "Station Timetable",
        path: "/api/station/:stationCode/timetable",
        description:
          "List trains crossing a station, with optional date filtering.",
      },
      {
        id: "search",
        label: "Search Trains",
        path: "/api/searchTrainBetweenStations/:from/:to",
        description: "Find direct trains between two stations.",
      },
      {
        id: "availability",
        label: "Seat Availability",
        path: "/api/getAvailability",
        description: "Check seats for a train, class, quota, and journey date.",
      },
      {
        id: "fare",
        label: "Fare Lookup",
        path: "/api/fareLookup",
        description: "Get a complete fare breakdown for a journey.",
      },
      {
        id: "cancelled",
        label: "Cancelled Trains",
        path: "/api/cancelList",
        description: "Get fully and partially cancelled trains.",
      },
    ],
  },
  {
    label: "Lookup",
    items: [
      {
        id: "stationCode",
        label: "Station by Code",
        path: "/api/station/code/:stationCode",
        description: "Resolve a station code to its details.",
      },
      {
        id: "stationSearch",
        label: "Stations by Name",
        path: "/api/station/search/:name",
        description: "Find up to 10 matching station names and codes.",
      },
      {
        id: "trainLookup",
        label: "Train by Number",
        path: "/api/train/number/:trainNumber",
        description: "Resolve an exact five-digit train number.",
      },
      {
        id: "trainNameSearch",
        label: "Trains by Name",
        path: "/api/train/search/:name",
        description: "Find up to 10 matching train names and numbers.",
      },
    ],
  },
];

const initial: FormState = {
  pnr: "",
  trainNumber: "",
  journeyDate: "",
  stationCode: "",
  stationHours: "2",
  fromStation: "",
  toStation: "",
  name: "",
  timetableDate: "",
  classCode: "3A",
  quota: "GN",
};

// Browser date inputs use YYYY-MM-DD; RailKit endpoints use DD-MM-YYYY.
const toDateInputValue = (value: string) => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

const fromDateInputValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

const dateWithOffset = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const responseStatus = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.statusCode === "number") return record.statusCode;
    if (record.success === false) return 400;
  }
  return 200;
};

export default function ApiPlayground({
  apiKey,
  variant = "light",
}: {
  apiKey?: string | null;
  variant?: Variant;
}) {
  const dark = variant === "dark";
  const [selected, setSelected] = useState<Action>("pnr");
  const [form, setForm] = useState<FormState>(initial);
  const [response, setResponse] = useState<unknown>({
    message: "Run a request to see the response here.",
  });
  const [status, setStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endpoint = useMemo(
    () =>
      groups
        .flatMap((group) => group.items)
        .find((item) => item.id === selected)!,
    [selected],
  );
  const requestUrl = useMemo(() => {
    const value = (input: string, fallback: string) =>
      input.trim() ? encodeURIComponent(input.trim()) : `:${fallback}`;
    const date = form.journeyDate;
    switch (selected) {
      case "pnr":
        return `/api/checkPNRStatus/${value(form.pnr, "pnr")}`;
      case "train":
        return `/api/getTrainInfo/${value(form.trainNumber, "trainNumber")}`;
      case "track":
        return `/api/trackTrain/${value(form.trainNumber, "trainNumber")}/${date ? encodeURIComponent(date) : "today"}`;
      case "history":
        return `/api/trainHistory/${value(form.trainNumber, "trainNumber")}/${value(date, "date")}`;
      case "station":
        return `/api/liveAtStation/${value(form.stationCode, "stationCode")}?hrs=${form.stationHours}`;
      case "timetable":
        return `/api/station/${value(form.stationCode, "stationCode")}/timetable${form.timetableDate ? `?date=${encodeURIComponent(form.timetableDate)}` : ""}`;
      case "search":
        return `/api/searchTrainBetweenStations/${value(form.fromStation, "from")}/${value(form.toStation, "to")}${form.journeyDate ? `?date=${encodeURIComponent(form.journeyDate)}` : ""}`;
      case "availability":
        return `/api/getAvailability/${value(form.trainNumber, "trainNumber")}/${value(form.fromStation, "from")}/${value(form.toStation, "to")}/${value(date, "date")}/${form.classCode}/${form.quota}`;
      case "fare":
        return `/api/fareLookup/${value(form.trainNumber, "trainNumber")}/${value(date, "date")}/${value(form.fromStation, "from")}/${value(form.toStation, "to")}/${form.classCode}/${form.quota}`;
      case "cancelled":
        return "/api/cancelled";
      case "stationCode":
        return `/api/station/${value(form.stationCode, "stationCode")}`;
      case "stationSearch":
        return `/api/stations/search?name=${value(form.name, "name")}`;
      case "trainLookup":
        return `/api/train/${value(form.trainNumber, "trainNumber")}`;
      case "trainNameSearch":
        return `/api/trains/search?name=${value(form.name, "name")}`;
    }
  }, [form, selected]);
  const set = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const run = async () => {
    setError("");
    setLoading(true);
    setStatus(null);
    const started = performance.now();
    try {
      if (!apiKey)
        throw new Error("No API key is available for this playground.");
      configure(apiKey);
      let result: unknown;
      switch (selected) {
        case "pnr":
          result = await checkPNRStatus(form.pnr);
          break;
        case "train":
          result = await getTrainInfo(form.trainNumber);
          break;
        case "track":
          result = await trackTrain(
            form.trainNumber,
            form.journeyDate || undefined,
          );
          break;
        case "history":
          result = await getTrainHistory(form.trainNumber, form.journeyDate);
          break;
        case "station":
          result = await liveAtStation(
            form.stationCode,
            Number(form.stationHours) as 2 | 4 | 8,
          );
          break;
        case "timetable":
          result = await trainTimetableAtStation(
            form.stationCode,
            form.timetableDate || undefined,
          );
          break;
        case "search":
          result = await searchTrainBetweenStations(
            form.fromStation,
            form.toStation,
            form.journeyDate || undefined,
          );
          break;
        case "availability":
          result = await getAvailability(
            form.trainNumber,
            form.fromStation,
            form.toStation,
            form.journeyDate,
            form.classCode,
            form.quota,
          );
          break;
        case "fare":
          result = await fareLookup(
            form.trainNumber,
            form.fromStation,
            form.toStation,
            form.journeyDate,
            form.classCode,
            form.quota,
          );
          break;
        case "cancelled":
          result = await cancelList();
          break;
        case "stationCode":
          result = await stationByCode(form.stationCode);
          break;
        case "stationSearch":
          result = await stationsByName(form.name);
          break;
        case "trainLookup":
          result = await trainByNumber(form.trainNumber);
          break;
        case "trainNameSearch":
          result = await trainsByName(form.name);
          break;
      }
      setResponse(result);
      setStatus(responseStatus(result));
    } catch (caught: unknown) {
      const message =
        caught instanceof Error ? caught.message : "Request failed.";
      setError(message);
      setResponse({ success: false, error: message });
      setStatus(500);
    } finally {
      setDuration(Math.round(performance.now() - started));
      setLoading(false);
    }
  };

  const panel = dark
    ? "bg-[#101722] border-[#273448] text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const muted = dark ? "text-slate-400" : "text-slate-500";
  const input = dark
    ? "border-[#344154] bg-[#0b111a] text-slate-100 placeholder:text-slate-600"
    : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400";
  const codeStyle = dark
    ? nightOwl
    : {
        ...nightOwl,
        'pre[class*="language-"]': {
          ...nightOwl['pre[class*="language-"]'],
          background: "#0f1720",
        },
      };
  const field = (
    key: keyof FormState,
    label: string,
    helper?: string,
    type = "text",
  ) => (
    <div
      className={`grid grid-cols-1 gap-2 border-b pb-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start sm:gap-4 ${dark ? "border-[#273448]" : "border-slate-100"}`}
    >
      <label
        htmlFor={`playground-${selected}-${key}`}
        className={`pt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${muted}`}
      >
        {label}
      </label>
      <div>
        <input
          id={`playground-${selected}-${key}`}
          type={type}
          min={type === "date" && selected === "timetable" ? dateWithOffset(-1) : undefined}
          max={type === "date" && selected === "timetable" ? dateWithOffset(1) : undefined}
          value={type === "date" ? toDateInputValue(form[key]) : form[key]}
          onChange={(event) =>
            set(
              key,
              type === "date"
                ? fromDateInputValue(event.target.value)
                : event.target.value,
            )
          }
          placeholder={type === "date" ? undefined : `Enter ${label.toLowerCase()}`}
          className={`h-10 w-full rounded-lg border px-3 font-mono text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${input}`}
        />
        {helper && <p className={`mt-1 text-xs ${muted}`}>{helper}</p>}
      </div>
    </div>
  );
  const select = (key: keyof FormState, label: string, values: string[]) => (
    <div
      className={`grid grid-cols-1 gap-2 border-b pb-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start sm:gap-4 ${dark ? "border-[#273448]" : "border-slate-100"}`}
    >
      <label
        htmlFor={`playground-${selected}-${key}`}
        className={`pt-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${muted}`}
      >
        {label}
      </label>
      <select
        id={`playground-${selected}-${key}`}
        value={form[key]}
        onChange={(event) => set(key, event.target.value)}
        className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:border-blue-500 ${input}`}
      >
        {values.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className={`grid min-h-[650px] grid-cols-1 overflow-hidden rounded-2xl border shadow-sm md:grid-cols-[250px_minmax(0,1fr)] ${panel}`}
    >
      <aside
        className={`border-b p-3 md:border-b-0 md:border-r ${dark ? "border-[#273448] bg-[#0d141e]" : "border-slate-200 bg-slate-50/70"}`}
      >
        <div className="px-2 py-2">
          <p className="text-sm font-bold">API Playground</p>
          <p className={`mt-0.5 text-[11px] ${muted}`}>Collections</p>
        </div>
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p
                className={`px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${muted}`}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelected(item.id);
                      setError("");
                      setStatus(null);
                    }}
                    aria-current={selected === item.id ? "page" : undefined}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition ${selected === item.id ? (dark ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700") : `${muted} hover:bg-slate-200/60 dark:hover:bg-white/5`}`}
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${selected === item.id ? "bg-emerald-500/15 text-emerald-500" : dark ? "bg-slate-800 text-slate-500" : "bg-white text-slate-400"}`}
                    >
                      GET
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6">
        <div className="border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 font-mono text-[10px] font-bold text-emerald-500">
              GET
            </span>
            <span className={`font-mono text-xs ${muted}`}>
              {endpoint.path}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight">
            {endpoint.label}
          </h2>
          <p className={`mt-1 text-sm ${muted}`}>{endpoint.description}</p>
        </div>
        <section className="py-5">
          <div>
            <h3 className="text-sm font-bold">Request parameters</h3>
            <p className={`mt-1 text-xs ${muted}`}>
              Configure the request and send it to the live API.
            </p>
          </div>
          <div
            className={`mt-4 flex items-center gap-3 rounded-lg border px-3 py-2.5 ${dark ? "border-[#273448] bg-[#0b111a]" : "border-slate-200 bg-slate-50"}`}
          >
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-500">
              URL
            </span>
            <code className={`min-w-0 truncate font-mono text-xs ${muted}`}>
              https://api.railkit.in{requestUrl}
            </code>
          </div>
          {selected === "cancelled" ? (
            <p
              className={`mt-4 rounded-lg border border-dashed p-4 text-sm ${muted}`}
            >
              This endpoint does not require parameters.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {["pnr"].includes(selected) &&
                field("pnr", "PNR number", "Exactly 10 digits")}
              {[
                "train",
                "track",
                "history",
                "availability",
                "fare",
                "trainLookup",
              ].includes(selected) &&
                field(
                  "trainNumber",
                  "Train number",
                  "Exactly 5 numeric digits",
                )}
              {["track", "history", "availability", "fare"].includes(
                selected,
              ) &&
                field(
                  "journeyDate",
                  "Journey date",
                  selected === "track"
                    ? "Optional · defaults to today · DD-MM-YYYY"
                    : "DD-MM-YYYY",
                  "date",
                )}
              {["station", "stationCode", "timetable"].includes(selected) &&
                field("stationCode", "Station code", "Example: ASN")}
              {selected === "station" &&
                select("stationHours", "Time window", ["2", "4", "8"])}
              {["search", "availability", "fare"].includes(selected) &&
                field("fromStation", "From station", "Station code")}
              {["search", "availability", "fare"].includes(selected) &&
                field("toStation", "To station", "Station code")}
              {selected === "search" &&
                field(
                  "journeyDate",
                  "Journey date",
                  "Optional · DD-MM-YYYY",
                  "date",
                )}
              {selected === "timetable" &&
                field(
                  "timetableDate",
                  "Date",
                  "Optional · omit for all trains",
                  "date",
                )}
              {["stationSearch", "trainNameSearch"].includes(selected) &&
                field("name", "Search name", "At least 2 characters")}
              {["availability", "fare"].includes(selected) &&
                select(
                  "classCode",
                  "Class",
                  selected === "fare"
                    ? ["1A", "2A", "3A", "3E", "CC", "EC", "SL", "2S"]
                    : ["2S", "SL", "3A", "3E", "2A", "1A", "CC", "EC"],
                )}
              {["availability", "fare"].includes(selected) &&
                select("quota", "Quota", ["GN", "TQ", "LD", "SS"])}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send request"}
            </button>
            {status !== null && (
              <span
                className={`text-xs font-medium ${status < 400 ? "text-emerald-500" : "text-rose-500"}`}
              >
                HTTP {status}
                {duration !== null ? ` · ${duration}ms` : ""}
              </span>
            )}
            {error && <span className="text-xs text-rose-500">{error}</span>}
          </div>
        </section>
        <section
          className={`overflow-hidden rounded-xl border ${dark ? "border-[#273448] bg-[#0b111a]" : "border-slate-200 bg-slate-950"}`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Response</h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>JSON</span>
              {status !== null && (
                <span
                  className={
                    status < 400 ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  {status}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-[430px] overflow-auto text-xs">
            <SyntaxHighlighter
              language="json"
              style={codeStyle}
              customStyle={{
                margin: 0,
                padding: "1rem",
                minHeight: "150px",
                background: "transparent",
                fontSize: "12px",
                lineHeight: "1.65",
              }}
              wrapLongLines
            >
              {loading
                ? "// Sending request…"
                : JSON.stringify(response, null, 2)}
            </SyntaxHighlighter>
          </div>
        </section>
      </main>
    </div>
  );
}
