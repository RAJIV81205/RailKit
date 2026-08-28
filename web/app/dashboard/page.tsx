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
  cancelList,
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
import { endpointDocs } from "../../components/docs/endpointDocs";

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
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget: "_modal";
  }) => Promise<unknown>;
};

declare global {
  interface Window {
    Cashfree?: (options: {
      mode: CashfreeCheckoutMode;
    }) => CashfreeCheckoutClient;
  }
}

type ActiveTab =
  | "overview"
  | "apikey"
  | "apiendpoints"
  | "playground"
  | "logs"
  | "orders";

const dashboardInputClass =
  "w-full rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[13px] text-[#111827] outline-none transition-[border-color,box-shadow,background] duration-150 focus:border-black focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] max-[768px]:min-h-11";
const dashboardSelectClass =
  "w-full rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[13px] text-[#111827] outline-none max-[768px]:min-h-11";
const dashboardCardClass =
  "rounded-2xl border border-[#ebebeb] bg-white p-6 max-[768px]:p-5 max-[480px]:rounded-[13px] max-[480px]:p-4";
const dashboardTableClass =
  "w-full min-w-[700px] border-collapse text-[13px] max-[640px]:block max-[640px]:min-w-0 max-[640px]:[&_thead]:hidden max-[640px]:[&_tbody]:grid max-[640px]:[&_tbody]:w-full max-[640px]:[&_tbody]:gap-2.5 max-[640px]:[&_tbody]:p-2.5 max-[640px]:[&_tbody_tr]:block max-[640px]:[&_tbody_tr]:w-full max-[640px]:[&_tbody_tr]:overflow-hidden max-[640px]:[&_tbody_tr]:rounded-xl max-[640px]:[&_tbody_tr]:border max-[640px]:[&_tbody_tr]:border-[#ebebeb] max-[640px]:[&_tbody_tr]:bg-white max-[640px]:[&_tbody_td]:flex max-[640px]:[&_tbody_td]:w-full max-[640px]:[&_tbody_td]:min-w-0 max-[640px]:[&_tbody_td]:items-start max-[640px]:[&_tbody_td]:justify-between max-[640px]:[&_tbody_td]:gap-4 max-[640px]:[&_tbody_td]:border-b max-[640px]:[&_tbody_td]:border-[#f3f4f6] max-[640px]:[&_tbody_td]:px-3 max-[640px]:[&_tbody_td]:py-2.5 max-[640px]:[&_tbody_td]:text-right max-[640px]:[&_tbody_td]:whitespace-normal max-[640px]:[&_tbody_td]:[overflow-wrap:anywhere] max-[640px]:[&_tbody_td:last-child]:border-b-0 max-[640px]:[&_tbody_td::before]:block max-[640px]:[&_tbody_td::before]:[content:attr(data-label)] max-[640px]:[&_tbody_td::before]:[flex:0_0_78px] max-[640px]:[&_tbody_td::before]:text-left max-[640px]:[&_tbody_td::before]:text-[10px] max-[640px]:[&_tbody_td::before]:font-bold max-[640px]:[&_tbody_td::before]:tracking-[0.06em] max-[640px]:[&_tbody_td::before]:text-[#9ca3af] max-[640px]:[&_tbody_td::before]:uppercase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new FetchError(
      data?.message || `Fetch failed: ${res.status}`,
      res.status,
    );
  }
  return data as T;
};

let cashfreeLoadPromise: Promise<void> | null = null;

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Cashfree checkout is unavailable"));
  if (window.Cashfree) return Promise.resolve();
  if (cashfreeLoadPromise) return cashfreeLoadPromise;
  cashfreeLoadPromise = new Promise<void>((resolve, reject) => {
    const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CASHFREE_SDK_URL}"]`,
    );
    if (existing) {
      if (window.Cashfree) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Cashfree SDK")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = CASHFREE_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(script);
  });
  cashfreeLoadPromise.catch(() => {
    cashfreeLoadPromise = null;
  });
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
        <div className="size-10 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-black" />
      </div>
      <p className="font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[13px] tracking-[0.04em] text-[#9ca3af]">
        {text}
      </p>
    </div>
  );
}

function PlaygroundResponseSkeleton() {
  const lines = [
    ["w-[92%]", "[animation-delay:0s]"],
    ["w-[84%]", "[animation-delay:0.08s]"],
    ["w-[88%]", "[animation-delay:0.16s]"],
    ["w-[66%]", "[animation-delay:0.24s]"],
    ["w-[90%]", "[animation-delay:0.32s]"],
    ["w-[72%]", "[animation-delay:0.4s]"],
    ["w-[58%]", "[animation-delay:0.48s]"],
  ];
  return (
    <div className="min-h-80 overflow-hidden py-0.5">
      <div className="mb-3.5 h-2.5 w-24 animate-dashboard-shimmer rounded-full bg-[linear-gradient(90deg,#e5e7eb_25%,#e5e7eb_50%,#e5e7eb_75%)] bg-[length:200%_100%]" />
      {lines.map(([widthClass, delayClass], index) => (
        <div
          key={`${widthClass}-${index}`}
          className={`${widthClass} ${delayClass} h-2.5 animate-dashboard-shimmer rounded-full bg-[linear-gradient(90deg,#f9fafb_25%,#e5e7eb_50%,#f9fafb_75%)] bg-[length:200%_100%] ${index === lines.length - 1 ? "mb-0" : "mb-2.5"}`}
        />
      ))}
    </div>
  );
}

function ApiKeySkeleton() {
  return (
    <div className="h-3.5 w-full animate-dashboard-shimmer-fast rounded-full bg-[linear-gradient(90deg,#e5e7eb_25%,#e5e7eb_50%,#e5e7eb_75%)] bg-[length:200%_100%]" />
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconCopy = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconCheck = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconKey = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const IconRefresh = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);
const IconEye = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.76 21.76 0 0 1 5.06-6.94" />
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.78 21.78 0 0 1-3.31 4.53" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconShield = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// Sidebar nav icons
const IconOverview = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const IconCode = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
const IconTerminal = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);
const IconActivity = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconReceipt = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const IconEndpoints = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

