"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import useSWR from "swr";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  checkPNRStatus,
  configure,
  fareLookup,
  getAvailability,
  getTrainHistory,
  getTrainInfo,
  liveAtStation,
  searchTrainBetweenStations,
  trackTrain,
} from "railkit";
import { auth } from "../../lib/firebase";
import { TOPUP_OPTIONS } from "../../lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────
type DbUser = {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  usage: number;
  limit: number;
  active: boolean;
  plan: string;
  billingDate?: string;
  expirationDate?: string | null;
};

type Order = {
  _id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  credited: boolean;
  createdAt?: string;
};

type VerifyUserResponse = {
  success: boolean;
  user: DbUser;
  logs?: {
    timelineDays: number;
    dailyUsage: Array<{ date: string; requests: number }>;
    recent: Array<{
      id: string;
      email: string;
      statusCode: number;
      path: string;
      ip: string;
      duration: number;
      createdAt: string;
    }>;
  };
  message?: string;
};

type UserOrdersResponse = {
  success: boolean;
  orders: Order[];
  message?: string;
};

class FetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

type ApiCodeLanguage = "javascript" | "python" | "curl";
type CashfreeCheckoutMode = "sandbox" | "production";
type CashfreeCheckoutClient = {
  checkout: (options: { paymentSessionId: string; redirectTarget: "_modal" }) => Promise<unknown>;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: CashfreeCheckoutMode }) => CashfreeCheckoutClient;
  }
}

type ActiveTab = "overview" | "apikey" | "apiendpoints" | "playground" | "logs" | "orders";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new FetchError(
      data?.message || `Fetch failed: ${res.status}`,
      res.status
    );
  }
  return data as T;
};

let cashfreeLoadPromise: Promise<void> | null = null;

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Cashfree checkout is unavailable"));
  if (window.Cashfree) return Promise.resolve();
  if (cashfreeLoadPromise) return cashfreeLoadPromise;
  cashfreeLoadPromise = new Promise<void>((resolve, reject) => {
    const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CASHFREE_SDK_URL}"]`);
    if (existing) {
      if (window.Cashfree) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Cashfree SDK")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CASHFREE_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(script);
  });
  cashfreeLoadPromise.catch(() => { cashfreeLoadPromise = null; });
  return cashfreeLoadPromise;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

// ─── Loader ───────────────────────────────────────────────────────────────────
function Loader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <div className="relative mb-6">
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #e5e7eb", borderTop: "2px solid #000", animation: "spin 0.8s linear infinite" }} />
      </div>
      <p style={{ color: "#9ca3af", fontFamily: "var(--font-dashboard-body), var(--font-noto), sans-serif", fontSize: 13, letterSpacing: "0.04em" }}>{text}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PlaygroundResponseSkeleton() {
  const lineWidths = ["92%", "84%", "88%", "66%", "90%", "72%", "58%"];
  return (
    <div style={{ minHeight: 320, overflow: "hidden", padding: "2px 0" }}>
      <div style={{ width: 96, height: 10, borderRadius: 999, marginBottom: 14, background: "linear-gradient(90deg, #e5e7eb 25%, #e5e7eb 50%, #e5e7eb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
      {lineWidths.map((width, index) => (
        <div key={`${width}-${index}`} style={{ width, height: 10, borderRadius: 999, marginBottom: index === lineWidths.length - 1 ? 0 : 10, background: "linear-gradient(90deg, #f9fafb 25%, #e5e7eb 50%, #f9fafb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite", animationDelay: `${index * 0.08}s` }} />
      ))}
    </div>
  );
}

function ApiKeySkeleton() {
  return <div style={{ width: "100%", height: 14, borderRadius: 999, background: "linear-gradient(90deg, #e5e7eb 25%, #e5e7eb 50%, #e5e7eb 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.3s ease-in-out infinite" }} />;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconKey = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const IconEye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.76 21.76 0 0 1 5.06-6.94" />
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.78 21.78 0 0 1-3.31 4.53" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// Sidebar nav icons
const IconOverview = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconCode = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const IconTerminal = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);
const IconActivity = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconReceipt = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconEndpoints = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// ─── Plan / Status Badges ─────────────────────────────────────────────────────
const PlanBadge = ({ plan }: { plan: string }) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    free:       { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
    pro:        { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
    enterprise: { bg: "#faf5ff", text: "#7c3aed", border: "#e9d5ff" },
    advance:    { bg: "#faf5ff", text: "#7c3aed", border: "#e9d5ff" },
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-dashboard-body), var(--font-noto), sans-serif", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {plan}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    paid:      { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", dot: "#22c55e" },
    created:   { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", dot: "#9ca3af" },
    failed:    { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", dot: "#ef4444" },
    cancelled: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa", dot: "#f97316" },
    expired:   { bg: "#f9fafb", text: "#9ca3af", border: "#e5e7eb", dot: "#d1d5db" },
  };
  const s = styles[status] ?? styles.created;
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontFamily: "var(--font-dashboard-body), var(--font-noto), sans-serif", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status.toUpperCase()}
    </span>
  );
};

