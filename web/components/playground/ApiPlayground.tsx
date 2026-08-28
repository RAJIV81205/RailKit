"use client";

import { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/hljs";
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

type PlaygroundVariant = "light" | "dark";
type PlaygroundAction =
  | "pnr" | "train" | "track" | "history" | "station" | "search"
  | "availability" | "fare" | "cancelled" | "stationCode"
  | "stationSearch" | "trainLookup" | "trainNameSearch" | "timetable";

type PlaygroundInput = {
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

type Props = {
  apiKey?: string | null;
  variant?: PlaygroundVariant;
};

const initialInput: PlaygroundInput = {
  pnr: "", trainNumber: "", journeyDate: "", stationCode: "", stationHours: "2",
  fromStation: "", toStation: "", name: "", timetableDate: "", classCode: "SL", quota: "GN",
};

const actions: Array<{ id: PlaygroundAction; label: string }> = [
  { id: "pnr", label: "PNR" },
  { id: "train", label: "Train" },
  { id: "track", label: "Track" },
  { id: "history", label: "History" },
  { id: "station", label: "Station" },
  { id: "search", label: "Search" },
  { id: "availability", label: "Availability" },
  { id: "fare", label: "Fare" },
  { id: "cancelled", label: "Cancelled" },
  { id: "stationCode", label: "Station Code" },
  { id: "stationSearch", label: "Station Name" },
  { id: "trainLookup", label: "Train Lookup" },
  { id: "trainNameSearch", label: "Train Name" },
  { id: "timetable", label: "Timetable" },
];

const dateToInput = (value: string) => {
  if (!value) return "";
  const [day, month, year] = value.split("-");
  return year && month && day ? `${year}-${month}-${day}` : "";
};

const inputToDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
};

function PlaygroundSkeleton({ dark }: { dark: boolean }) {
  return <div style={{ height: 360, borderRadius: 8, background: dark ? "#111827" : "#f3f4f6", opacity: 0.7 }} />;
}

export default function ApiPlayground({ apiKey, variant = "light" }: Props) {
  const dark = variant === "dark";
  const [action, setAction] = useState<PlaygroundAction>("pnr");
  const [input, setInput] = useState<PlaygroundInput>(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [response, setResponse] = useState("");
  const set = (key: keyof PlaygroundInput, value: string) => setInput((previous) => ({ ...previous, [key]: value }));

  const run = async () => {
    if (!apiKey) { setError(dark ? "Admin API key not found. Re-login to refresh it." : "Session expired. Please refresh and sign in again."); return; }
    setLoading(true); setError(""); setStatus(null); setDuration(null); setResponse("");
    const started = performance.now();
    try {
      configure(apiKey);
      let result: unknown;
      const train = input.trainNumber;
      const date = input.journeyDate;
      switch (action) {
        case "pnr": if (!/^\d{10}$/.test(input.pnr)) throw new Error("PNR must be exactly 10 digits"); result = await checkPNRStatus(input.pnr); break;
        case "train": if (!/^\d{5}$/.test(train)) throw new Error("Train number must be exactly 5 digits"); result = await getTrainInfo(train); break;
        case "track": if (!/^\d{5}$/.test(train)) throw new Error("Train number must be exactly 5 digits"); if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) throw new Error("Date must be in DD-MM-YYYY format"); result = await trackTrain(train, date); break;
        case "history": if (!/^\d{5}$/.test(train)) throw new Error("Train number must be exactly 5 digits"); if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) throw new Error("Date must be in DD-MM-YYYY format"); result = await getTrainHistory(train, date); break;
        case "station": if (!input.stationCode.trim()) throw new Error("Station code is required"); result = await liveAtStation(input.stationCode.trim().toUpperCase(), Number(input.stationHours) as 2 | 4 | 8); break;
        case "search": if (!input.fromStation.trim() || !input.toStation.trim()) throw new Error("From and To station codes are required"); if (date && !/^\d{2}-\d{2}-\d{4}$/.test(date)) throw new Error("Date must be in DD-MM-YYYY format"); result = await searchTrainBetweenStations(input.fromStation.trim().toUpperCase(), input.toStation.trim().toUpperCase(), date || undefined); break;
        case "availability": if (!/^\d{5}$/.test(train)) throw new Error("Train number must be exactly 5 digits"); if (!input.fromStation.trim() || !input.toStation.trim()) throw new Error("From and To station codes are required"); if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) throw new Error("Date must be in DD-MM-YYYY format"); result = await getAvailability(train, input.fromStation.trim().toUpperCase(), input.toStation.trim().toUpperCase(), date, input.classCode, input.quota); break;
        case "fare": if (!/^\d{5}$/.test(train)) throw new Error("Train number must be exactly 5 digits"); if (!input.fromStation.trim() || !input.toStation.trim()) throw new Error("From and To station codes are required"); if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) throw new Error("Date must be in DD-MM-YYYY format"); result = await fareLookup(train, input.fromStation.trim().toUpperCase(), input.toStation.trim().toUpperCase(), date, input.classCode, input.quota); break;
        case "cancelled": result = await cancelList(); break;
        case "stationCode": if (!/^[A-Za-z0-9]{1,5}$/.test(input.stationCode.trim())) throw new Error("Station code must be 1-5 letters or digits"); result = await stationByCode(input.stationCode.trim().toUpperCase()); break;
        case "stationSearch": if (input.name.trim().length < 2) throw new Error("Station name must contain at least 2 characters"); result = await stationsByName(input.name.trim()); break;
        case "trainLookup": if (!/^\d{5}$/.test(train)) throw new Error("Train number must be exactly 5 digits"); result = await trainByNumber(train); break;
        case "trainNameSearch": if (input.name.trim().length < 2) throw new Error("Train name must contain at least 2 characters"); result = await trainsByName(input.name.trim()); break;
        case "timetable": if (!/^[A-Za-z0-9]{1,5}$/.test(input.stationCode.trim())) throw new Error("Station code must be 1-5 letters or digits"); if (input.timetableDate && !/^\d{2}-\d{2}-\d{4}$/.test(input.timetableDate)) throw new Error("Date must be in DD-MM-YYYY format"); result = await trainTimetableAtStation(input.stationCode.trim().toUpperCase(), input.timetableDate || undefined); break;
      }
      const record = result as { success?: boolean; error?: string; message?: string; statusCode?: number };
      setStatus(typeof record?.statusCode === "number" ? record.statusCode : record?.success === false ? 400 : 200);
      setResponse(JSON.stringify(result, null, 2) || "{}");
      if (record?.success === false) setError(record.error || record.message || "Request failed");
    } catch (caught) {
      const requestError = caught as { message?: string; status?: number; response?: { status?: number } };
      const message = requestError.message || "Something went wrong";
      setError(message); setStatus(requestError.status || requestError.response?.status || 500);
      setResponse(JSON.stringify({ success: false, message, statusCode: requestError.status || requestError.response?.status || 500 }, null, 2));
    } finally { setDuration(Math.round(performance.now() - started)); setLoading(false); }
  };

  const inputStyle: React.CSSProperties = dark
    ? { background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none", width: "100%" }
    : { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", color: "#111827", fontSize: 13, outline: "none", width: "100%" };
  const panel = dark ? { background: "#0f1117", border: "1px solid #1e2330", color: "#e2e8f0" } : { background: "#fff", border: "1px solid #ebebeb", color: "#111" };
  const textColor = dark ? "#64748b" : "#9ca3af";
  const selectAction = (next: PlaygroundAction) => { setAction(next); setError(""); setStatus(null); setResponse(""); };

  const fields = () => {
    const field = (key: keyof PlaygroundInput, placeholder: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => {
      const { onChange, value, ...rest } = extra;
      return <input {...rest} value={value ?? input[key]} onChange={onChange ?? ((event) => set(key, event.target.value))} placeholder={placeholder} style={inputStyle} />;
    };
    if (action === "pnr") return field("pnr", "PNR number (10 digits)", { maxLength: 10, onChange: (event) => set("pnr", event.target.value.replace(/\D/g, "")) });
    if (["train", "trainLookup"].includes(action)) return field("trainNumber", "Train number (5 digits)", { maxLength: 5, onChange: (event) => set("trainNumber", event.target.value.replace(/\D/g, "")) });
    if (["track", "history", "availability", "fare"].includes(action)) return <>{field("trainNumber", "Train number", { maxLength: 5, onChange: (event) => set("trainNumber", event.target.value.replace(/\D/g, "")) })}{field("journeyDate", "", { type: "date", value: dateToInput(input.journeyDate), onChange: (event) => set("journeyDate", inputToDate(event.target.value)) })}{["availability", "fare"].includes(action) && <>{field("fromStation", "From station", { onChange: (event) => set("fromStation", event.target.value.toUpperCase()) })}{field("toStation", "To station", { onChange: (event) => set("toStation", event.target.value.toUpperCase()) })}<select value={input.classCode} onChange={(event) => set("classCode", event.target.value)} style={inputStyle}>{["SL", "3A", "2A", "1A", "CC", "EC", "2S"].map((item) => <option key={item}>{item}</option>)}</select><select value={input.quota} onChange={(event) => set("quota", event.target.value)} style={inputStyle}>{["GN", "TQ", "LD", "PT", "SS"].map((item) => <option key={item}>{item}</option>)}</select></>}</>;
    if (action === "station") return <>{field("stationCode", "Station code (e.g. NDLS)", { onChange: (event) => set("stationCode", event.target.value.toUpperCase()) })}<select value={input.stationHours} onChange={(event) => set("stationHours", event.target.value)} style={inputStyle}>{["2", "4", "8"].map((item) => <option key={item}>{item} hrs</option>)}</select></>;
    if (action === "search") return <>{field("fromStation", "From station code", { onChange: (event) => set("fromStation", event.target.value.toUpperCase()) })}{field("toStation", "To station code", { onChange: (event) => set("toStation", event.target.value.toUpperCase()) })}{field("journeyDate", "", { type: "date", value: dateToInput(input.journeyDate), onChange: (event) => set("journeyDate", inputToDate(event.target.value)) })}</>;
    if (["stationSearch", "trainNameSearch"].includes(action)) return field("name", action === "stationSearch" ? "Station name" : "Train name");
    if (["stationCode", "timetable"].includes(action)) return <>{field("stationCode", "Station code", { onChange: (event) => set("stationCode", event.target.value.toUpperCase()) })}{action === "timetable" && field("timetableDate", "", { type: "date", value: dateToInput(input.timetableDate), onChange: (event) => set("timetableDate", inputToDate(event.target.value)) })}</>;
    return <div style={{ gridColumn: "1 / -1", padding: "11px 12px", borderRadius: 8, border: dark ? "1px solid #2d3548" : "1px solid #e5e7eb", color: textColor, fontSize: 12 }}>No input required. Run the request to fetch all cancelled trains.</div>;
  };

  return <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 0.9fr" }}>
    <div style={{ ...panel, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}><p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>API Playground</p><span style={{ color: apiKey ? (dark ? "#6ee7b7" : "#16a34a") : "#fca5a5", fontSize: 11 }}>{apiKey ? (dark ? "Admin API key" : "Using your API key") : "API key missing"}</span></div>
      <p style={{ color: textColor, fontSize: 12, lineHeight: 1.7, margin: "0 0 18px" }}>Run live requests without leaving your workspace.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>{actions.map((item) => <button type="button" key={item.id} onClick={() => selectAction(item.id)} style={{ background: action === item.id ? (dark ? "#1e2a3a" : "#000") : (dark ? "#131722" : "#f3f4f6"), border: `1px solid ${action === item.id ? (dark ? "#2d4060" : "#000") : (dark ? "#1f2432" : "#e5e7eb")}`, color: action === item.id ? (dark ? "#60a5fa" : "#fff") : textColor, borderRadius: 6, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{!dark && item.id === "availability" ? "Seat" : item.label}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{fields()}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}><button type="button" onClick={run} disabled={loading} style={{ background: loading ? (dark ? "#1a1f2e" : "#e5e7eb") : (dark ? "linear-gradient(135deg, #059669, #047857)" : "#000"), color: loading ? textColor : "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "Running..." : "Run Request"}</button>{status !== null && <span style={{ color: status < 400 ? (dark ? "#6ee7b7" : "#16a34a") : "#fca5a5", fontSize: 11 }}>HTTP {status}</span>}{duration !== null && <span style={{ color: dark ? "#93c5fd" : "#2563eb", fontSize: 11 }}>{duration}ms</span>}</div>
      {error && <p style={{ marginTop: 10, color: dark ? "#fda4af" : "#dc2626", fontSize: 12 }}>{error}</p>}
    </div>
    <div style={{ ...panel, borderRadius: 12, overflow: "hidden", minHeight: 420 }}><div style={{ background: dark ? "#0a0d13" : "#f9fafb", borderBottom: `1px solid ${dark ? "#1e2330" : "#ebebeb"}`, padding: "12px 14px", display: "flex", justifyContent: "space-between" }}><span style={{ color: textColor, fontSize: 11, letterSpacing: "0.08em" }}>RESPONSE</span><span style={{ color: textColor, fontSize: 11 }}>JSON</span></div><div style={{ padding: 14 }}>{loading ? <PlaygroundSkeleton dark={dark} /> : <SyntaxHighlighter language="json" style={nightOwl} customStyle={{ margin: 0, background: "transparent", fontSize: 12, lineHeight: 1.7, minHeight: 360, maxHeight: 520, borderRadius: 8, overflow: "auto", padding: 0 }}>{response || '{\n  "message": "Run a request to preview the live response"\n}'}</SyntaxHighlighter>}</div></div>
  </div>;
}