// ─── Plan / Status Badges ─────────────────────────────────────────────────────
const PlanBadge = ({ plan }: { plan: string }) => {
  const styles: Record<string, string> = {
    free: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]",
    pro: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
    enterprise: "border-[#e9d5ff] bg-[#faf5ff] text-[#7c3aed]",
    advance: "border-[#e9d5ff] bg-[#faf5ff] text-[#7c3aed]",
  };
  const s = styles[plan?.toLowerCase()] ?? styles.free;
  return (
    <span
      className={`${s} rounded-md border px-2 py-0.5 font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[11px] font-bold tracking-[0.04em] uppercase`}
    >
      {plan}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { badge: string; dot: string }> = {
    paid: {
      badge: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
      dot: "bg-[#22c55e]",
    },
    created: {
      badge: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]",
      dot: "bg-[#9ca3af]",
    },
    failed: {
      badge: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]",
      dot: "bg-[#ef4444]",
    },
    cancelled: {
      badge: "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c]",
      dot: "bg-[#f97316]",
    },
    expired: {
      badge: "border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af]",
      dot: "bg-[#d1d5db]",
    },
  };
  const s = styles[status] ?? styles.created;
  return (
    <span
      className={`${s.badge} inline-flex items-center gap-[5px] rounded-md border px-2.5 py-[3px] font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[11px] font-semibold`}
    >
      <span className={`${s.dot} size-[5px] shrink-0 rounded-full`} />
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
      if (!user) {
        setDisplay("Not started");
        setPct(0);
        return;
      }
      if (user.plan === "free") {
        setDisplay("Free plan");
        setPct(100);
        return;
      }
      const now = Date.now();
      const expirationAt = user.expirationDate
        ? new Date(user.expirationDate).getTime()
        : NaN;
      if (Number.isFinite(expirationAt) && expirationAt > now) {
        const remaining = expirationAt - now;
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor(
          (remaining % (1000 * 60 * 60)) / (1000 * 60),
        );
        setDisplay(
          days > 0 ? `${days}d ${hours}h left` : `${hours}h ${minutes}m left`,
        );
        if (user.billingDate) {
          const start = new Date(user.billingDate).getTime();
          const total =
            Number.isFinite(start) && expirationAt > start
              ? expirationAt - start
              : remaining;
          setPct(
            Math.max(0, Math.min(100, (remaining / Math.max(total, 1)) * 100)),
          );
        } else {
          setPct(100);
        }
        return;
      }
      if (!user.billingDate) {
        setDisplay("Not started");
        setPct(0);
        return;
      }
      const CYCLE = 30 * 24 * 60 * 60 * 1000;
      const start = new Date(user.billingDate).getTime();
      if (Number.isNaN(start)) {
        setDisplay("Invalid date");
        setPct(0);
        return;
      }
      const end = start + CYCLE;
      const remaining = end - now;
      if (remaining <= 0) {
        setDisplay("Expired");
        setPct(0);
        return;
      }
      setPct((remaining / CYCLE) * 100);
      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      setDisplay(
        days > 0
          ? `${days}d ${hours}h left`
          : `${hours}h ${Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))}m left`,
      );
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [user?.plan, user?.billingDate, user?.expirationDate]);

  const color =
    display === "Expired"
      ? "#dc2626"
      : pct > 50
        ? "#16a34a"
        : pct > 20
          ? "#d97706"
          : "#dc2626";
  return { display, pct, color };
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
function OrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-lg"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="max-h-[calc(100vh-32px)] w-full max-w-[480px] overflow-y-auto rounded-3xl border border-black/8 bg-white p-8 font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] shadow-[0_20px_56px_rgba(0,0,0,0.12)] max-[640px]:rounded-[18px] max-[640px]:p-[22px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-base font-bold text-black">
            Order Details
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order details"
            className="cursor-pointer border-none bg-transparent p-1 text-[#9ca3af]"
          >
            <IconX />
          </button>
        </div>
        {[
          ["Order ID", order.orderId],
          ["Amount", `₹${order.amount.toFixed(2)} ${order.currency}`],
          ["Status", order.status],
          ["Credited", order.credited ? "Yes" : "No"],
          [
            "Date",
            order.createdAt
              ? new Date(order.createdAt).toLocaleString("en-IN")
              : "—",
          ],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between border-b border-[#f3f4f6] py-3 max-[640px]:flex-col max-[640px]:gap-[5px]"
          >
            <span className="font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
              {k}
            </span>
            <span className="max-w-full font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] text-[13px] text-[#374151] [overflow-wrap:anywhere]">
              {v}
            </span>
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
  const [limitPurchaseMessage, setLimitPurchaseMessage] = useState<
    string | null
  >(null);
  const [verifiedReturnOrderId, setVerifiedReturnOrderId] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [logsTimelineDays, setLogsTimelineDays] = useState<14 | 30>(14);
  const [topupSelection, setTopupSelection] = useState(1);
  const [apiCodeLanguage, setApiCodeLanguage] =
    useState<ApiCodeLanguage>("javascript");
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playgroundAction, setPlaygroundAction] = useState<
    | "pnr"
    | "train"
    | "track"
    | "history"
    | "station"
    | "search"
    | "seat"
    | "fare"
    | "cancelled"
  >("pnr");
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundStatusCode, setPlaygroundStatusCode] = useState<
    number | null
  >(null);
  const [playgroundResponseTime, setPlaygroundResponseTime] = useState<
    number | null
  >(null);
  const [playgroundResultText, setPlaygroundResultText] = useState("");
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [pnrInput, setPnrInput] = useState("");
  const [trainInput, setTrainInput] = useState("");
  const [trackTrainInput, setTrackTrainInput] = useState("");
  const [trackDateInput, setTrackDateInput] = useState("");
  const [historyTrainInput, setHistoryTrainInput] = useState("");
  const [historyDateInput, setHistoryDateInput] = useState("");
  const [stationInput, setStationInput] = useState("");
  const [stationHoursInput, setStationHoursInput] = useState<"2" | "4" | "8">(
    "2",
  );
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

  const {
    data: userData,
    error: userError,
    isLoading: userLoading,
    isValidating: userValidating,
    mutate: mutateUser,
  } = useSWR<VerifyUserResponse>(
    `/api/user/verify?days=${logsTimelineDays}`,
    fetcher,
    { revalidateOnFocus: true },
  );

  const {
    data: ordersData,
    isLoading: ordersLoading,
    isValidating: ordersValidating,
    mutate: mutateOrders,
  } = useSWR<UserOrdersResponse>("/api/user/orders", fetcher, {
    revalidateOnFocus: true,
  });

  const dbUser = userData?.user ?? null;
  const auditDailyUsage = userData?.logs?.dailyUsage ?? [];
  const recentLogs = userData?.logs?.recent ?? [];
  const orders = ordersData?.orders ?? [];
  const loading = userLoading || ordersLoading;
  const refreshing = userValidating || ordersValidating;

  const selectedTopup = TOPUP_OPTIONS[topupSelection] || TOPUP_OPTIONS[0];
  const billing = useBillingTimer(dbUser);

  const activeExpirationTimestamp = dbUser?.expirationDate
    ? new Date(dbUser.expirationDate).getTime()
    : NaN;
  const hasActiveExpirationOverride =
    Number.isFinite(activeExpirationTimestamp) &&
    activeExpirationTimestamp > Date.now();

  useEffect(() => {
    if (!userError) {
      authRetryCountRef.current = 0;
      if (authRetryRef.current) {
        window.clearTimeout(authRetryRef.current);
        authRetryRef.current = null;
      }
      return;
    }

    const status =
      userError instanceof FetchError ? userError.status : undefined;
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

  const refreshAll = () => {
    mutateUser();
    mutateOrders();
  };

  const verifyLimitTopup = useCallback(
    async (orderId: string) => {
      setLimitPurchaseLoading(true);
      setLimitPurchaseMessage("Verifying payment...");
      try {
        const response = await fetch("/api/user/increase-limit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success)
          throw new Error(data?.message || "Unable to verify payment");
        if (!data?.paid) {
          setLimitPurchaseMessage(
            "Payment is still pending. Please retry in a moment.",
          );
          return data;
        }
        setLimitPurchaseMessage(
          `Limit increased by ${Number(data.extraLimit || 0).toLocaleString("en-IN")} requests.`,
        );
        await mutateUser();
        return data;
      } catch (error: unknown) {
        setLimitPurchaseMessage(
          getErrorMessage(
            error,
            "Payment verification failed. Please try again.",
          ),
        );
        throw error;
      } finally {
        setLimitPurchaseLoading(false);
      }
    },
    [mutateUser],
  );

  const startLimitTopupPayment = async () => {
    if (limitPurchaseLoading) return;
    setLimitPurchaseLoading(true);
    setLimitPurchaseMessage(null);
    try {
      const response = await fetch("/api/user/increase-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraLimit: selectedTopup.requests }),
      });
      const data = await response.json();
      const order = data?.order as
        | { orderId?: string; paymentSessionId?: string }
        | undefined;
      if (!response.ok || !order?.orderId || !order?.paymentSessionId)
        throw new Error(data?.message || "Unable to create payment order");
      await loadCashfreeSdk();
      if (!window.Cashfree)
        throw new Error(
          "Cashfree checkout failed to load. Please refresh and try again.",
        );
      setLimitPurchaseMessage("Opening secure payment popup...");
      const cashfree = window.Cashfree({
        mode: data?.cashfreeMode === "sandbox" ? "sandbox" : "production",
      });
      try {
        await cashfree.checkout({
          paymentSessionId: order.paymentSessionId,
          redirectTarget: "_modal",
        });
      } catch {
        /* modal close */
      }
      await verifyLimitTopup(order.orderId);
    } catch (error: unknown) {
      setLimitPurchaseMessage(
        getErrorMessage(
          error,
          "Unable to process limit add-on. Please try again.",
        ),
      );
      setLimitPurchaseLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentReturn = params.get("payment_return");
    const orderId = params.get("order_id");
    if (
      paymentReturn !== "limit" ||
      !orderId ||
      verifiedReturnOrderId === orderId
    )
      return;
    setVerifiedReturnOrderId(orderId);
    verifyLimitTopup(orderId).catch(() => {});
  }, [verifiedReturnOrderId, verifyLimitTopup]);

  const onLogout = async () => {
    try {
      await signOut(auth);
      await fetch("/api/user/verify", { method: "DELETE" });
    } catch {}
    router.replace("/");
  };

  const copyApiKey = () => {
    if (dbUser?.apiKey) {
      navigator.clipboard.writeText(dbUser.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateApiKey = async () => {
    if (!dbUser?.apiKey || !dbUser?.email || regeneratingKey) return;
    setRegeneratingKey(true);
    setRegenerateError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/user/key/regenerate", { method: "GET" });
      const data = await res.json();
      if (!res.ok || !data?.success)
        throw new Error(data?.message || "Failed to regenerate key");
      setKeyVisible(true);
      await mutateUser();
    } catch (error) {
      setRegenerateError(
        error instanceof Error ? error.message : "Failed to regenerate key",
      );
    } finally {
      setRegeneratingKey(false);
    }
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

  const resetPlaygroundMeta = () => {
    setPlaygroundError(null);
    setPlaygroundStatusCode(null);
    setPlaygroundResponseTime(null);
    setPlaygroundResultText("");
  };

  const runPlayground = async () => {
    setPlaygroundLoading(true);
    resetPlaygroundMeta();
    const start = performance.now();
    try {
      const apiKey = dbUser?.apiKey;
      if (!apiKey)
        throw new Error("Session expired. Please refresh and sign in again.");
      configure(apiKey);
      let result: unknown;
      switch (playgroundAction) {
        case "pnr":
          if (!/^\d{10}$/.test(pnrInput))
            throw new Error("PNR must be exactly 10 digits");
          result = await checkPNRStatus(pnrInput);
          break;
        case "train":
          if (!/^\d{5}$/.test(trainInput))
            throw new Error("Train number must be exactly 5 digits");
          result = await getTrainInfo(trainInput);
          break;
        case "track":
          if (!/^\d{5}$/.test(trackTrainInput))
            throw new Error("Train number must be exactly 5 digits");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(trackDateInput))
            throw new Error("Date must be in DD-MM-YYYY format");
          result = await trackTrain(trackTrainInput, trackDateInput);
          break;
        case "history":
          if (!/^\d{5}$/.test(historyTrainInput))
            throw new Error("Train number must be exactly 5 digits");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(historyDateInput))
            throw new Error("Date must be in DD-MM-YYYY format");
          result = await getTrainHistory(historyTrainInput, historyDateInput);
          break;
        case "station":
          if (!stationInput.trim()) throw new Error("Station code is required");
          result = await liveAtStation(
            stationInput.trim().toUpperCase(),
            Number(stationHoursInput) as 2 | 4 | 8,
          );
          break;
        case "search":
          if (!fromStationInput.trim() || !toStationInput.trim())
            throw new Error("From and To station codes are required");
          if (searchDateInput && !/^\d{2}-\d{2}-\d{4}$/.test(searchDateInput))
            throw new Error("Date must be in DD-MM-YYYY format");
          result = await searchTrainBetweenStations(
            fromStationInput.trim().toUpperCase(),
            toStationInput.trim().toUpperCase(),
            searchDateInput || undefined,
          );
          break;
        case "seat":
          if (!/^\d{5}$/.test(seatTrainInput))
            throw new Error("Train number must be exactly 5 digits");
          if (!seatFromInput.trim() || !seatToInput.trim())
            throw new Error("From and To station codes are required");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(seatDateInput))
            throw new Error("Date must be in DD-MM-YYYY format");
          result = await getAvailability(
            seatTrainInput,
            seatFromInput.trim().toUpperCase(),
            seatToInput.trim().toUpperCase(),
            seatDateInput,
            seatClassInput,
            seatQuotaInput,
          );
          break;
        case "fare":
          if (!/^\d{5}$/.test(fareTrainInput))
            throw new Error("Train number must be exactly 5 digits");
          if (!fareFromInput.trim() || !fareToInput.trim())
            throw new Error("From and To station codes are required");
          if (!/^\d{2}-\d{2}-\d{4}$/.test(fareDateInput))
            throw new Error("Date must be in DD-MM-YYYY format");
          result = await fareLookup(
            fareTrainInput,
            fareFromInput.trim().toUpperCase(),
            fareToInput.trim().toUpperCase(),
            fareDateInput,
            fareClassInput,
            fareQuotaInput,
          );
          break;
        case "cancelled":
          result = await cancelList();
          break;
      }
      const resultRecord =
        typeof result === "object" && result !== null
          ? (result as {
              success?: unknown;
              error?: unknown;
              message?: unknown;
              statusCode?: unknown;
            })
          : null;
      const codeGuess =
        typeof resultRecord?.statusCode === "number"
          ? resultRecord.statusCode
          : resultRecord?.success === false
            ? 400
            : 200;
      setPlaygroundStatusCode(codeGuess);
      setPlaygroundResultText(JSON.stringify(result, null, 2) || "{}");
      if (resultRecord?.success === false) {
        const resultError =
          typeof resultRecord.error === "string"
            ? resultRecord.error
            : typeof resultRecord.message === "string"
              ? resultRecord.message
              : "Request failed";
        setPlaygroundError(resultError);
      }
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        status?: number;
        response?: { status?: number };
      };
      setPlaygroundError(err?.message || "Something went wrong");
      setPlaygroundStatusCode(err?.status || err?.response?.status || 500);
      setPlaygroundResultText(
        JSON.stringify(
          {
            success: false,
            message: err?.message || "Something went wrong",
            statusCode: err?.status || err?.response?.status || 500,
          },
          null,
          2,
        ),
      );
    } finally {
      setPlaygroundResponseTime(Math.round(performance.now() - start));
      setPlaygroundLoading(false);
    }
  };

  if (loading) return <Loader text="Fetching your workspace..." />;
  if (!dbUser) return null;

  const usagePct = dbUser.limit > 0 ? (dbUser.usage / dbUser.limit) * 100 : 0;
  const usageLeft = Math.max(0, dbUser.limit - dbUser.usage);
  const usageColor =
    usagePct > 80 ? "#ea580c" : usagePct > 60 ? "#d97706" : "#16a34a";
  const maxDailyRequests = Math.max(
    1,
    ...auditDailyUsage.map((e) => e.requests),
  );
  const chartData = auditDailyUsage.map((entry) => ({
    ...entry,
    label: new Date(entry.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
  }));
  const maskedKey = dbUser.apiKey
    ? `${dbUser.apiKey.slice(0, 8)}${"•".repeat(24)}${dbUser.apiKey.slice(-6)}`
    : "";
  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalSpent = paidOrders.reduce((a, o) => a + o.amount, 0);
  const normalizedPlan = (dbUser.plan || "").toLowerCase();
  const avatarSeed = encodeURIComponent(dbUser.name || dbUser.email);
  const dicebearUrl = `https://api.dicebear.com/10.x/pixel-art/svg?seed=${avatarSeed}`;
  const canBuyLimitTopup =
    normalizedPlan === "pro" ||
    normalizedPlan === "enterprise" ||
    normalizedPlan === "advance" ||
    normalizedPlan === "advanced";
  const billingStartTimestamp = dbUser.billingDate
    ? new Date(dbUser.billingDate).getTime()
    : NaN;
  const topupExpirationTimestamp = hasActiveExpirationOverride
    ? activeExpirationTimestamp
    : Number.isFinite(billingStartTimestamp)
      ? billingStartTimestamp + 30 * 24 * 60 * 60 * 1000
      : NaN;
  const billingDaysMatch = billing.display.match(/^(\d+)d\b/);
  const topupDaysLeft = billingDaysMatch
    ? Number(billingDaysMatch[1])
    : /^\d+h\b/.test(billing.display) || billing.display === "Expired"
      ? 0
      : null;
  const topupExpiryDate = Number.isFinite(topupExpirationTimestamp)
    ? new Date(topupExpirationTimestamp).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "current plan expiry";
  const topupValidityTone =
    topupDaysLeft === null || topupDaysLeft > 7
      ? {
          box: "border-[#e2e8f0] bg-[#f8fafc]",
          icon: "text-[#64748b]",
          text: "text-[#64748b]",
        }
      : topupDaysLeft >= 3
        ? {
            box: "border-[#fde68a] bg-[#fffbeb]",
            icon: "text-[#d97706]",
            text: "text-[#a16207]",
          }
        : {
            box: "border-[#fed7aa] bg-[#fff7ed]",
            icon: "text-[#ea580c]",
            text: "text-[#c2410c]",
          };
  const topupValidityMessage =
    topupDaysLeft === null || topupDaysLeft > 7
      ? Number.isFinite(topupExpirationTimestamp)
        ? `Expires with your current plan on ${topupExpiryDate} · Unused requests do not carry forward.`
        : "Expires with your current plan · Unused requests do not carry forward."
      : `${topupDaysLeft === 0 ? "Plan expires today" : `Plan expires in ${topupDaysLeft} ${topupDaysLeft === 1 ? "day" : "days"}`} · This top-up will expire on ${topupExpiryDate} · Unused requests do not carry forward.`;
  const topupMessageIsError = Boolean(
    limitPurchaseMessage && /(failed|error|unable)/i.test(limitPurchaseMessage),
  );
  const directApiBaseUrl =
    process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL ||
    "https://railkit-api.rajivdubey.dev";

  const apiLanguageMeta: Record<
    ApiCodeLanguage,
    { label: string; syntax: "javascript" | "python" | "bash" }
  > = {
    javascript: { label: "JavaScript", syntax: "javascript" },
    python: { label: "Python", syntax: "python" },
    curl: { label: "cURL", syntax: "bash" },
  };

  const buildApiSnippet = (examplePath: string, language: ApiCodeLanguage) => {
    const url = `${directApiBaseUrl}${examplePath}`;
    if (language === "python")
      return `import requests\n\nurl = "${url}"\nheaders = {\n    "x-api-key": "YOUR_API_KEY",\n    "accept": "application/json",\n}\n\nresponse = requests.get(url, headers=headers)\ndata = response.json()\nprint(data)`;
    if (language === "curl")
      return `curl -X GET "${url}" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -H "accept: application/json"`;
    return `const API_KEY = process.env.RAILKIT_API_KEY;\n\nconst response = await fetch("${url}", {\n  method: "GET",\n  headers: {\n    "x-api-key": API_KEY,\n    "accept": "application/json",\n  },\n});\n\nconst data = await response.json();\nconsole.log(data);`;
  };

  const usageExampleCode = `import {\n  configure,\n  checkPNRStatus,\n  getTrainInfo,\n  trackTrain,\n  getTrainHistory,\n} from "railkit";\n\n// Step 1: configure once with your API key\nconfigure(process.env.RAILKIT_API_KEY);\n\n// Check PNR status\nconst pnrResult = await checkPNRStatus("1234567890");\n\n// Get train information\nconst trainResult = await getTrainInfo("12345");\n\n// Track Live Train\nconst liveTrainResult = await trackTrain("12345", "28-03-2026");\n\n// Get Train History (for completed journeys)\nconst historyResult = await getTrainHistory("12345", "28-03-2026");`;

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    { id: "overview", label: "Overview", icon: <IconOverview /> },
    { id: "apikey", label: "API Key", icon: <IconKey /> },
    { id: "apiendpoints", label: "API Endpoints", icon: <IconEndpoints /> },
    { id: "playground", label: "Playground", icon: <IconTerminal /> },
    {
      id: "logs",
      label: "Logs",
      icon: <IconActivity />,
      badge:
        recentLogs.length > 0
          ? recentLogs.length > 99
            ? "99+"
            : String(recentLogs.length)
          : undefined,
    },
    {
      id: "orders",
      label: "Orders",
      icon: <IconReceipt />,
      badge: orders.length > 0 ? String(orders.length) : undefined,
    },
  ];

  return (
    <>
      {viewOrder && (
        <OrderModal order={viewOrder} onClose={() => setViewOrder(null)} />
      )}

      <div className="min-h-screen bg-[#f8f8f8] pt-[60px] font-[var(--font-noto),'Noto_Sans',system-ui,sans-serif] max-[768px]:overflow-x-hidden [&_*]:box-border [&_*]:font-[inherit] [&::-webkit-scrollbar]:size-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#e0e0e0] [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="mx-auto flex min-h-[calc(100vh-60px)] max-w-7xl items-start gap-3.5 px-5 pt-5 pb-8 max-[768px]:px-3 max-[768px]:pt-3 max-[768px]:pb-7 max-[480px]:px-2 max-[480px]:pt-2 max-[480px]:pb-6">
          {/* ── Left Sidebar ─────────────────────────────────────────────── */}
          <aside
            data-open={sidebarOpen}
            className="sticky top-20 z-10 flex max-h-[calc(100vh-100px)] w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto rounded-[18px] border border-[#ebebeb] bg-white px-3 py-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] max-[1100px]:w-[200px] max-[768px]:hidden"
          >
            {/* User pill */}
            <div className="mb-2 flex items-center gap-2.5 border-b border-[#f3f4f6] px-2.5 pt-2 pb-3.5">
              <img
                src={dicebearUrl}
                alt={dbUser.name || dbUser.email}
                className="size-[34px] shrink-0 rounded-[10px] border border-[#e5e7eb] bg-[#f3f4f6]"
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#111]">
                  {dbUser.name || "User"}
                </p>
                <p className="mt-px truncate text-[11px] text-[#9ca3af]">
                  {dbUser.email}
                </p>
              </div>
            </div>

            <p className="mt-1.5 px-2.5 pt-1.5 pb-1 text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase">
              Workspace
            </p>

            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`relative flex w-full cursor-pointer items-center gap-[9px] rounded-[9px] border-none px-2.5 py-[9px] text-left text-[13px] transition-[background,color] duration-150 [&_svg]:shrink-0 ${activeTab === item.id ? "bg-[#f0f0f0] font-semibold text-black [&_svg]:opacity-100" : "bg-transparent font-medium text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111] [&_svg]:opacity-60"}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-auto rounded-full px-1.5 py-px text-[10px] leading-[1.6] font-bold ${activeTab === item.id ? "bg-black text-white" : "bg-[#e5e7eb] text-[#6b7280]"}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="mt-auto border-t border-[#f3f4f6] pt-3">
              <button
                type="button"
                onClick={refreshAll}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[9px] border-none bg-transparent px-2.5 py-2 text-xs font-medium text-[#9ca3af] transition-[color,background] duration-150 hover:bg-[#f3f4f6] hover:text-[#374151]"
              >
                <span
                  className={`inline-flex ${refreshing ? "animate-spin" : ""}`}
                >
                  <IconRefresh />
                </span>
                {refreshing ? "Syncing..." : "Refresh data"}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-[9px] border-none bg-transparent px-2.5 py-2 text-xs font-medium text-[#9ca3af] transition-[color,background] duration-150 hover:bg-[#fef2f2] hover:text-[#dc2626]"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </aside>

          {/* ── Main Content ─────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1 rounded-[18px] border border-[#ebebeb] bg-white px-7 pt-7 pb-9 shadow-[0_2px_12px_rgba(0,0,0,0.04)] max-[1100px]:px-[22px] max-[1100px]:pt-6 max-[1100px]:pb-8 max-[768px]:px-4 max-[768px]:pt-5 max-[480px]:rounded-[14px] max-[480px]:px-3 max-[480px]:pt-3.5 max-[480px]:pb-7">
            {/* Title bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2.5 max-[768px]:mb-4 max-[768px]:items-start">
              <div className="flex items-center gap-2.5">
                <div>
                  <h1 className="text-xl font-bold tracking-[-0.02em] text-black max-[480px]:text-lg">
                    {navItems.find((n) => n.id === activeTab)?.label ??
                      "Dashboard"}
                  </h1>
                  <p className="mt-0.5 text-xs font-normal text-[#9ca3af]">
                    {activeTab === "overview" && "Your usage at a glance"}
                    {activeTab === "apikey" && "Manage your secret key"}
                    {activeTab === "apiendpoints" && "Direct REST endpoints"}
                    {activeTab === "playground" &&
                      "Live test without leaving the dashboard"}
                    {activeTab === "logs" && "Recent API call history"}
                    {activeTab === "orders" && "Billing and payment history"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 max-[768px]:w-full max-[768px]:justify-start">
                <PlanBadge plan={dbUser.plan} />
                <span
                  className={`inline-flex items-center gap-[5px] rounded-md border px-2 py-[3px] text-[11px] font-semibold ${dbUser.active ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]" : "border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af]"}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${dbUser.active ? "bg-[#22c55e]" : "bg-[#d1d5db]"}`}
                  />
                  {dbUser.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* ── Mobile tab bar (≤768px only) ── */}
            <div
              className="mb-[18px] hidden grid-cols-2 gap-1.5 max-[768px]:grid max-[480px]:mb-3.5 max-[480px]:gap-[5px]"
              role="tablist"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-2.5 py-[9px] text-xs transition-[background,color,border-color] duration-150 max-[480px]:min-h-[42px] max-[480px]:min-w-0 max-[480px]:px-1.5 max-[480px]:py-2 max-[480px]:text-[11px] max-[480px]:[&_svg]:shrink-0 ${activeTab === item.id ? "border-black bg-black font-semibold text-white" : "border-[#e5e7eb] bg-white font-medium text-[#6b7280]"}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.icon}
                  {item.label}
                  {item.badge && (
                    <span
                      className={`rounded-full px-[5px] text-[10px] leading-[18px] font-bold ${activeTab === item.id ? "bg-white/25 text-white" : "bg-[#e5e7eb] text-[#6b7280]"}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Overview ─────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="grid gap-4">
                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[768px]:grid-cols-2 max-[480px]:grid-cols-1">
                  {[
                    {
                      label: "Current Plan",
                      value: dbUser.plan.toUpperCase(),
                      sub: dbUser.active ? "Account active" : "Inactive",
                      color:
                        normalizedPlan === "advance" ||
                        normalizedPlan === "enterprise"
                          ? "#7c3aed"
                          : normalizedPlan === "pro"
                            ? "#16a34a"
                            : "#6b7280",
                    },
                    {
                      label: "Requests Used",
                      value: dbUser.usage.toLocaleString("en-IN"),
                      sub: `of ${dbUser.limit.toLocaleString("en-IN")} total`,
                      color: usageColor,
                    },
                    {
                      label: "Requests Left",
                      value: usageLeft.toLocaleString("en-IN"),
                      sub: `${(100 - usagePct).toFixed(0)}% remaining`,
                      color: "#2563eb",
                    },
                    {
                      label: "Billing Cycle",
                      value: billing.display,
                      sub: hasActiveExpirationOverride
                        ? `until ${new Date(activeExpirationTimestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                        : dbUser.billingDate
                          ? `since ${new Date(dbUser.billingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                          : "Not started",
                      color: billing.color,
                    },
                  ].map((s, index) => (
                    <div
                      key={s.label}
                      className={`animate-dashboard-fade-up rounded-2xl border border-[#ebebeb] border-t-[3px] bg-white px-[18px] py-4 max-[480px]:rounded-[13px] ${s.color === "#7c3aed" ? "border-t-[#7c3aed]" : s.color === "#16a34a" ? "border-t-[#16a34a]" : s.color === "#6b7280" ? "border-t-[#6b7280]" : s.color === "#2563eb" ? "border-t-[#2563eb]" : s.color === "#ea580c" ? "border-t-[#ea580c]" : s.color === "#d97706" ? "border-t-[#d97706]" : "border-t-[#dc2626]"} ${index === 0 ? "[animation-delay:0.03s]" : index === 1 ? "[animation-delay:0.07s]" : index === 2 ? "[animation-delay:0.11s]" : "[animation-delay:0.15s]"}`}
                    >
                      <p className="mb-2 text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase">
                        {s.label}
                      </p>
                      <p
                        className={`text-[22px] leading-none font-extrabold tracking-[-0.03em] ${s.color === "#7c3aed" ? "text-[#7c3aed]" : s.color === "#16a34a" ? "text-[#16a34a]" : s.color === "#6b7280" ? "text-[#6b7280]" : s.color === "#2563eb" ? "text-[#2563eb]" : s.color === "#ea580c" ? "text-[#ea580c]" : s.color === "#d97706" ? "text-[#d97706]" : "text-[#dc2626]"}`}
                      >
                        {s.value}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[#c0c0c0]">
                        {s.sub}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Profile + Usage */}
                <div className="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">
                  {/* Profile */}
                  <div className="rounded-2xl border border-[#ebebeb] bg-white p-6 max-[768px]:p-5 max-[480px]:rounded-[13px] max-[480px]:p-4">
                    <p className="mb-3 text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase">
                      Profile
                    </p>
                    <div className="mb-5 flex items-center gap-3.5 max-[480px]:items-start">
                      <img
                        src={dicebearUrl}
                        alt={dbUser.name || dbUser.email}
                        className="size-12 shrink-0 rounded-[14px] border border-[#e5e7eb] bg-[#f3f4f6]"
                      />
                      <div className="min-w-0 pt-0 max-[480px]:pt-[3px] [&_p]:truncate">
                        <p className="text-[15px] font-bold text-black">
                          {dbUser.name || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#9ca3af]">
                          {dbUser.email}
                        </p>
                      </div>
                    </div>
                    {[
                      { k: "Plan", v: <PlanBadge plan={dbUser.plan} /> },
                      {
                        k: "Status",
                        v: (
                          <span className="inline-flex items-center gap-[5px] text-xs">
                            <span
                              className={`size-1.5 rounded-full ${dbUser.active ? "bg-[#22c55e]" : "bg-[#d1d5db]"}`}
                            />
                            <span
                              className={
                                dbUser.active
                                  ? "text-[#16a34a]"
                                  : "text-[#9ca3af]"
                              }
                            >
                              {dbUser.active ? "Active" : "Inactive"}
                            </span>
                          </span>
                        ),
                      },
                      {
                        k: "Total Spent",
                        v: (
                          <span className="text-[13px] font-bold text-[#16a34a]">
                            ₹{totalSpent.toFixed(2)}
                          </span>
                        ),
                      },
                    ].map(({ k, v }) => (
                      <div
                        key={k}
                        className="flex items-center justify-between border-t border-[#f3f4f6] py-[11px]"
                      >
                        <span className="text-[11px] font-semibold tracking-[0.06em] text-[#9ca3af] uppercase">
                          {k}
                        </span>
                        {v}
                      </div>
                    ))}
                  </div>

                  {/* Usage & Billing */}
                  <div className="rounded-2xl border border-[#ebebeb] bg-white p-6 max-[768px]:p-5 max-[480px]:rounded-[13px] max-[480px]:p-4">
                    <p className="mb-3 text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase">
                      Usage & Billing
                    </p>
                    <div className="mb-5">
                      <div className="mb-[7px] flex justify-between">
                        <span className="text-xs font-semibold text-[#374151]">
                          API Requests
                        </span>
                        <span
                          className={`text-xs font-bold ${usageColor === "#16a34a" ? "text-[#16a34a]" : usageColor === "#d97706" ? "text-[#d97706]" : "text-[#ea580c]"}`}
                        >
                          {usagePct.toFixed(1)}%
                        </span>
                      </div>
                      <svg
                        viewBox="0 0 100 6"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                        className="h-1.5 w-full overflow-hidden rounded-[3px]"
                      >
                        <rect
                          width="100"
                          height="6"
                          rx="3"
                          className="fill-[#f3f4f6]"
                        />
                        <rect
                          width={Math.min(100, usagePct)}
                          height="6"
                          rx="3"
                          className={`transition-[width] duration-[600ms] ease-[ease] ${usageColor === "#16a34a" ? "fill-[#16a34a]" : usageColor === "#d97706" ? "fill-[#d97706]" : "fill-[#ea580c]"}`}
                        />
                      </svg>
                      <div className="mt-[5px] flex justify-between">
                        <span className="text-[10px] text-[#c0c0c0]">
                          {dbUser.usage.toLocaleString("en-IN")} used
                        </span>
                        <span className="text-[10px] text-[#c0c0c0]">
                          {dbUser.limit.toLocaleString("en-IN")} total
                        </span>
                      </div>
                    </div>
                    {dbUser.plan !== "free" &&
                      (dbUser.billingDate || hasActiveExpirationOverride) && (
                        <div className="mb-5">
                          <div className="mb-[7px] flex justify-between">
                            <span className="text-xs font-semibold text-[#374151]">
                              Billing Cycle
                            </span>
                            <span
                              className={`text-xs font-bold ${billing.color === "#16a34a" ? "text-[#16a34a]" : billing.color === "#d97706" ? "text-[#d97706]" : "text-[#dc2626]"}`}
                            >
                              {billing.display}
                            </span>
                          </div>
                          <svg
                            viewBox="0 0 100 6"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                            className="h-1.5 w-full overflow-hidden rounded-[3px]"
                          >
                            <rect
                              width="100"
                              height="6"
                              rx="3"
                              className="fill-[#f3f4f6]"
                            />
                            <rect
                              width={billing.pct}
                              height="6"
                              rx="3"
                              className={`transition-[width] duration-[600ms] ease-[ease] ${billing.color === "#16a34a" ? "fill-[#16a34a]" : billing.color === "#d97706" ? "fill-[#d97706]" : "fill-[#dc2626]"}`}
                            />
                          </svg>
                        </div>
                      )}
                    <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
                      {[
                        {
                          label: "Paid Orders",
                          value: paidOrders.length,
                          color: "#16a34a",
                        },
                        {
                          label: "Total Spent",
                          value: `₹${totalSpent.toFixed(0)}`,
                          color: "#d97706",
                        },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-[10px] border border-[#f0f0f0] bg-[#f8f8f8] px-3.5 py-3"
                        >
                          <p className="mb-[5px] text-[10px] font-bold tracking-[0.07em] text-[#c0c0c0] uppercase">
                            {s.label}
                          </p>
                          <p
                            className={`text-xl font-extrabold tracking-[-0.03em] ${s.color === "#16a34a" ? "text-[#16a34a]" : "text-[#d97706]"}`}
                          >
                            {s.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Topup */}
                <div className="group/topup relative rounded-2xl border border-[#ebebeb] bg-white p-6 max-[768px]:p-5 max-[480px]:rounded-[13px] max-[480px]:p-4">
                  <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <p className="text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase">
                      ADD EXTRA REQUESTS
                    </p>
                    <p className="text-[11px] leading-normal text-[#9ca3af]">
                      {usageLeft.toLocaleString("en-IN")} left
                      {topupDaysLeft !== null && (
                        <>
                          {" "}
                          · {topupDaysLeft}{" "}
                          {topupDaysLeft === 1 ? "day" : "days"} left
                        </>
                      )}
                      {Number.isFinite(topupExpirationTimestamp) && (
                        <> · Expires {topupExpiryDate}</>
                      )}
                    </p>
                  </div>
                  <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
                    {TOPUP_OPTIONS.map((option, index) => {
                      const active = index === topupSelection;
                      return (
                        <button
                          key={option.requests}
                          type="button"
                          onClick={() => setTopupSelection(index)}
                          disabled={limitPurchaseLoading}
                          aria-pressed={active}
                          className={`cursor-pointer rounded-xl px-3.5 py-3 text-left text-[#111827] outline-none transition-[border-color,background] duration-150 disabled:cursor-wait ${active ? "border-2 border-[#111] bg-[#f8f8f8]" : "border border-[#e5e7eb] bg-[#fafafa]"}`}
                        >
                          <div
                            className={`text-xs ${active ? "font-bold" : "font-semibold"}`}
                          >
                            +{option.requests.toLocaleString("en-IN")} requests
                          </div>
                          <div
                            className={`mt-[5px] text-[11px] ${active ? "text-[#374151]" : "text-[#9ca3af]"}`}
                          >
                            ₹{option.price} · ₹{option.perReq.toFixed(3)}/req
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className={`${topupValidityTone.box} mb-3 flex items-start gap-[7px] rounded-[9px] border px-3 py-2.5`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${topupValidityTone.icon} shrink-0 text-[13px] leading-normal`}
                    >
                      {topupDaysLeft !== null && topupDaysLeft <= 7 ? "⚠" : "ⓘ"}
                    </span>
                    <p
                      className={`${topupValidityTone.text} min-w-0 text-[11px] leading-normal [overflow-wrap:anywhere]`}
                    >
                      {topupValidityMessage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startLimitTopupPayment}
                    disabled={limitPurchaseLoading}
                    className={`w-full rounded-xl border-none p-[13px] text-[13px] font-bold tracking-[0.01em] transition-colors duration-150 ${limitPurchaseLoading ? "cursor-wait bg-[#e5e7eb] text-[#9ca3af]" : "cursor-pointer bg-[#4f46e5] text-white"}`}
                  >
                    {limitPurchaseLoading
                      ? "Processing..."
                      : `Add ${selectedTopup.requests.toLocaleString("en-IN")} Requests — ₹${selectedTopup.price.toLocaleString("en-IN")} →`}
                  </button>
                  <p className="mt-[7px] text-center text-[10px] leading-[1.4] text-[#9ca3af]">
                    Payments securely processed by Cashfree.
                  </p>
                  {limitPurchaseMessage && (
                    <p
                      role="status"
                      className={`mt-2 rounded-lg border px-[9px] py-[7px] text-[11px] leading-[1.45] ${topupMessageIsError ? "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]" : "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]"}`}
                    >
                      {limitPurchaseMessage}
                    </p>
                  )}
                  {!canBuyLimitTopup && (
                    <div
                      className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center gap-2.5 rounded-xl bg-white/60 p-5 opacity-0 transition-opacity duration-[180ms] group-hover/topup:opacity-100 max-[768px]:flex-col max-[768px]:text-center"
                      data-topup-overlay
                    >
                      <p className="text-[13px] text-[#374151]">
                        Purchase a plan to increase your request limit
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push("/pricing")}
                        className="pointer-events-auto cursor-pointer rounded-lg border-none bg-[#111827] px-3.5 py-2 text-xs font-semibold text-white"
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
              <div className={dashboardCardClass}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]">
                    <IconKey />
                  </div>
                  <p className="text-base font-bold text-black">
                    Secret API Key
                  </p>
                </div>
                <p className="mb-5 text-xs leading-[1.7] text-[#9ca3af] max-[480px]:[overflow-wrap:anywhere]">
                  Install{" "}
                  <span className="rounded-[5px] border border-[#bbf7d0] bg-[#f0fdf4] px-[7px] py-px text-xs text-[#16a34a]">
                    npm install railkit
                  </span>{" "}
                  → configure your key → call any function
                </p>
                <div className="mb-[18px] flex items-center gap-2 rounded-[10px] border border-[#f0f0f0] bg-[#f8f8f8] px-3.5 py-2.5 max-[480px]:items-start">
                  <span className="shrink-0 text-[#6b7280]">
                    <IconShield />
                  </span>
                  <span className="text-xs leading-[1.6] text-[#6b7280]">
                    Your key grants full package access. Rotate it immediately
                    if you believe it has been compromised.
                  </span>
                </div>
                {/* Key row */}
                <div className="flex flex-wrap gap-2 max-[768px]:flex-col">
                  <div className="flex w-full min-w-0 flex-1 items-center justify-between gap-2 rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] px-3.5 py-[11px] max-[768px]:flex-none max-[480px]:px-[11px] max-[480px]:py-2.5">
                    <span className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-[var(--font-noto),'Noto_Sans',monospace] text-[13px] text-[#374151] [scrollbar-width:thin] max-[480px]:text-xs">
                      {regeneratingKey ? (
                        <ApiKeySkeleton />
                      ) : keyVisible ? (
                        dbUser.apiKey
                      ) : (
                        maskedKey
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setKeyVisible(!keyVisible)}
                        aria-label={keyVisible ? "Hide key" : "Reveal key"}
                        disabled={regeneratingKey}
                        className={`flex items-center border-none bg-transparent p-1 ${regeneratingKey ? "cursor-not-allowed text-[#d1d5db]" : "cursor-pointer text-[#9ca3af]"}`}
                      >
                        {keyVisible ? <IconEyeOff /> : <IconEye />}
                      </button>
                      <button
                        type="button"
                        onClick={copyApiKey}
                        aria-label={copied ? "Copied" : "Copy key"}
                        disabled={regeneratingKey}
                        className={`flex items-center border-none bg-transparent p-1 transition-colors duration-200 ${copied ? "text-[#16a34a]" : regeneratingKey ? "cursor-not-allowed text-[#d1d5db]" : "cursor-pointer text-[#9ca3af]"}`}
                      >
                        {copied ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={regenerateApiKey}
                    disabled={regeneratingKey}
                    className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-[10px] border-none px-5 text-[13px] font-semibold transition-colors duration-200 max-[768px]:w-full max-[768px]:justify-center ${regeneratingKey ? "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]" : "cursor-pointer bg-black text-white"}`}
                  >
                    <span
                      className={`inline-flex ${regeneratingKey ? "animate-spin" : ""}`}
                    >
                      <IconRefresh />
                    </span>
                    {regeneratingKey ? "Regenerating..." : "Regenerate Key"}
                  </button>
                </div>
                {regenerateError && (
                  <p className="mt-2.5 text-xs text-[#dc2626]">
                    {regenerateError}
                  </p>
                )}
                {/* Code example */}
                <div className="mt-6 max-w-full overflow-x-auto rounded-[14px] border border-[#21262d] bg-[#0d1117] px-5 py-4 [-webkit-overflow-scrolling:touch] max-[480px]:rounded-[11px] max-[480px]:p-3 [&_pre]:min-w-max">
                  <p className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-[#6b7280] uppercase">
                    Example Usage
                  </p>
                  <SyntaxHighlighter
                    language="typescript"
                    style={nightOwl}
                    className="!m-0 !bg-transparent !p-0 !text-xs !leading-[1.8]"
                  >
                    {usageExampleCode}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* ── API Endpoints ─────────────────────────────────────────── */}
            {activeTab === "apiendpoints" && (
              <div className="grid gap-3.5">
                <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-xs leading-[1.7] text-[#9a3412]">
                  Direct API access is enabled only on the <b>Advance</b> plan.
                  Free/Pro users must use the official SDK.
                </div>
                <div className={dashboardCardClass}>
                  <p className="mb-2.5 text-[15px] font-bold text-black">
                    How to call endpoints
                  </p>
                  <div className="mb-2.5 flex justify-end">
                    <select
                      value={apiCodeLanguage}
                      onChange={(e) =>
                        setApiCodeLanguage(e.target.value as ApiCodeLanguage)
                      }
                      className={`${dashboardSelectClass} !w-auto max-[768px]:!w-full`}
                    >
                      {(Object.keys(apiLanguageMeta) as ApiCodeLanguage[]).map(
                        (lang) => (
                          <option key={lang} value={lang}>
                            {apiLanguageMeta[lang].label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <p className="mb-3.5 break-words text-xs leading-[1.7] text-[#6b7280] [overflow-wrap:anywhere]">
                    Base URL:{" "}
                    <span className="text-[#2563eb]">{directApiBaseUrl}</span>
                    <br />
                    Required header:{" "}
                    <span className="text-[#16a34a]">
                      x-api-key: YOUR_API_KEY
                    </span>
                  </p>
                  <div className="max-w-full overflow-x-auto rounded-xl border border-[#21262d] bg-[#0d1117] p-3.5 [-webkit-overflow-scrolling:touch] max-[480px]:rounded-[11px] max-[480px]:p-3 [&_pre]:min-w-max">
                    <SyntaxHighlighter
                      language={apiLanguageMeta[apiCodeLanguage].syntax}
                      style={nightOwl}
                      className="!m-0 !bg-transparent !p-0 !text-xs !leading-[1.7]"
                    >
                      {buildApiSnippet(
                        "/api/checkPNRStatus/1234567890",
                        apiCodeLanguage,
                      )}
                    </SyntaxHighlighter>
                  </div>
                </div>
                {endpointDocs.map((endpoint) => (
                  <div key={endpoint.path} className={dashboardCardClass}>
                    <div className="mb-2 flex flex-wrap items-center gap-2.5">
                      <span className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-bold text-[#16a34a]">
                        {endpoint.method}
                      </span>
                      <p className="text-sm font-bold text-black">
                        {endpoint.name}
                      </p>
                    </div>
                    <p className="mb-1 break-all text-xs text-[#374151]">
                      {endpoint.path}
                    </p>
                    <p className="mb-1 break-all text-[11px] text-[#9ca3af]">
                      Example: {directApiBaseUrl}
                      {endpoint.examplePath}
                    </p>
                    <p className="mb-3 text-[11px] text-[#9ca3af]">
                      {endpoint.notes}
                    </p>
                    <div className="max-w-full overflow-x-auto rounded-xl border border-[#21262d] bg-[#0d1117] p-3.5 [-webkit-overflow-scrolling:touch] max-[480px]:rounded-[11px] max-[480px]:p-3 [&_pre]:min-w-max">
                      <SyntaxHighlighter
                        language={apiLanguageMeta[apiCodeLanguage].syntax}
                        style={nightOwl}
                        className="!m-0 !bg-transparent !p-0 !text-xs !leading-[1.7]"
                      >
                        {buildApiSnippet(endpoint.examplePath, apiCodeLanguage)}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Playground ────────────────────────────────────────────── */}
            {activeTab === "playground" && (
              <div className="grid grid-cols-[1.05fr_0.95fr] gap-4 max-[1100px]:grid-cols-1">
                <div className={dashboardCardClass}>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[15px] font-bold text-black">
                      API Playground
                    </p>
                    <span className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-[3px] text-[11px] font-semibold text-[#16a34a]">
                      Using your API key
                    </span>
                  </div>
                  <p className="mb-4 text-xs leading-[1.7] text-[#9ca3af]">
                    Run live requests without leaving your workspace.
                  </p>
                  {/* Action pills */}
                  <div className="mb-4 flex flex-wrap gap-1.5 max-[768px]:[&>button]:min-h-10">
                    {[
                      { id: "pnr", label: "PNR" },
                      { id: "train", label: "Train" },
                      { id: "track", label: "Track" },
                      { id: "history", label: "History" },
                      { id: "station", label: "Station" },
                      { id: "search", label: "Search" },
                      { id: "seat", label: "Seat" },
                      { id: "fare", label: "Fare" },
                      { id: "cancelled", label: "Cancelled" },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setPlaygroundAction(
                            item.id as typeof playgroundAction,
                          );
                          resetPlaygroundMeta();
                        }}
                        className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-[background,color] duration-150 ${playgroundAction === item.id ? "border-black bg-black text-white" : "border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {/* Inputs */}
                  <div className="grid grid-cols-2 gap-2.5 max-[768px]:grid-cols-1 max-[768px]:[&>*]:col-span-full max-[768px]:[&>*]:min-w-0">
                    {playgroundAction === "pnr" && (
                      <input
                        value={pnrInput}
                        onChange={(e) =>
                          setPnrInput(e.target.value.replace(/\D/g, ""))
                        }
                        maxLength={10}
                        placeholder="PNR number (10 digits)"
                        className={`${dashboardInputClass} col-span-full`}
                      />
                    )}
                    {playgroundAction === "train" && (
                      <input
                        value={trainInput}
                        onChange={(e) =>
                          setTrainInput(e.target.value.replace(/\D/g, ""))
                        }
                        maxLength={5}
                        placeholder="Train number (5 digits)"
                        className={`${dashboardInputClass} col-span-full`}
                      />
                    )}
                    {playgroundAction === "track" && (
                      <>
                        <input
                          value={trackTrainInput}
                          onChange={(e) =>
                            setTrackTrainInput(
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          maxLength={5}
                          placeholder="Train number"
                          className={dashboardInputClass}
                        />
                        <input
                          type="date"
                          value={toInputDate(trackDateInput)}
                          onChange={(e) =>
                            setTrackDateInput(fromInputDate(e.target.value))
                          }
                          className={dashboardInputClass}
                        />
                      </>
                    )}
                    {playgroundAction === "history" && (
                      <>
                        <input
                          value={historyTrainInput}
                          onChange={(e) =>
                            setHistoryTrainInput(
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          maxLength={5}
                          placeholder="Train number"
                          className={dashboardInputClass}
                        />
                        <input
                          type="date"
                          value={toInputDate(historyDateInput)}
                          onChange={(e) =>
                            setHistoryDateInput(fromInputDate(e.target.value))
                          }
                          className={dashboardInputClass}
                        />
                      </>
                    )}
                    {playgroundAction === "station" && (
                      <>
                        <input
                          value={stationInput}
                          onChange={(e) =>
                            setStationInput(e.target.value.toUpperCase())
                          }
                          placeholder="Station code (e.g. NDLS)"
                          className={dashboardInputClass}
                        />
                        <select
                          value={stationHoursInput}
                          onChange={(e) =>
                            setStationHoursInput(
                              e.target.value as "2" | "4" | "8",
                            )
                          }
                          className={dashboardSelectClass}
                          aria-label="Time window in hours"
                        >
                          <option value="2">2 hrs</option>
                          <option value="4">4 hrs</option>
                          <option value="8">8 hrs</option>
                        </select>
                      </>
                    )}
                    {playgroundAction === "search" && (
                      <>
                        <input
                          value={fromStationInput}
                          onChange={(e) =>
                            setFromStationInput(e.target.value.toUpperCase())
                          }
                          placeholder="From station code"
                          className={dashboardInputClass}
                        />
                        <input
                          value={toStationInput}
                          onChange={(e) =>
                            setToStationInput(e.target.value.toUpperCase())
                          }
                          placeholder="To station code"
                          className={dashboardInputClass}
                        />
                        <input
                          type="date"
                          value={toInputDate(searchDateInput)}
                          onChange={(e) =>
                            setSearchDateInput(fromInputDate(e.target.value))
                          }
                          className={dashboardInputClass}
                        />
                      </>
                    )}
                    {playgroundAction === "seat" && (
                      <>
                        <input
                          value={seatTrainInput}
                          onChange={(e) =>
                            setSeatTrainInput(e.target.value.replace(/\D/g, ""))
                          }
                          maxLength={5}
                          placeholder="Train number"
                          className={dashboardInputClass}
                        />
                        <input
                          type="date"
                          value={toInputDate(seatDateInput)}
                          onChange={(e) =>
                            setSeatDateInput(fromInputDate(e.target.value))
                          }
                          className={dashboardInputClass}
                        />
                        <input
                          value={seatFromInput}
                          onChange={(e) =>
                            setSeatFromInput(e.target.value.toUpperCase())
                          }
                          placeholder="From station code"
                          className={dashboardInputClass}
                        />
                        <input
                          value={seatToInput}
                          onChange={(e) =>
                            setSeatToInput(e.target.value.toUpperCase())
                          }
                          placeholder="To station code"
                          className={dashboardInputClass}
                        />
                        <select
                          value={seatClassInput}
                          onChange={(e) => setSeatClassInput(e.target.value)}
                          className={dashboardSelectClass}
                        >
                          {["SL", "3A", "2A", "1A", "CC", "EC", "2S"].map(
                            (c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ),
                          )}
                        </select>
                        <select
                          value={seatQuotaInput}
                          onChange={(e) => setSeatQuotaInput(e.target.value)}
                          className={dashboardSelectClass}
                        >
                          {["GN", "TQ", "LD", "PT", "SS"].map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    {playgroundAction === "fare" && (
                      <>
                        <input
                          value={fareTrainInput}
                          onChange={(e) =>
                            setFareTrainInput(e.target.value.replace(/\D/g, ""))
                          }
                          maxLength={5}
                          placeholder="Train number"
                          className={dashboardInputClass}
                        />
                        <input
                          type="date"
                          value={toInputDate(fareDateInput)}
                          onChange={(e) =>
                            setFareDateInput(fromInputDate(e.target.value))
                          }
                          className={dashboardInputClass}
                        />
                        <input
                          value={fareFromInput}
                          onChange={(e) =>
                            setFareFromInput(e.target.value.toUpperCase())
                          }
                          placeholder="From station code"
                          className={dashboardInputClass}
                        />
                        <input
                          value={fareToInput}
                          onChange={(e) =>
                            setFareToInput(e.target.value.toUpperCase())
                          }
                          placeholder="To station code"
                          className={dashboardInputClass}
                        />
                        <select
                          value={fareClassInput}
                          onChange={(e) => setFareClassInput(e.target.value)}
                          className={dashboardSelectClass}
                        >
                          {[
                            "SL",
                            "3A",
                            "2A",
                            "1A",
                            "CC",
                            "EC",
                            "EA",
                            "FC",
                            "2S",
                            "3E",
                            "VS",
                            "CH",
                            "HS",
                            "VC",
                            "VA",
                          ].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <select
                          value={fareQuotaInput}
                          onChange={(e) => setFareQuotaInput(e.target.value)}
                          className={dashboardSelectClass}
                        >
                          {[
                            "GN",
                            "TQ",
                            "PT",
                            "LD",
                            "DF",
                            "FT",
                            "LB",
                            "YU",
                            "DP",
                            "HP",
                            "PH",
                            "SS",
                          ].map((q) => (
                            <option key={q} value={q}>
                              {q}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    {playgroundAction === "cancelled" && (
                      <div className="col-span-full rounded-[10px] border border-[#e5e7eb] bg-[#f9fafb] px-3 py-[11px] text-xs leading-[1.6] text-[#6b7280]">
                        No input required. Run the request to fetch all fully
                        and partially cancelled trains.
                      </div>
                    )}
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={runPlayground}
                      disabled={playgroundLoading}
                      className={`rounded-[10px] border-none px-[18px] py-2.5 text-[13px] font-bold transition-colors duration-150 ${playgroundLoading ? "cursor-not-allowed bg-[#e5e7eb] text-[#9ca3af]" : "cursor-pointer bg-black text-white"}`}
                    >
                      {playgroundLoading ? "Running..." : "Run Request"}
                    </button>
                    {playgroundStatusCode !== null && (
                      <span
                        className={`rounded-md border px-2 py-[3px] text-[11px] font-semibold ${playgroundStatusCode < 400 ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]" : "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]"}`}
                      >
                        HTTP {playgroundStatusCode}
                      </span>
                    )}
                    {playgroundResponseTime !== null && (
                      <span className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-2 py-[3px] text-[11px] font-semibold text-[#2563eb]">
                        {playgroundResponseTime}ms
                      </span>
                    )}
                  </div>
                  {playgroundError && (
                    <p className="mt-2.5 text-xs text-[#dc2626]">
                      {playgroundError}
                    </p>
                  )}
                </div>
                {/* Response panel */}
                <div className="min-h-[420px] overflow-hidden rounded-2xl border border-[#21262d] bg-[#0d1117] max-[1100px]:min-h-[360px] max-[768px]:min-h-80 max-[480px]:min-h-[280px] max-[480px]:rounded-[13px]">
                  <div className="flex items-center justify-between border-b border-[#21262d] bg-[#161b22] px-4 py-3">
                    <span className="text-[11px] font-semibold tracking-[0.08em] text-[#8b949e] uppercase">
                      Response
                    </span>
                    <span className="text-[11px] text-[#6b7280]">JSON</span>
                  </div>
                  <div className="p-4">
                    {playgroundLoading ? (
                      <PlaygroundResponseSkeleton />
                    ) : (
                      <SyntaxHighlighter
                        language="json"
                        style={nightOwl}
                        className="!m-0 !min-h-[360px] !max-h-[520px] !overflow-auto !rounded-lg !bg-transparent !p-0 !text-xs !leading-[1.7]"
                      >
                        {playgroundResultText ||
                          `{\n  "message": "Run a request to preview the live response"\n}`}
                      </SyntaxHighlighter>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Logs ──────────────────────────────────────────────────── */}
            {activeTab === "logs" && (
              <div className="grid gap-4">
                <div className={dashboardCardClass}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
                    <p className="text-[15px] font-bold text-black">
                      API Requests Per Day
                    </p>
                    <div className="flex overflow-hidden rounded-lg border border-[#e5e7eb]">
                      {([14, 30] as const).map((days) => (
                        <button
                          type="button"
                          key={days}
                          onClick={() => setLogsTimelineDays(days)}
                          className={`cursor-pointer border-none px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${days === 14 ? "border-r border-r-[#e5e7eb]" : ""} ${logsTimelineDays === days ? "bg-black text-white" : "bg-white text-[#6b7280]"}`}
                        >
                          {days}D
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[260px] rounded-xl border border-[#f0f0f0] bg-[#fafafa] p-3 max-[768px]:h-[230px] max-[768px]:p-2 max-[480px]:h-[210px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="areaFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#000"
                              stopOpacity={0.08}
                            />
                            <stop
                              offset="100%"
                              stopColor="#000"
                              stopOpacity={0.01}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                          axisLine={{ stroke: "#f0f0f0" }}
                          tickLine={{ stroke: "#f0f0f0" }}
                          minTickGap={18}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: "#9ca3af", fontSize: 11 }}
                          axisLine={{ stroke: "#f0f0f0" }}
                          tickLine={{ stroke: "#f0f0f0" }}
                        />
                        <Tooltip
                          cursor={{ stroke: "rgba(0,0,0,0.1)", strokeWidth: 1 }}
                          contentStyle={{
                            background: "#fff",
                            border: "1px solid #ebebeb",
                            borderRadius: 10,
                            color: "#374151",
                            fontSize: 12,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                          }}
                          formatter={(value) => {
                            const n =
                              typeof value === "number"
                                ? value
                                : Number(value ?? 0);
                            return [`${n} requests`, "Usage"];
                          }}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="requests"
                          stroke="none"
                          fill="url(#areaFill)"
                        />
                        <Line
                          type="monotone"
                          dataKey="requests"
                          stroke="#000"
                          strokeWidth={2}
                          dot={{
                            r: 3,
                            stroke: "#fff",
                            strokeWidth: 1.5,
                            fill: "#000",
                          }}
                          activeDot={{
                            r: 5,
                            fill: "#000",
                            stroke: "#fff",
                            strokeWidth: 2,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] font-semibold text-[#c0c0c0]">
                    <span>
                      Start:{" "}
                      {auditDailyUsage[0]
                        ? new Date(auditDailyUsage[0].date).toLocaleDateString(
                            "en-IN",
                            { day: "2-digit", month: "short" },
                          )
                        : "-"}
                    </span>
                    <span>Peak: {maxDailyRequests} req/day</span>
                    <span>
                      End:{" "}
                      {auditDailyUsage[auditDailyUsage.length - 1]
                        ? new Date(
                            auditDailyUsage[auditDailyUsage.length - 1].date,
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "-"}
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#ebebeb] bg-white max-[480px]:rounded-[13px]">
                  <div className="flex items-center justify-between border-b border-[#f3f4f6] bg-[#fafafa] px-5 py-3.5 max-[768px]:flex-wrap max-[768px]:gap-2 max-[480px]:px-3.5 max-[480px]:py-3">
                    <span className="text-sm font-bold text-[#111]">
                      Recent API Logs
                    </span>
                    <span className="text-[11px] text-[#9ca3af]">
                      {recentLogs.length} entries
                    </span>
                  </div>
                  <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                    <table className={dashboardTableClass}>
                      <thead>
                        <tr className="border-b border-[#f3f4f6] bg-[#fafafa]">
                          {["Time", "Path", "Status", "Duration", "IP"].map(
                            (h) => (
                              <th
                                key={h}
                                className="whitespace-nowrap px-4 py-[11px] text-left text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {recentLogs.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-12 text-center text-xs text-[#d1d5db] max-[640px]:block max-[640px]:px-4 max-[640px]:py-7 max-[640px]:before:hidden"
                            >
                              No logs yet for this account.
                            </td>
                          </tr>
                        ) : (
                          recentLogs.map((log) => (
                            <tr
                              key={log.id}
                              className="border-b border-[#f9f9f9] transition-colors duration-100 hover:bg-[#fafafa]"
                            >
                              <td
                                data-label="Time"
                                className="whitespace-nowrap px-4 py-[11px] text-[11px] text-[#9ca3af]"
                              >
                                {new Date(log.createdAt).toLocaleString(
                                  "en-IN",
                                )}
                              </td>
                              <td
                                data-label="Path"
                                className="max-w-[420px] break-all px-4 py-[11px] text-xs text-[#374151]"
                              >
                                {log.path}
                              </td>
                              <td
                                data-label="Status"
                                className="px-4 py-[11px]"
                              >
                                <span
                                  className={`text-xs font-bold ${log.statusCode >= 200 && log.statusCode < 400 ? "text-[#16a34a]" : "text-[#dc2626]"}`}
                                >
                                  {log.statusCode}
                                </span>
                              </td>
                              <td
                                data-label="Duration"
                                className="px-4 py-[11px] text-xs font-semibold text-[#2563eb]"
                              >
                                {Number(log.duration).toFixed(2)} ms
                              </td>
                              <td
                                data-label="IP"
                                className="px-4 py-[11px] text-[11px] text-[#9ca3af]"
                              >
                                {log.ip}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Orders ────────────────────────────────────────────────── */}
            {activeTab === "orders" && (
              <div className="overflow-hidden rounded-2xl border border-[#ebebeb] bg-white max-[480px]:rounded-[13px]">
                <div className="flex items-center justify-between border-b border-[#f3f4f6] bg-[#fafafa] px-5 py-3.5 max-[768px]:flex-wrap max-[768px]:gap-2 max-[480px]:px-3.5 max-[480px]:py-3">
                  <span className="text-sm font-bold text-[#111]">
                    All orders ·{" "}
                    <span className="text-[#16a34a]">
                      {paidOrders.length} paid
                    </span>
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">
                    Total:{" "}
                    <span className="font-bold text-[#d97706]">
                      ₹{totalSpent.toFixed(2)}
                    </span>
                  </span>
                </div>
                <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  <table className={dashboardTableClass}>
                    <thead>
                      <tr className="border-b border-[#f3f4f6] bg-[#fafafa]">
                        {[
                          "Order ID",
                          "Amount",
                          "Status",
                          "Credited",
                          "Date",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap px-4 py-[11px] text-left text-[10px] font-bold tracking-[0.08em] text-[#c0c0c0] uppercase"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-12 text-center text-xs text-[#d1d5db] max-[640px]:block max-[640px]:px-4 max-[640px]:py-7 max-[640px]:before:hidden"
                          >
                            No orders found. Subscribe to a plan to get started.
                          </td>
                        </tr>
                      ) : (
                        orders.map((o) => (
                          <tr
                            key={o._id}
                            className="border-b border-[#f9f9f9] transition-colors duration-100 hover:bg-[#fafafa]"
                          >
                            <td
                              data-label="Order ID"
                              className="px-4 py-[13px] text-[11px] text-[#9ca3af]"
                            >
                              {o.orderId}
                            </td>
                            <td data-label="Amount" className="px-4 py-[13px]">
                              <span className="text-[13px] font-bold text-[#16a34a]">
                                ₹{o.amount.toFixed(2)}
                              </span>
                              <span className="ml-1 text-[10px] text-[#c0c0c0]">
                                {o.currency}
                              </span>
                            </td>
                            <td data-label="Status" className="px-4 py-[13px]">
                              <StatusBadge status={o.status} />
                            </td>
                            <td
                              data-label="Credited"
                              className="px-4 py-[13px]"
                            >
                              <span className="inline-flex items-center gap-[5px] text-xs">
                                {o.credited ? (
                                  <>
                                    <span className="text-[#16a34a]">
                                      <IconCheck />
                                    </span>
                                    <span className="font-semibold text-[#16a34a]">
                                      Yes
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[#d1d5db]">
                                      <IconX />
                                    </span>
                                    <span className="text-[#9ca3af]">No</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td
                              data-label="Date"
                              className="px-4 py-[13px] text-[11px] text-[#9ca3af]"
                            >
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString(
                                    "en-IN",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )
                                : "—"}
                            </td>
                            <td data-label="Details" className="px-4 py-[13px]">
                              <button
                                type="button"
                                onClick={() => setViewOrder(o)}
                                className="flex cursor-pointer items-center gap-[5px] rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] px-[11px] py-[5px] text-xs font-semibold text-[#6b7280] transition-colors duration-150"
                              >
                                <IconEye />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
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