// ─── Billing Timer ────────────────────────────────────────────────────────────
function useBillingTimer(user: DbUser | null) {
  const [display, setDisplay] = useState("");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const update = () => {
      if (!user) { setDisplay("Not started"); setPct(0); return; }
      if (user.plan === "free") { setDisplay("Free plan"); setPct(100); return; }
      const now = Date.now();
      const expirationAt = user.expirationDate ? new Date(user.expirationDate).getTime() : NaN;
      if (Number.isFinite(expirationAt) && expirationAt > now) {
        const remaining = expirationAt - now;
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        setDisplay(days > 0 ? `${days}d ${hours}h left` : `${hours}h ${minutes}m left`);
        if (user.billingDate) {
          const start = new Date(user.billingDate).getTime();
          const total = Number.isFinite(start) && expirationAt > start ? expirationAt - start : remaining;
          setPct(Math.max(0, Math.min(100, (remaining / Math.max(total, 1)) * 100)));
        } else { setPct(100); }
        return;
      }
      if (!user.billingDate) { setDisplay("Not started"); setPct(0); return; }
      const CYCLE = 30 * 24 * 60 * 60 * 1000;
      const start = new Date(user.billingDate).getTime();
      if (Number.isNaN(start)) { setDisplay("Invalid date"); setPct(0); return; }
      const end = start + CYCLE;
      const remaining = end - now;
      if (remaining <= 0) { setDisplay("Expired"); setPct(0); return; }
      setPct((remaining / CYCLE) * 100);
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setDisplay(days > 0 ? `${days}d ${hours}h left` : `${hours}h ${Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))}m left`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [user?.plan, user?.billingDate, user?.expirationDate]);

  const color = display === "Expired" ? "#dc2626" : pct > 50 ? "#16a34a" : pct > 20 ? "#d97706" : "#dc2626";
  return { display, pct, color };
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
function OrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div
      className="db-modal-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(8px)" }}
    >
      <div
        className="db-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 24, padding: 32, width: "100%", maxWidth: 480, fontFamily: "var(--font-dashboard-body), var(--font-noto), sans-serif", boxShadow: "0 20px 56px rgba(0,0,0,0.12)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ color: "#000", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-dashboard-display), var(--font-dashboard-body), sans-serif" }}>Order Details</span>
          <button type="button" onClick={onClose} aria-label="Close order details" style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IconX />
          </button>
        </div>
        {[
          ["Order ID", order.orderId],
          ["Amount", `₹${order.amount.toFixed(2)} ${order.currency}`],
          ["Status", order.status],
          ["Credited", order.credited ? "Yes" : "No"],
          ["Date", order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "—"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dashboard-body), var(--font-noto), sans-serif", fontWeight: 600 }}>{k}</span>
            <span style={{ color: "#374151", fontSize: 13, fontFamily: "var(--font-dashboard-body), var(--font-noto), sans-serif" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const authRetryRef = useRef<number | null>(null);
  const authRetryCountRef = useRef(0);
  const [copied, setCopied] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [limitPurchaseLoading, setLimitPurchaseLoading] = useState(false);
  const [limitPurchaseMessage, setLimitPurchaseMessage] = useState<string | null>(null);
  const [verifiedReturnOrderId, setVerifiedReturnOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [logsTimelineDays, setLogsTimelineDays] = useState<14 | 30>(14);
  const [topupSelection, setTopupSelection] = useState(1);
  const [apiCodeLanguage, setApiCodeLanguage] = useState<ApiCodeLanguage>("javascript");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPricingNotice, setShowPricingNotice] = useState(false);
  const [playgroundAction, setPlaygroundAction] = useState<"pnr" | "train" | "track" | "history" | "station" | "search" | "seat" | "fare">("pnr");
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundStatusCode, setPlaygroundStatusCode] = useState<number | null>(null);
  const [playgroundResponseTime, setPlaygroundResponseTime] = useState<number | null>(null);
  const [playgroundResultText, setPlaygroundResultText] = useState("");
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [pnrInput, setPnrInput] = useState("");
  const [trainInput, setTrainInput] = useState("");
  const [trackTrainInput, setTrackTrainInput] = useState("");
  const [trackDateInput, setTrackDateInput] = useState("");
  const [historyTrainInput, setHistoryTrainInput] = useState("");
  const [historyDateInput, setHistoryDateInput] = useState("");
  const [stationInput, setStationInput] = useState("");
  const [stationHoursInput, setStationHoursInput] = useState<"2" | "4" | "8">("2");
  const [fromStationInput, setFromStationInput] = useState("");
  const [toStationInput, setToStationInput] = useState("");
  const [searchDateInput, setSearchDateInput] = useState("");
  const [seatTrainInput, setSeatTrainInput] = useState("");
  const [seatFromInput, setSeatFromInput] = useState("");
  const [seatToInput, setSeatToInput] = useState("");
  const [seatDateInput, setSeatDateInput] = useState("");
  const [seatClassInput, setSeatClassInput] = useState("SL");
  const [seatQuotaInput, setSeatQuotaInput] = useState("GN");
  const [fareTrainInput, setFareTrainInput] = useState("");
  const [fareFromInput, setFareFromInput] = useState("");
  const [fareToInput, setFareToInput] = useState("");
  const [fareDateInput, setFareDateInput] = useState("");
  const [fareClassInput, setFareClassInput] = useState("SL");
  const [fareQuotaInput, setFareQuotaInput] = useState("GN");

  const { data: userData, error: userError, isLoading: userLoading, isValidating: userValidating, mutate: mutateUser } =
    useSWR<VerifyUserResponse>(`/api/user/verify?days=${logsTimelineDays}`, fetcher, { revalidateOnFocus: true });

  const { data: ordersData, isLoading: ordersLoading, isValidating: ordersValidating, mutate: mutateOrders } =
    useSWR<UserOrdersResponse>("/api/user/orders", fetcher, { revalidateOnFocus: true });

  const dbUser = userData?.user ?? null;
  const dbUserId = dbUser?.id;
  const auditDailyUsage = userData?.logs?.dailyUsage ?? [];
  const recentLogs = userData?.logs?.recent ?? [];
  const orders = ordersData?.orders ?? [];
  const loading = userLoading || ordersLoading;
  const refreshing = userValidating || ordersValidating;

  useEffect(() => {
    if (!dbUserId) {
      setShowPricingNotice(false);
      return;
    }

    const priceChangeAt = new Date("2026-08-01T00:00:00+05:30").getTime();
    setShowPricingNotice(Date.now() < priceChangeAt);
  }, [dbUserId]);

  const selectedTopup = TOPUP_OPTIONS[topupSelection] || TOPUP_OPTIONS[0];
  const billing = useBillingTimer(dbUser);

  const activeExpirationTimestamp = dbUser?.expirationDate ? new Date(dbUser.expirationDate).getTime() : NaN;
  const hasActiveExpirationOverride = Number.isFinite(activeExpirationTimestamp) && activeExpirationTimestamp > Date.now();

  useEffect(() => {
    if (!userError) {
      authRetryCountRef.current = 0;
      if (authRetryRef.current) {
        window.clearTimeout(authRetryRef.current);
        authRetryRef.current = null;
      }
      return;
    }

    const status = userError instanceof FetchError ? userError.status : undefined;
    const isAuthFailure = status === 401 || status === 403;

    if (!isAuthFailure) {
      return;
    }

    if (authRetryCountRef.current === 0) {
      authRetryCountRef.current = 1;
      authRetryRef.current = window.setTimeout(() => {
        mutateUser();
      }, 350);
      return;
    }

    router.replace("/");
  }, [userError, mutateUser, router]);

  useEffect(() => {
    return () => {
      if (authRetryRef.current) {
        window.clearTimeout(authRetryRef.current);
      }
    };
  }, []);

  const refreshAll = () => { mutateUser(); mutateOrders(); };

  const verifyLimitTopup = useCallback(async (orderId: string) => {
    setLimitPurchaseLoading(true);
    setLimitPurchaseMessage("Verifying payment...");
    try {
      const response = await fetch("/api/user/increase-limit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.message || "Unable to verify payment");
      if (!data?.paid) { setLimitPurchaseMessage("Payment is still pending. Please retry in a moment."); return data; }
      setLimitPurchaseMessage(`Limit increased by ${Number(data.extraLimit || 0).toLocaleString("en-IN")} requests.`);
      await mutateUser();
      return data;
    } catch (error: unknown) {
      setLimitPurchaseMessage(getErrorMessage(error, "Payment verification failed. Please try again."));
      throw error;
    } finally { setLimitPurchaseLoading(false); }
  }, [mutateUser]);

  const startLimitTopupPayment = async () => {
    if (limitPurchaseLoading) return;
    setLimitPurchaseLoading(true);
    setLimitPurchaseMessage(null);
    try {
      const response = await fetch("/api/user/increase-limit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraLimit: selectedTopup.requests }) });
      const data = await response.json();
      const order = data?.order as { orderId?: string; paymentSessionId?: string } | undefined;
      if (!response.ok || !order?.orderId || !order?.paymentSessionId) throw new Error(data?.message || "Unable to create payment order");
      await loadCashfreeSdk();
      if (!window.Cashfree) throw new Error("Cashfree checkout failed to load. Please refresh and try again.");
      setLimitPurchaseMessage("Opening secure payment popup...");
      const cashfree = window.Cashfree({ mode: data?.cashfreeMode === "sandbox" ? "sandbox" : "production" });
      try { await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_modal" }); } catch { /* modal close */ }
      await verifyLimitTopup(order.orderId);
    } catch (error: unknown) {
      setLimitPurchaseMessage(getErrorMessage(error, "Unable to process limit add-on. Please try again."));
      setLimitPurchaseLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentReturn = params.get("payment_return");
    const orderId = params.get("order_id");
    if (paymentReturn !== "limit" || !orderId || verifiedReturnOrderId === orderId) return;
    setVerifiedReturnOrderId(orderId);
    verifyLimitTopup(orderId).catch(() => {});
  }, [verifiedReturnOrderId, verifyLimitTopup]);

  const onLogout = async () => {
    try { await signOut(auth); await fetch("/api/user/verify", { method: "DELETE" }); } catch {}
    router.replace("/");
  };

  const copyApiKey = () => {
    if (dbUser?.apiKey) { navigator.clipboard.writeText(dbUser.apiKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const regenerateApiKey = async () => {
    if (!dbUser?.apiKey || !dbUser?.email || regeneratingKey) return;
    setRegeneratingKey(true); setRegenerateError(null); setCopied(false);
    try {
      const res = await fetch("/api/user/key/regenerate", { method: "GET" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to regenerate key");
      setKeyVisible(true);
      await mutateUser();
    } catch (error) {
      setRegenerateError(error instanceof Error ? error.message : "Failed to regenerate key");
    } finally { setRegeneratingKey(false); }
  };

  const toInputDate = (ddmmyyyy: string) => {
    if (!ddmmyyyy || !ddmmyyyy.includes("-")) return "";
    const [dd, mm, yyyy] = ddmmyyyy.split("-");
    return `${yyyy}-${mm}-${dd}`;
  };
  const fromInputDate = (yyyymmdd: string) => {
    if (!yyyymmdd || !yyyymmdd.includes("-")) return "";
    const [yyyy, mm, dd] = yyyymmdd.split("-");
    return `${dd}-${mm}-${yyyy}`;
  };

  const resetPlaygroundMeta = () => { setPlaygroundError(null); setPlaygroundStatusCode(null); setPlaygroundResponseTime(null); setPlaygroundResultText(""); };

  const runPlayground = async () => {
    setPlaygroundLoading(true);
    resetPlaygroundMeta();
    const start = performance.now();
    try {
      const apiKey = dbUser?.apiKey;
      if (!apiKey) throw new Error("Session expired. Please refresh and sign in again.");
      configure(apiKey);
      let result: unknown;
      switch (playgroundAction) {
        case "pnr":
          if (!/^\d{10}$/.test(pnrInput)) throw new Error("PNR must be exactly 10 digits");
          result = await checkPNRStatus(pnrInput); break;
        case "train":
          if (!/^\d{5}$/.test(trainInput)) throw new Error("Train number must be exactly 5 digits");
          result = await getTrainInfo(trainInput); break;
        case "track":
          if (!/^\d{5}$/.test(trackTrainInput)) throw new Error("Train number must be exactly 5 digits");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(trackDateInput)) throw new Error("Date must be in DD-MM-YYYY format");
          result = await trackTrain(trackTrainInput, trackDateInput); break;
        case "history":
          if (!/^\d{5}$/.test(historyTrainInput)) throw new Error("Train number must be exactly 5 digits");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(historyDateInput)) throw new Error("Date must be in DD-MM-YYYY format");
          result = await getTrainHistory(historyTrainInput, historyDateInput); break;
        case "station":
          if (!stationInput.trim()) throw new Error("Station code is required");
          result = await liveAtStation(stationInput.trim().toUpperCase(), Number(stationHoursInput) as 2 | 4 | 8); break;
        case "search":
          if (!fromStationInput.trim() || !toStationInput.trim()) throw new Error("From and To station codes are required");
          if (searchDateInput && !/^\d{2}-\d{2}-\d{4}$/.test(searchDateInput)) throw new Error("Date must be in DD-MM-YYYY format");
          result = await searchTrainBetweenStations(fromStationInput.trim().toUpperCase(), toStationInput.trim().toUpperCase(), searchDateInput || undefined); break;
        case "seat":
          if (!/^\d{5}$/.test(seatTrainInput)) throw new Error("Train number must be exactly 5 digits");
          if (!seatFromInput.trim() || !seatToInput.trim()) throw new Error("From and To station codes are required");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(seatDateInput)) throw new Error("Date must be in DD-MM-YYYY format");
          result = await getAvailability(seatTrainInput, seatFromInput.trim().toUpperCase(), seatToInput.trim().toUpperCase(), seatDateInput, seatClassInput, seatQuotaInput); break;
        case "fare":
          if (!/^\d{5}$/.test(fareTrainInput)) throw new Error("Train number must be exactly 5 digits");
          if (!fareFromInput.trim() || !fareToInput.trim()) throw new Error("From and To station codes are required");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(fareDateInput)) throw new Error("Date must be in DD-MM-YYYY format");
          result = await fareLookup(fareTrainInput, fareFromInput.trim().toUpperCase(), fareToInput.trim().toUpperCase(), fareDateInput, fareClassInput, fareQuotaInput); break;
      }
      const codeGuess = typeof result === "object" && result !== null && "statusCode" in result && typeof (result as { statusCode?: unknown }).statusCode === "number"
        ? ((result as { statusCode: number }).statusCode ?? 200) : 200;
      setPlaygroundStatusCode(codeGuess);
      setPlaygroundResultText(JSON.stringify(result, null, 2) || "{}");
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number; response?: { status?: number } };
      setPlaygroundError(err?.message || "Something went wrong");
      setPlaygroundStatusCode(err?.status || err?.response?.status || 500);
      setPlaygroundResultText(JSON.stringify({ success: false, message: err?.message || "Something went wrong", statusCode: err?.status || err?.response?.status || 500 }, null, 2));
    } finally {
      setPlaygroundResponseTime(Math.round(performance.now() - start));
      setPlaygroundLoading(false);
    }
  };

  if (loading) return <Loader text="Fetching your workspace..." />;
  if (!dbUser) return null;

  const usagePct = dbUser.limit > 0 ? (dbUser.usage / dbUser.limit) * 100 : 0;
  const usageLeft = Math.max(0, dbUser.limit - dbUser.usage);
  const usageColor = usagePct > 80 ? "#ea580c" : usagePct > 60 ? "#d97706" : "#16a34a";
  const maxDailyRequests = Math.max(1, ...auditDailyUsage.map((e) => e.requests));
  const chartData = auditDailyUsage.map((entry) => ({ ...entry, label: new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) }));
  const maskedKey = dbUser.apiKey ? `${dbUser.apiKey.slice(0, 8)}${"•".repeat(24)}${dbUser.apiKey.slice(-6)}` : "";
  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalSpent = paidOrders.reduce((a, o) => a + o.amount, 0);
  const normalizedPlan = (dbUser.plan || "").toLowerCase();
  const avatarSeed = encodeURIComponent(dbUser.name || dbUser.email);
  const dicebearUrl = `https://api.dicebear.com/10.x/pixel-art/svg?seed=${avatarSeed}`;
  const canBuyLimitTopup = normalizedPlan === "pro" || normalizedPlan === "enterprise" || normalizedPlan === "advance" || normalizedPlan === "advanced";
  const directApiBaseUrl = process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL || "https://railkit-api.rajivdubey.dev";

  const apiLanguageMeta: Record<ApiCodeLanguage, { label: string; syntax: "javascript" | "python" | "bash" }> = {
    javascript: { label: "JavaScript", syntax: "javascript" },
    python: { label: "Python", syntax: "python" },
    curl: { label: "cURL", syntax: "bash" },
  };

  const buildApiSnippet = (examplePath: string, language: ApiCodeLanguage) => {
    const url = `${directApiBaseUrl}${examplePath}`;
    if (language === "python") return `import requests\n\nurl = "${url}"\nheaders = {\n    "x-api-key": "YOUR_API_KEY",\n    "accept": "application/json",\n}\n\nresponse = requests.get(url, headers=headers)\ndata = response.json()\nprint(data)`;
    if (language === "curl") return `curl -X GET "${url}" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "accept: application/json"`;
    return `const API_KEY = process.env.RAILKIT_API_KEY;\n\nconst response = await fetch("${url}", {\n  method: "GET",\n  headers: {\n    "x-api-key": API_KEY,\n    "accept": "application/json",\n  },\n});\n\nconst data = await response.json();\nconsole.log(data);`;
  };

  const usageExampleCode = `import {\n  configure,\n  checkPNRStatus,\n  getTrainInfo,\n  trackTrain,\n  getTrainHistory,\n} from "railkit";\n\n// Step 1: configure once with your API key\nconfigure(process.env.RAILKIT_API_KEY);\n\n// Check PNR status\nconst pnrResult = await checkPNRStatus("1234567890");\n\n// Get train information\nconst trainResult = await getTrainInfo("12345");\n\n// Track Live Train\nconst liveTrainResult = await trackTrain("12345", "28-03-2026");\n\n// Get Train History (for completed journeys)\nconst historyResult = await getTrainHistory("12345", "28-03-2026");`;

  const endpointDocs = [
    { name: "Check PNR Status", method: "GET", path: "/api/checkPNRStatus/:pnr", examplePath: "/api/checkPNRStatus/1234567890", notes: "PNR must be 10 digits." },
    { name: "Get Train Info", method: "GET", path: "/api/getTrainInfo/:trainNumber", examplePath: "/api/getTrainInfo/12345", notes: "Train number must be 5 digits." },
    { name: "Track Train", method: "GET", path: "/api/trackTrain/:trainNumber/:date", examplePath: "/api/trackTrain/12345/28-03-2026", notes: "Date format: DD-MM-YYYY. You can also pass `today` as date." },
    { name: "Live At Station", method: "GET", path: "/api/liveAtStation/:stnCode?hrs=2|4|8", examplePath: "/api/liveAtStation/NDLS?hrs=4", notes: "Use station code in uppercase. Optional ?hrs= query param accepts 2, 4, or 8 (default 2)." },
    { name: "Get Train History", method: "GET", path: "/api/trainHistory/:trainNo/:journeyDate", examplePath: "/api/trainHistory/12345/15-04-2025", notes: "Date format: DD-MM-YYYY. Returns 404 if the train has not yet completed the journey for that date." },
    { name: "Search Trains Between Stations", method: "GET", path: "/api/searchTrainBetweenStations/:fromStnCode/:toStnCode?date=DD-MM-YYYY", examplePath: "/api/searchTrainBetweenStations/NDLS/BCT?date=28-03-2026", notes: "Date query param is optional." },
    { name: "Get Seat Availability", method: "GET", path: "/api/getAvailability/:trainNo/:fromStnCode/:toStnCode/:date/:coach/:quota", examplePath: "/api/getAvailability/12496/ASN/DDU/27-12-2025/2A/GN", notes: "Date format: DD-MM-YYYY." },
    { name: "Fare Lookup", method: "GET", path: "/api/fareLookup/:trainNo/:date/:fromStation/:toStation/:class/:quota", examplePath: "/api/fareLookup/12313/06-06-2026/ASN/NDLS/3A/GN", notes: "Returns full fare breakdown — base fare, GST, dynamic fare, total. Date format: DD-MM-YYYY." },
  ] as const;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "overview",     label: "Overview",       icon: <IconOverview /> },
    { id: "apikey",       label: "API Key",         icon: <IconKey /> },
    { id: "apiendpoints", label: "API Endpoints",   icon: <IconEndpoints /> },
    { id: "playground",   label: "Playground",      icon: <IconTerminal /> },
    { id: "logs",         label: "Logs",            icon: <IconActivity />, badge: recentLogs.length > 0 ? (recentLogs.length > 99 ? "99+" : String(recentLogs.length)) : undefined },
    { id: "orders",       label: "Orders",          icon: <IconReceipt />,  badge: orders.length > 0 ? String(orders.length) : undefined },
  ];

  return (
    <>
      <style>{`
        .db-root {
          --rail-ink: #17324d;
          --rail-blue: #2764e7;
          --rail-mango: #ffcf4a;
          --rail-coral: #ff745c;
          --rail-mint: #9fe3c2;
          --rail-paper: #fffdf7;
          --rail-line: #d9e2e8;
          font-family: var(--font-dashboard-body), var(--font-noto), sans-serif;
          color: var(--rail-ink);
          background:
            radial-gradient(circle at 8% 12%, rgba(255, 207, 74, .32) 0 120px, transparent 121px),
            radial-gradient(circle at 94% 30%, rgba(159, 227, 194, .3) 0 150px, transparent 151px),
            linear-gradient(rgba(23, 50, 77, .035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(23, 50, 77, .035) 1px, transparent 1px),
            #f5f2e9;
          background-size: auto, auto, 32px 32px, 32px 32px, auto;
          min-height: 100vh;
          padding-top: 60px;
        }
        .db-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .db-root button,
        .db-root input,
        .db-root select { font-family: inherit; }

        .db-layout {
          display: flex;
          min-height: calc(100vh - 60px);
          max-width: 1440px;
          margin: 0 auto;
          padding: 28px clamp(18px, 3vw, 44px) 48px;
          gap: 24px;
          align-items: flex-start;
        }

        .db-sidebar {
          width: 236px;
          flex-shrink: 0;
          background: var(--rail-ink);
          border: 2px solid var(--rail-ink);
          border-radius: 28px;
          box-shadow: 8px 8px 0 rgba(23, 50, 77, .13);
          position: sticky;
          top: 84px;
          max-height: calc(100vh - 108px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 16px 14px;
          gap: 4px;
          z-index: 10;
        }
        .db-user-pill {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.12) !important;
          border-radius: 18px;
          padding: 10px !important;
          margin-bottom: 12px !important;
        }
        .db-user-pill img {
          border: 2px solid var(--rail-mango) !important;
          border-radius: 50% !important;
          background: var(--rail-paper) !important;
        }
        .db-user-pill p:first-child { color: #fff !important; }
        .db-user-pill p:last-child { color: #aebfd0 !important; }

        .db-sidebar-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--rail-mango);
          padding: 6px 12px 7px;
          margin-top: 2px;
        }

        .db-nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-height: 44px;
          padding: 10px 12px 10px 16px;
          border-radius: 14px;
          border: 1px solid transparent;
          background: transparent;
          color: #c8d5e0;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          text-align: left;
          transition: transform .16s ease, background .16s ease, color .16s ease;
          position: relative;
        }
        .db-nav-btn::before {
          content: "";
          position: absolute;
          left: 5px;
          width: 7px;
          height: 7px;
          border: 2px solid #7f95a9;
          border-radius: 50%;
          background: var(--rail-ink);
        }
        .db-nav-btn:not(:last-of-type)::after {
          content: "";
          position: absolute;
          left: 8px;
          top: 29px;
          width: 1px;
          height: 24px;
          background: #637c92;
        }
        .db-nav-btn:hover { background: rgba(255,255,255,.08); color: #fff; transform: translateX(2px); }
        .db-nav-btn.active {
          background: var(--rail-mango);
          border-color: #ffe495;
          color: var(--rail-ink);
          box-shadow: 3px 3px 0 var(--rail-coral);
        }
        .db-nav-btn.active::before { background: var(--rail-coral); border-color: #fff; }
        .db-nav-btn svg { opacity: .75; flex-shrink: 0; margin-left: 3px; }
        .db-nav-btn.active svg { opacity: 1; }
        .db-nav-badge {
          margin-left: auto;
          background: rgba(255,255,255,.14);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
          line-height: 1.6;
        }
        .db-nav-btn.active .db-nav-badge { background: var(--rail-ink); color: #fff; }

        .db-sidebar-footer {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px dashed rgba(255,255,255,.2);
        }
        .db-sidebar-footer button { color: #aebfd0 !important; }

        .db-main {
          flex: 1;
          min-width: 0;
          padding: 0;
          background: transparent;
          border: none;
        }
        .db-main > *,
        .db-card,
        .db-card > *,
        .db-titlebar > * { min-width: 0; }
        .db-root img { max-width: 100%; }
        .db-root pre { max-width: 100%; }

        .db-titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 128px;
          margin-bottom: 20px;
          padding: 24px 28px;
          background: var(--rail-blue);
          border: 2px solid var(--rail-ink);
          border-radius: 28px;
          box-shadow: 7px 7px 0 var(--rail-ink);
          position: relative;
          overflow: hidden;
          flex-wrap: wrap;
          gap: 16px;
        }
        .db-titlebar::after {
          content: "••••••••••";
          position: absolute;
          right: 24px;
          bottom: -9px;
          color: rgba(255,255,255,.23);
          font-size: 24px;
          letter-spacing: 8px;
          transform: rotate(-4deg);
        }
        .db-title {
          font-family: var(--font-dashboard-display), sans-serif;
          font-size: clamp(32px, 4.2vw, 54px);
          font-weight: 650;
          color: #fff;
          letter-spacing: -.04em;
          line-height: .95;
        }
        .db-subtitle {
          font-size: 14px;
          color: #dce8ff;
          margin-top: 9px;
          font-weight: 650;
        }

        .db-card {
          background: var(--rail-paper);
          border: 2px solid var(--rail-ink);
          border-radius: 22px;
          padding: 24px;
          box-shadow: 4px 4px 0 rgba(23, 50, 77, .16);
        }
        .db-card-sm {
          background: var(--rail-paper);
          border: 2px solid var(--rail-ink);
          border-radius: 16px;
          padding: 16px 18px;
        }
        .db-card-dark {
          background: #11263b;
          border: 2px solid var(--rail-ink);
          border-radius: 22px;
          box-shadow: 5px 5px 0 var(--rail-mango);
        }
        .db-stat {
          min-height: 134px;
          position: relative;
          overflow: hidden;
        }
        .db-stat::after {
          content: "";
          position: absolute;
          width: 24px;
          height: 24px;
          right: -14px;
          top: calc(50% - 12px);
          border-radius: 50%;
          background: #f5f2e9;
          border: 2px solid var(--rail-ink);
        }
        .db-stat:nth-child(2) { background: #fff6d7; }
        .db-stat:nth-child(3) { background: #eaf8f1; }
        .db-stat:nth-child(4) { background: #fff0ec; }
        .db-stat p:nth-child(2) {
          font-family: var(--font-dashboard-display), sans-serif !important;
          font-weight: 650 !important;
        }

        .db-input {
          background: #fff;
          border: 2px solid #c8d4dc;
          border-radius: 12px;
          padding: 11px 13px;
          color: var(--rail-ink);
          font-size: 14px;
          outline: none;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .db-input:focus { border-color: var(--rail-blue); box-shadow: 0 0 0 4px rgba(39,100,231,.14); }
        .db-select {
          background: #fff;
          border: 2px solid #c8d4dc;
          border-radius: 12px;
          padding: 11px 13px;
          color: var(--rail-ink);
          font-size: 14px;
          outline: none;
          width: 100%;
        }
        .db-input:focus-visible,
        .db-select:focus-visible,
        .db-root button:focus-visible {
          outline: 3px solid var(--rail-coral);
          outline-offset: 3px;
        }

        .db-section-label {
          display: inline-flex;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--rail-ink);
          background: var(--rail-mango);
          border: 1px solid var(--rail-ink);
          border-radius: 999px;
          padding: 4px 10px;
          margin-bottom: 16px;
        }
        .row-hover:hover { background: #fff6d7 !important; }
        .db-root table { min-width: 680px; }
        .db-root th { color: #60778c !important; }
        .db-root tbody tr:last-child { border-bottom: 0 !important; }
        .db-table-scroll {
          max-width: 100%;
          overflow-x: auto;
          overscroll-behavior-inline: contain;
          scrollbar-gutter: stable;
        }
        .db-code-block {
          max-width: 100%;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch;
        }
        .db-key-row { min-width: 0; }
        .db-key-field { min-width: 0; }
        .db-key-value {
          min-width: 0;
          scrollbar-width: thin;
        }
        .db-break-anywhere { overflow-wrap: anywhere; word-break: break-word; }
        .db-modal {
          font-family: var(--font-dashboard-body), var(--font-noto), sans-serif !important;
          border: 2px solid #17324d !important;
          box-shadow: 6px 6px 0 #ffcf4a !important;
        }
        .db-price-overlay {
          position: fixed;
          inset: 0;
          z-index: 60;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(12, 34, 56, .58);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: noticeBackdrop .2s ease both;
        }
        .db-price-popup {
          position: relative;
          width: min(580px, calc(100vw - 32px));
          display: grid;
          grid-template-columns: 88px minmax(0, 1fr) 32px;
          gap: 20px;
          align-items: start;
          padding: 24px;
          color: #fff;
          background: var(--rail-ink);
          border: 2px solid #0c2238;
          border-radius: 22px;
          box-shadow: 7px 7px 0 var(--rail-mango), 0 20px 60px rgba(23, 50, 77, .25);
          animation: noticeArrive .38s cubic-bezier(.2,.8,.2,1) both;
        }
        .db-price-date {
          display: flex;
          min-height: 96px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--rail-mango);
          border: 2px solid #0c2238;
          border-radius: 15px;
          color: var(--rail-ink);
          transform: rotate(-2deg);
        }
        .db-price-date strong {
          font-family: var(--font-dashboard-display), sans-serif;
          font-size: 38px;
          line-height: .9;
          letter-spacing: -.04em;
        }
        .db-price-date span {
          margin-top: 7px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .11em;
        }
        .db-price-copy { min-width: 0; }
        .db-price-kicker {
          margin-bottom: 4px !important;
          color: #9fe3c2;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .db-price-title {
          color: #fff;
          font-family: var(--font-dashboard-display), sans-serif;
          font-size: 24px;
          font-weight: 650;
          line-height: 1.1;
          letter-spacing: -.02em;
        }
        .db-price-text {
          margin-top: 9px !important;
          color: #c8d5e0;
          font-size: 13px;
          line-height: 1.6;
        }
        .db-price-text + .db-price-text {
          margin-top: 8px !important;
        }
        .db-price-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        .db-price-link {
          border: 0;
          background: transparent;
          color: var(--rail-mango);
          font-size: 12px;
          font-weight: 850;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .db-price-close {
          align-self: start;
          display: inline-flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 50%;
          background: rgba(255,255,255,.08);
          color: #dce6ee;
          cursor: pointer;
          transition: background .15s ease, color .15s ease;
        }
        .db-price-close:hover { background: #fff; color: var(--rail-ink); }

        .db-mobile-tabs {
          display: none;
          gap: 8px;
          margin: 0 -2px 18px;
          padding: 3px 2px 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .db-mobile-tabs::-webkit-scrollbar { display: none; }
        .db-mobile-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          flex: 0 0 auto;
          padding: 10px 14px;
          border-radius: 999px;
          border: 2px solid var(--rail-ink);
          background: var(--rail-paper);
          color: var(--rail-ink);
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 2px 2px 0 rgba(23,50,77,.18);
        }
        .db-mobile-tab.active {
          background: var(--rail-mango);
          color: var(--rail-ink);
          transform: translateY(-2px);
          box-shadow: 3px 3px 0 var(--rail-coral);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes ticketIn { from { opacity: 0; transform: translateY(10px) rotate(-.5deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
        @keyframes noticeArrive { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes noticeBackdrop { from { opacity: 0; } to { opacity: 1; } }

        .db-stat { animation: ticketIn .42s cubic-bezier(.2,.8,.2,1) both; }
        .db-stat:nth-child(1) { animation-delay: 0.03s; }
        .db-stat:nth-child(2) { animation-delay: 0.07s; }
        .db-stat:nth-child(3) { animation-delay: 0.11s; }
        .db-stat:nth-child(4) { animation-delay: 0.15s; }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 4px; }

        @media (max-width: 1180px) {
          .db-playground-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1080px) {
          .db-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 900px) {
          .db-sidebar { display: none; }
          .db-layout { display: block; padding: 20px 18px 36px; }
          .db-mobile-tabs { display: flex; }
          .db-overview-grid { grid-template-columns: 1fr !important; }
          .db-playground-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .db-data-table {
            min-width: 0 !important;
            display: block;
          }
          .db-data-table thead { display: none; }
          .db-data-table tbody { display: grid; gap: 10px; padding: 10px; }
          .db-data-table tr {
            display: block;
            border: 2px solid #d9e2e8 !important;
            border-radius: 14px;
            overflow: hidden;
            background: #fffdf7;
          }
          .db-data-table td {
            display: grid;
            grid-template-columns: minmax(76px, .38fr) minmax(0, 1fr);
            align-items: center;
            gap: 12px;
            max-width: none !important;
            padding: 9px 12px !important;
            border-bottom: 1px dashed #d9e2e8;
            overflow-wrap: anywhere;
            white-space: normal !important;
          }
          .db-data-table td:last-child { border-bottom: 0; }
          .db-data-table td::before {
            content: attr(data-label);
            color: #60778c;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          .db-data-table td.db-empty-cell {
            display: block;
            padding: 28px 16px !important;
          }
          .db-data-table td.db-empty-cell::before { display: none; }
          .db-table-heading {
            align-items: flex-start !important;
            padding: 14px 16px !important;
            gap: 8px;
            flex-wrap: wrap;
          }
        }
        @media (max-width: 600px) {
          .db-root { padding-top: 54px; background-size: auto, auto, 24px 24px, 24px 24px, auto; }
          .db-layout { padding: 12px 10px 28px; }
          .db-titlebar { min-height: 0; padding: 22px 18px; border-radius: 22px; box-shadow: 5px 5px 0 var(--rail-ink); }
          .db-title { font-size: 34px; }
          .db-titlebar > div:last-child { width: 100%; }
          .db-titlebar > div:first-child { width: 100%; }
          .db-stats-grid { grid-template-columns: 1fr !important; }
          .db-card { padding: 18px; border-radius: 18px; box-shadow: 3px 3px 0 rgba(23,50,77,.16); }
          .db-stat { min-height: 112px; }
          .db-form-grid { grid-template-columns: 1fr !important; }
          .db-form-grid > * { grid-column: 1 !important; }
          .db-key-row { display: grid !important; grid-template-columns: 1fr; }
          .db-key-regen { width: 100%; justify-content: center; }
          .db-install-copy { line-height: 1.9 !important; }
          .db-profile-head { align-items: flex-start !important; }
          .db-profile-copy { min-width: 0; }
          .db-profile-copy p { overflow-wrap: anywhere; }
          .db-chart-wrap { height: 220px !important; padding: 6px !important; }
          .db-modal-backdrop { padding: 14px; }
          .db-modal { padding: 22px !important; border-radius: 20px !important; }
          [data-topup-overlay] { flex-direction: column; text-align: center; }
        }
        @media (max-width: 460px) {
          .db-mobile-tabs {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            overflow: visible;
          }
          .db-mobile-tab { width: 100%; padding-inline: 9px; }
          .db-titlebar { padding: 20px 16px; }
          .db-title { font-size: 30px; overflow-wrap: anywhere; }
          .db-card { padding: 16px; }
          .db-billing-summary { grid-template-columns: 1fr !important; }
          .db-modal [style*="justify-content: space-between"] {
            gap: 12px;
            align-items: flex-start !important;
          }
          .db-modal [style*="justify-content: space-between"] > :last-child {
            text-align: right;
            overflow-wrap: anywhere;
          }
          .db-price-popup {
            width: 100%;
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 13px;
            padding: 18px 44px 18px 16px;
            border-radius: 18px;
            box-shadow: 5px 5px 0 var(--rail-mango), 0 16px 42px rgba(23,50,77,.25);
          }
          .db-price-date { min-height: 72px; }
          .db-price-date strong { font-size: 27px; }
          .db-price-title { font-size: 19px; }
          .db-price-close {
            position: absolute;
            top: 10px;
            right: 10px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .db-root *, .db-root *::before, .db-root *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
          }
        }
        @media (hover: none) {
          [data-topup-overlay] { opacity: 1 !important; }
        }
      `}</style>

      {viewOrder && <OrderModal order={viewOrder} onClose={() => setViewOrder(null)} />}

      <div className="db-root">
        {showPricingNotice && (
          <div className="db-price-overlay" role="presentation">
            <aside className="db-price-popup" role="dialog" aria-modal="true" aria-labelledby="pricing-notice-title">
              <div className="db-price-date" aria-hidden="true">
                <strong>01</strong>
                <span>AUG</span>
              </div>
              <div className="db-price-copy">
                <p className="db-price-kicker">Pricing update</p>
                <h2 className="db-price-title" id="pricing-notice-title">Thank you for building with RailKit.</h2>
                <p className="db-price-text">
                  Your support and growing usage are helping RailKit reach more developers. To keep service reliable as demand grows, we are expanding and updating our infrastructure.
                </p>
                <p className="db-price-text">
                  From 1 August, paid plans increase by ₹10 and request-pack prices will also change. Current prices remain available until 31 July, 11:59 PM IST.
                </p>
                <div className="db-price-actions">
                  <button type="button" className="db-price-link" onClick={() => router.push("/pricing")}>
                    View current pricing
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="db-price-close"
                onClick={() => setShowPricingNotice(false)}
                aria-label="Dismiss pricing update"
              >
                <IconX />
              </button>
            </aside>
          </div>
        )}
        <div className="db-layout">

          {/* ── Left Sidebar ─────────────────────────────────────────────── */}
          <aside className={`db-sidebar${sidebarOpen ? " open" : ""}`}>
            {/* User pill */}
            <div className="db-user-pill" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 14px", borderBottom: "1px solid #f3f4f6", marginBottom: 8 }}>
              <img src={dicebearUrl} alt={dbUser.name || dbUser.email} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e5e7eb", flexShrink: 0, background: "#f3f4f6" }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dbUser.name || "User"}</p>
                <p style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{dbUser.email}</p>
              </div>
            </div>

            <p className="db-sidebar-label">Workspace</p>

            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`db-nav-btn${activeTab === item.id ? " active" : ""}`}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && <span className="db-nav-badge">{item.badge}</span>}
              </button>
            ))}

            <div className="db-sidebar-footer">
              <button
                type="button"
                onClick={refreshAll}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 9, border: "none", background: "transparent", color: "#9ca3af", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "color 0.15s, background 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
              >
                <span style={{ display: "inline-flex", animation: refreshing ? "spin 1s linear infinite" : "none" }}><IconRefresh /></span>
                {refreshing ? "Syncing..." : "Refresh data"}
              </button>
              <button
                type="button"
                onClick={onLogout}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 9, border: "none", background: "transparent", color: "#9ca3af", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "color 0.15s, background 0.15s", marginTop: 2 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          </aside>

          {/* ── Main Content ─────────────────────────────────────────────── */}
          <main className="db-main">
            {/* Title bar */}
            <div className="db-titlebar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div>
                  <h1 className="db-title">
                    {navItems.find(n => n.id === activeTab)?.label ?? "Dashboard"}
                  </h1>
                  <p className="db-subtitle">
                    {activeTab === "overview" && "Your usage at a glance"}
                    {activeTab === "apikey" && "Manage your secret key"}
                    {activeTab === "apiendpoints" && "Direct REST endpoints"}
                    {activeTab === "playground" && "Live test without leaving the dashboard"}
                    {activeTab === "logs" && "Recent API call history"}
                    {activeTab === "orders" && "Billing and payment history"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PlanBadge plan={dbUser.plan} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: dbUser.active ? "#16a34a" : "#9ca3af", background: dbUser.active ? "#f0fdf4" : "#f9fafb", border: `1px solid ${dbUser.active ? "#bbf7d0" : "#e5e7eb"}`, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dbUser.active ? "#22c55e" : "#d1d5db" }} />
                  {dbUser.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* ── Mobile tab bar (≤768px only) ── */}
            <div className="db-mobile-tabs" role="tablist">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  className={`db-mobile-tab${activeTab === item.id ? " active" : ""}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.icon}
                  {item.label}
                  {item.badge && (
                    <span style={{ background: activeTab === item.id ? "rgba(255,255,255,0.25)" : "#e5e7eb", color: activeTab === item.id ? "#fff" : "#6b7280", fontSize: 10, fontWeight: 700, padding: "0px 5px", borderRadius: 999, lineHeight: "18px" }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Overview ─────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div style={{ display: "grid", gap: 16 }}>
                {/* Stats grid */}
                <div className="db-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    { label: "Current Plan",    value: dbUser.plan.toUpperCase(), sub: dbUser.active ? "Account active" : "Inactive", color: normalizedPlan === "advance" || normalizedPlan === "enterprise" ? "#7c3aed" : normalizedPlan === "pro" ? "#16a34a" : "#6b7280" },
                    { label: "Requests Used",   value: dbUser.usage.toLocaleString("en-IN"), sub: `of ${dbUser.limit.toLocaleString("en-IN")} total`, color: usageColor },
                    { label: "Requests Left",   value: usageLeft.toLocaleString("en-IN"), sub: `${(100 - usagePct).toFixed(0)}% remaining`, color: "#2563eb" },
                    { label: "Billing Cycle",   value: billing.display, sub: hasActiveExpirationOverride ? `until ${new Date(activeExpirationTimestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : dbUser.billingDate ? `since ${new Date(dbUser.billingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Not started", color: billing.color },
                  ].map((s) => (
                    <div key={s.label} className="db-card db-stat" style={{ borderTop: `3px solid ${s.color}`, padding: "16px 18px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#c0c0c0", marginBottom: 8 }}>{s.label}</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                      <p style={{ fontSize: 11, color: "#c0c0c0", marginTop: 6 }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Profile + Usage */}
                <div className="db-overview-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Profile */}
                  <div className="db-card">
                    <p className="db-section-label">Profile</p>
                    <div className="db-profile-head" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                      <img src={dicebearUrl} alt={dbUser.name || dbUser.email} style={{ width: 48, height: 48, borderRadius: 14, border: "1px solid #e5e7eb", flexShrink: 0, background: "#f3f4f6" }} />
                      <div className="db-profile-copy">
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>{dbUser.name || "—"}</p>
                        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{dbUser.email}</p>
                      </div>
                    </div>
                    {[
                      { k: "Plan",        v: <PlanBadge plan={dbUser.plan} /> },
                      { k: "Status",      v: <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: dbUser.active ? "#22c55e" : "#d1d5db" }} /><span style={{ color: dbUser.active ? "#16a34a" : "#9ca3af" }}>{dbUser.active ? "Active" : "Inactive"}</span></span> },
                      { k: "Total Spent", v: <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>₹{totalSpent.toFixed(2)}</span> },
                    ].map(({ k, v }) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderTop: "1px solid #f3f4f6" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>{k}</span>
                        {v}
                      </div>
                    ))}
                  </div>

                  {/* Usage & Billing */}
                  <div className="db-card">
                    <p className="db-section-label">Usage & Billing</p>
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>API Requests</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: usageColor }}>{usagePct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, background: usageColor, width: `${Math.min(100, usagePct)}%`, transition: "width 0.6s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                        <span style={{ fontSize: 10, color: "#c0c0c0" }}>{dbUser.usage.toLocaleString("en-IN")} used</span>
                        <span style={{ fontSize: 10, color: "#c0c0c0" }}>{dbUser.limit.toLocaleString("en-IN")} total</span>
                      </div>
                    </div>
                    {dbUser.plan !== "free" && (dbUser.billingDate || hasActiveExpirationOverride) && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Billing Cycle</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: billing.color }}>{billing.display}</span>
                        </div>
                        <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: billing.color, width: `${billing.pct}%`, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    )}
                    <div className="db-billing-summary" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "Paid Orders", value: paidOrders.length, color: "#16a34a" },
                        { label: "Total Spent",  value: `₹${totalSpent.toFixed(0)}`, color: "#d97706" },
                      ].map((s) => (
                        <div key={s.label} style={{ background: "#f8f8f8", border: "1px solid #f0f0f0", borderRadius: 10, padding: "12px 14px" }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#c0c0c0", marginBottom: 5 }}>{s.label}</p>
                          <p style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Topup */}
                <div
                  className="db-card"
                  style={{ position: "relative" }}
                  onMouseEnter={(e) => { const o = e.currentTarget.querySelector<HTMLElement>("[data-topup-overlay]"); if (o) o.style.opacity = "1"; }}
                  onMouseLeave={(e) => { const o = e.currentTarget.querySelector<HTMLElement>("[data-topup-overlay]"); if (o) o.style.opacity = "0"; }}
                >
                    <p className="db-section-label">Scale your product</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                      <span style={{ fontSize: 13, color: "#374151" }}>Selected: <b style={{ color: "#2563eb" }}>{selectedTopup.requests.toLocaleString("en-IN")} requests</b></span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>₹{selectedTopup.price.toLocaleString("en-IN")}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                      {TOPUP_OPTIONS.map((option, index) => {
                        const active = index === topupSelection;
                        return (
                          <button key={option.requests} type="button" onClick={() => setTopupSelection(index)} disabled={limitPurchaseLoading}
                            style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: active ? "2px solid #111" : "1px solid #e5e7eb", background: active ? "#f8f8f8" : "#fafafa", color: "#111827", cursor: limitPurchaseLoading ? "wait" : "pointer", transition: "border-color 0.15s, background 0.15s", outline: "none" }}>
                            <div style={{ fontSize: 12, fontWeight: active ? 700 : 600 }}>{option.requests.toLocaleString("en-IN")} req</div>
                            <div style={{ marginTop: 5, fontSize: 11, color: active ? "#374151" : "#9ca3af" }}>₹{option.price} · ₹{option.perReq.toFixed(3)}/req</div>
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, marginBottom: 6 }}>Payments processed securely by Cashfree. Top-ups add requests only and do not extend your plan expiry.</p>
                    <button type="button" onClick={startLimitTopupPayment} disabled={limitPurchaseLoading} style={{ width: "100%", marginTop: 12, border: "none", background: limitPurchaseLoading ? "#e5e7eb" : "#4f46e5", color: limitPurchaseLoading ? "#9ca3af" : "#fff", borderRadius: 12, padding: "13px", cursor: limitPurchaseLoading ? "wait" : "pointer", fontSize: 13, fontWeight: 700, transition: "background 0.15s", letterSpacing: "0.01em" }}>
                      {limitPurchaseLoading ? "Processing..." : "Proceed to Secure Checkout →"}
                    </button>
                    {limitPurchaseMessage && (
                      <p style={{ marginTop: 10, color: limitPurchaseMessage.toLowerCase().includes("failed") ? "#dc2626" : "#6b7280", fontSize: 12, lineHeight: 1.6 }}>{limitPurchaseMessage}</p>
                    )}
                    {!canBuyLimitTopup && (
                      <div
                        data-topup-overlay
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 12,
                          background: "rgba(255, 255, 255, 0.6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          padding: 20,
                          zIndex: 2,
                          pointerEvents: "none",
                          opacity: 0,
                          transition: "opacity 0.18s ease",
                        }}
                      >
                        <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
                          Purchase a plan to increase your request limit
                        </p>
                        <button
                          type="button"
                          onClick={() => router.push("/pricing")}
                          style={{
                            background: "#111827",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 14px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            pointerEvents: "auto",
                          }}
                        >
                          View plans
                        </button>
                      </div>
                    )}
                  </div>
              </div>
            )}

            {/* ── API Key ───────────────────────────────────────────────── */}
            {activeTab === "apikey" && (
              <div className="db-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", flexShrink: 0 }}>
                    <IconKey />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#000" }}>Secret API Key</p>
                </div>
                <p className="db-install-copy" style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20, lineHeight: 1.7 }}>
                  Install{" "}
                  <span style={{ color: "#16a34a", background: "#f0fdf4", padding: "1px 7px", borderRadius: 5, border: "1px solid #bbf7d0", fontSize: 12 }}>npm install railkit</span>
                  {" "}→ configure your key → call any function
                </p>
                <div style={{ background: "#f8f8f8", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#6b7280", flexShrink: 0 }}><IconShield /></span>
                  <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>Your key grants full package access. Rotate it immediately if you believe it has been compromised.</span>
                </div>
                {/* Key row */}
                <div className="db-key-row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div className="db-key-field" style={{ flex: 1, minWidth: 0, background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className="db-key-value" style={{ fontFamily: "ui-monospace, 'SFMono-Regular', Consolas, monospace", fontSize: 13, color: "#374151", overflowX: "auto", whiteSpace: "nowrap", flex: 1 }}>
                      {regeneratingKey ? <ApiKeySkeleton /> : keyVisible ? dbUser.apiKey : maskedKey}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button type="button" onClick={() => setKeyVisible(!keyVisible)} aria-label={keyVisible ? "Hide key" : "Reveal key"} disabled={regeneratingKey} style={{ background: "none", border: "none", color: regeneratingKey ? "#d1d5db" : "#9ca3af", cursor: regeneratingKey ? "not-allowed" : "pointer", display: "flex", alignItems: "center", padding: 4 }}>
                        {keyVisible ? <IconEyeOff /> : <IconEye />}
                      </button>
                      <button type="button" onClick={copyApiKey} aria-label={copied ? "Copied" : "Copy key"} disabled={regeneratingKey} style={{ background: "none", border: "none", color: copied ? "#16a34a" : regeneratingKey ? "#d1d5db" : "#9ca3af", cursor: regeneratingKey ? "not-allowed" : "pointer", display: "flex", alignItems: "center", padding: 4, transition: "color 0.2s" }}>
                        {copied ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                  <button className="db-key-regen" type="button" onClick={regenerateApiKey} disabled={regeneratingKey} style={{ background: regeneratingKey ? "#e5e7eb" : "#000", border: "none", color: regeneratingKey ? "#9ca3af" : "#fff", borderRadius: 10, padding: "0 20px", cursor: regeneratingKey ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", height: 44, transition: "background 0.2s" }}>
                    <span style={{ display: "inline-flex", animation: regeneratingKey ? "spin 0.9s linear infinite" : "none" }}><IconRefresh /></span>
                    {regeneratingKey ? "Regenerating..." : "Regenerate Key"}
                  </button>
                </div>
                {regenerateError && <p style={{ marginTop: 10, color: "#dc2626", fontSize: 12 }}>{regenerateError}</p>}
                {/* Code example */}
                <div className="db-code-block" style={{ marginTop: 24, background: "#0d1117", border: "1px solid #21262d", borderRadius: 14, padding: "16px 20px" }}>
                  <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 600 }}>Example Usage</p>
                  <SyntaxHighlighter language="typescript" style={nightOwl} customStyle={{ margin: 0, background: "transparent", fontSize: 12, lineHeight: 1.8, padding: 0 }}>
                    {usageExampleCode}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* ── API Endpoints ─────────────────────────────────────────── */}
            {activeTab === "apiendpoints" && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "12px 16px", color: "#9a3412", fontSize: 12, lineHeight: 1.7 }}>
                  Direct API access is enabled only on the <b>Advance</b> plan. Free/Pro users must use the official SDK.
                </div>
                <div className="db-card">
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#000", marginBottom: 10 }}>How to call endpoints</p>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                    <select value={apiCodeLanguage} onChange={(e) => setApiCodeLanguage(e.target.value as ApiCodeLanguage)} className="db-select" style={{ width: "auto" }}>
                      {(Object.keys(apiLanguageMeta) as ApiCodeLanguage[]).map((lang) => (
                        <option key={lang} value={lang}>{apiLanguageMeta[lang].label}</option>
                      ))}
                    </select>
                  </div>
                  <p className="db-break-anywhere" style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginBottom: 14 }}>
                    Base URL: <span style={{ color: "#2563eb" }}>{directApiBaseUrl}</span><br />
                    Required header: <span style={{ color: "#16a34a" }}>x-api-key: YOUR_API_KEY</span>
                  </p>
                  <div className="db-code-block" style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 14, overflowX: "auto" }}>
                    <SyntaxHighlighter language={apiLanguageMeta[apiCodeLanguage].syntax} style={nightOwl} customStyle={{ margin: 0, background: "transparent", fontSize: 12, lineHeight: 1.7, padding: 0 }}>
                      {buildApiSnippet("/api/checkPNRStatus/1234567890", apiCodeLanguage)}
                    </SyntaxHighlighter>
                  </div>
                </div>
                {endpointDocs.map((endpoint) => (
                  <div key={endpoint.path} className="db-card">
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{endpoint.method}</span>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#000" }}>{endpoint.name}</p>
                    </div>
                    <p style={{ fontSize: 12, color: "#374151", marginBottom: 4, wordBreak: "break-all" }}>{endpoint.path}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, wordBreak: "break-all" }}>Example: {directApiBaseUrl}{endpoint.examplePath}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>{endpoint.notes}</p>
                    <div className="db-code-block" style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 14, overflowX: "auto" }}>
                      <SyntaxHighlighter language={apiLanguageMeta[apiCodeLanguage].syntax} style={nightOwl} customStyle={{ margin: 0, background: "transparent", fontSize: 12, lineHeight: 1.7, padding: 0 }}>
                        {buildApiSnippet(endpoint.examplePath, apiCodeLanguage)}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Playground ────────────────────────────────────────────── */}
            {activeTab === "playground" && (
              <div className="db-playground-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 16 }}>
                <div className="db-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>API Playground</p>
                    <span style={{ color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>Using your API key</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.7, marginBottom: 16 }}>Run live requests without leaving your workspace.</p>
                  {/* Action pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                    {[{ id: "pnr", label: "PNR" }, { id: "train", label: "Train" }, { id: "track", label: "Track" }, { id: "history", label: "History" }, { id: "station", label: "Station" }, { id: "search", label: "Search" }, { id: "seat", label: "Seat" }, { id: "fare", label: "Fare" }].map((item) => (
                      <button type="button" key={item.id} onClick={() => { setPlaygroundAction(item.id as typeof playgroundAction); resetPlaygroundMeta(); }}
                        style={{ background: playgroundAction === item.id ? "#000" : "#f3f4f6", border: `1px solid ${playgroundAction === item.id ? "#000" : "#e5e7eb"}`, color: playgroundAction === item.id ? "#fff" : "#6b7280", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s, color 0.15s" }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {/* Inputs */}
                  <div className="db-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {playgroundAction === "pnr" && <input value={pnrInput} onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ""))} maxLength={10} placeholder="PNR number (10 digits)" className="db-input" style={{ gridColumn: "1 / -1" }} />}
                    {playgroundAction === "train" && <input value={trainInput} onChange={(e) => setTrainInput(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="Train number (5 digits)" className="db-input" style={{ gridColumn: "1 / -1" }} />}
                    {playgroundAction === "track" && (<>
                      <input value={trackTrainInput} onChange={(e) => setTrackTrainInput(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="Train number" className="db-input" />
                      <input type="date" value={toInputDate(trackDateInput)} onChange={(e) => setTrackDateInput(fromInputDate(e.target.value))} className="db-input" />
                    </>)}
                    {playgroundAction === "history" && (<>
                      <input value={historyTrainInput} onChange={(e) => setHistoryTrainInput(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="Train number" className="db-input" />
                      <input type="date" value={toInputDate(historyDateInput)} onChange={(e) => setHistoryDateInput(fromInputDate(e.target.value))} className="db-input" />
                    </>)}
                    {playgroundAction === "station" && (<>
                      <input value={stationInput} onChange={(e) => setStationInput(e.target.value.toUpperCase())} placeholder="Station code (e.g. NDLS)" className="db-input" />
                      <select value={stationHoursInput} onChange={(e) => setStationHoursInput(e.target.value as "2" | "4" | "8")} className="db-select" aria-label="Time window in hours">
                        <option value="2">2 hrs</option>
                        <option value="4">4 hrs</option>
                        <option value="8">8 hrs</option>
                      </select>
                    </>)}
                    {playgroundAction === "search" && (<>
                      <input value={fromStationInput} onChange={(e) => setFromStationInput(e.target.value.toUpperCase())} placeholder="From station code" className="db-input" />
                      <input value={toStationInput} onChange={(e) => setToStationInput(e.target.value.toUpperCase())} placeholder="To station code" className="db-input" />
                      <input type="date" value={toInputDate(searchDateInput)} onChange={(e) => setSearchDateInput(fromInputDate(e.target.value))} className="db-input" />
                    </>)}
                    {playgroundAction === "seat" && (<>
                      <input value={seatTrainInput} onChange={(e) => setSeatTrainInput(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="Train number" className="db-input" />
                      <input type="date" value={toInputDate(seatDateInput)} onChange={(e) => setSeatDateInput(fromInputDate(e.target.value))} className="db-input" />
                      <input value={seatFromInput} onChange={(e) => setSeatFromInput(e.target.value.toUpperCase())} placeholder="From station code" className="db-input" />
                      <input value={seatToInput} onChange={(e) => setSeatToInput(e.target.value.toUpperCase())} placeholder="To station code" className="db-input" />
                      <select value={seatClassInput} onChange={(e) => setSeatClassInput(e.target.value)} className="db-select">
                        {["SL", "3A", "2A", "1A", "CC", "EC", "2S"].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={seatQuotaInput} onChange={(e) => setSeatQuotaInput(e.target.value)} className="db-select">
                        {["GN", "TQ", "LD", "PT", "SS"].map((q) => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </>)}
                    {playgroundAction === "fare" && (<>
                      <input value={fareTrainInput} onChange={(e) => setFareTrainInput(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="Train number" className="db-input" />
                      <input type="date" value={toInputDate(fareDateInput)} onChange={(e) => setFareDateInput(fromInputDate(e.target.value))} className="db-input" />
                      <input value={fareFromInput} onChange={(e) => setFareFromInput(e.target.value.toUpperCase())} placeholder="From station code" className="db-input" />
                      <input value={fareToInput} onChange={(e) => setFareToInput(e.target.value.toUpperCase())} placeholder="To station code" className="db-input" />
                      <select value={fareClassInput} onChange={(e) => setFareClassInput(e.target.value)} className="db-select">
                        {["SL","3A","2A","1A","CC","EC","EA","FC","2S","3E","VS","CH","HS","VC","VA"].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={fareQuotaInput} onChange={(e) => setFareQuotaInput(e.target.value)} className="db-select">
                        {["GN","TQ","PT","LD","DF","FT","LB","YU","DP","HP","PH","SS"].map((q) => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </>)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <button type="button" onClick={runPlayground} disabled={playgroundLoading} style={{ background: playgroundLoading ? "#e5e7eb" : "#000", border: "none", color: playgroundLoading ? "#9ca3af" : "#fff", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: playgroundLoading ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
                      {playgroundLoading ? "Running..." : "Run Request"}
                    </button>
                    {playgroundStatusCode !== null && (
                      <span style={{ color: playgroundStatusCode < 400 ? "#16a34a" : "#dc2626", background: playgroundStatusCode < 400 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${playgroundStatusCode < 400 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>HTTP {playgroundStatusCode}</span>
                    )}
                    {playgroundResponseTime !== null && (
                      <span style={{ color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600 }}>{playgroundResponseTime}ms</span>
                    )}
                  </div>
                  {playgroundError && <p style={{ marginTop: 10, color: "#dc2626", fontSize: 12 }}>{playgroundError}</p>}
                </div>
                {/* Response panel */}
                <div className="db-card-dark" style={{ minHeight: 420, overflow: "hidden" }}>
                  <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Response</span>
                    <span style={{ color: "#6b7280", fontSize: 11 }}>JSON</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    {playgroundLoading ? <PlaygroundResponseSkeleton /> : (
                      <SyntaxHighlighter language="json" style={nightOwl} customStyle={{ margin: 0, background: "transparent", fontSize: 12, lineHeight: 1.7, minHeight: 360, maxHeight: 520, borderRadius: 8, overflow: "auto", padding: 0 }}>
                        {playgroundResultText || `{\n  "message": "Run a request to preview the live response"\n}`}
                      </SyntaxHighlighter>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Logs ──────────────────────────────────────────────────── */}
            {activeTab === "logs" && (
              <div style={{ display: "grid", gap: 16 }}>
                <div className="db-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#000" }}>API Requests Per Day</p>
                    <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                      {([14, 30] as const).map((days) => (
                        <button type="button" key={days} onClick={() => setLogsTimelineDays(days)} style={{ background: logsTimelineDays === days ? "#000" : "#fff", color: logsTimelineDays === days ? "#fff" : "#6b7280", border: "none", borderRight: days === 14 ? "1px solid #e5e7eb" : "none", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}>
                          {days}D
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="db-chart-wrap" style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 12, padding: 12, height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#000" stopOpacity={0.08} />
                            <stop offset="100%" stopColor="#000" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={{ stroke: "#f0f0f0" }} tickLine={{ stroke: "#f0f0f0" }} minTickGap={18} />
                        <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={{ stroke: "#f0f0f0" }} tickLine={{ stroke: "#f0f0f0" }} />
                        <Tooltip cursor={{ stroke: "rgba(0,0,0,0.1)", strokeWidth: 1 }} contentStyle={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, color: "#374151", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }} formatter={(value) => { const n = typeof value === "number" ? value : Number(value ?? 0); return [`${n} requests`, "Usage"]; }} labelFormatter={(label) => `Date: ${label}`} />
                        <Area type="monotone" dataKey="requests" stroke="none" fill="url(#areaFill)" />
                        <Line type="monotone" dataKey="requests" stroke="#000" strokeWidth={2} dot={{ r: 3, stroke: "#fff", strokeWidth: 1.5, fill: "#000" }} activeDot={{ r: 5, fill: "#000", stroke: "#fff", strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", color: "#c0c0c0", fontSize: 10, fontWeight: 600 }}>
                    <span>Start: {auditDailyUsage[0] ? new Date(auditDailyUsage[0].date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-"}</span>
                    <span>Peak: {maxDailyRequests} req/day</span>
                    <span>End: {auditDailyUsage[auditDailyUsage.length - 1] ? new Date(auditDailyUsage[auditDailyUsage.length - 1].date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-"}</span>
                  </div>
                </div>
                <div className="db-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div className="db-table-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Recent API Logs</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{recentLogs.length} entries</span>
                  </div>
                  <div className="db-table-scroll" style={{ overflowX: "auto" }}>
                    <table className="db-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                          {["Time", "Path", "Status", "Duration", "IP"].map((h) => (
                            <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: "#c0c0c0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentLogs.length === 0 ? (
                        <tr><td className="db-empty-cell" colSpan={5} style={{ padding: 48, textAlign: "center", color: "#d1d5db", fontSize: 12 }}>No logs yet for this account.</td></tr>
                        ) : recentLogs.map((log) => (
                          <tr key={log.id} className="row-hover" style={{ borderBottom: "1px solid #f9f9f9", transition: "background 0.1s" }}>
                            <td data-label="Time" style={{ padding: "11px 16px", color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString("en-IN")}</td>
                            <td data-label="Path" style={{ padding: "11px 16px", color: "#374151", fontSize: 12, maxWidth: 420, wordBreak: "break-all" }}>{log.path}</td>
                            <td data-label="Status" style={{ padding: "11px 16px" }}><span style={{ color: log.statusCode >= 200 && log.statusCode < 400 ? "#16a34a" : "#dc2626", fontSize: 12, fontWeight: 700 }}>{log.statusCode}</span></td>
                            <td data-label="Duration" style={{ padding: "11px 16px", color: "#2563eb", fontSize: 12, fontWeight: 600 }}>{Number(log.duration).toFixed(2)} ms</td>
                            <td data-label="IP" style={{ padding: "11px 16px", color: "#9ca3af", fontSize: 11 }}>{log.ip}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Orders ────────────────────────────────────────────────── */}
            {activeTab === "orders" && (
              <div className="db-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="db-table-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                    All orders · <span style={{ color: "#16a34a" }}>{paidOrders.length} paid</span>
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    Total: <span style={{ color: "#d97706", fontWeight: 700 }}>₹{totalSpent.toFixed(2)}</span>
                  </span>
                </div>
                <div className="db-table-scroll" style={{ overflowX: "auto" }}>
                  <table className="db-data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                        {["Order ID", "Amount", "Status", "Credited", "Date", ""].map((h) => (
                          <th key={h} style={{ padding: "11px 16px", textAlign: "left", color: "#c0c0c0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr><td className="db-empty-cell" colSpan={6} style={{ padding: 48, textAlign: "center", color: "#d1d5db", fontSize: 12 }}>No orders found. Subscribe to a plan to get started.</td></tr>
                      ) : orders.map((o) => (
                        <tr key={o._id} className="row-hover" style={{ borderBottom: "1px solid #f9f9f9", transition: "background 0.1s" }}>
                          <td data-label="Order ID" style={{ padding: "13px 16px", color: "#9ca3af", fontSize: 11 }}>{o.orderId}</td>
                          <td data-label="Amount" style={{ padding: "13px 16px" }}>
                            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>₹{o.amount.toFixed(2)}</span>
                            <span style={{ color: "#c0c0c0", fontSize: 10, marginLeft: 4 }}>{o.currency}</span>
                          </td>
                          <td data-label="Status" style={{ padding: "13px 16px" }}><StatusBadge status={o.status} /></td>
                          <td data-label="Credited" style={{ padding: "13px 16px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                              {o.credited ? (<><span style={{ color: "#16a34a" }}><IconCheck /></span><span style={{ color: "#16a34a", fontWeight: 600 }}>Yes</span></>) : (<><span style={{ color: "#d1d5db" }}><IconX /></span><span style={{ color: "#9ca3af" }}>No</span></>)}
                            </span>
                          </td>
                          <td data-label="Date" style={{ padding: "13px 16px", color: "#9ca3af", fontSize: 11 }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                          <td data-label="Details" style={{ padding: "13px 16px" }}>
                            <button type="button" onClick={() => setViewOrder(o)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}>
                              <IconEye /><span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  );
}
