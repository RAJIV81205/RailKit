"use client";

import { useEffect, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import useSWR from "swr";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/hljs";
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

// ─── SWR Fetcher ──────────────────────────────────────────────────────────────
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Request failed");
  return data;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  _id: string;
  email: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  active: boolean;
  usage: number;
  limit: number;
  apiKey?: string;
  billingDate?: string | null;
  expirationDate?: string | null;
  status?: "clean" | "flagged" | "banned";
  statusReasons?: Array<{ reason: string; by: string; at: string; note?: string | null }>;
  flaggedAt?: string | null;
  bannedAt?: string | null;
  bannedUntil?: string | null;
  bannedBy?: string | null;
  whitelisted?: boolean;
}

interface Order {
  _id: string;
  orderId: string;
  userId?: { email: string };
  amount: number;
  currency: string;
  status: string;
  credited: boolean;
  createdAt?: string;
}

interface Topup {
  _id: string;
  orderId: string;
  userId?: { email: string };
  amount: number;
  currency: string;
  extraLimit: number;
  status: string;
  credited: boolean;
  createdAt?: string;
}

interface ManualCreateOrderPayload {
  email: string;
  amount: number;
  planType: "pro" | "advance";
  timestamp?: string;
  transactionReference: string;
  note?: string;
}

interface GithubIssue {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  comments: number;
  author: string;
  labels: Array<{ name: string; color: string }>;
  isNew: boolean;
  isRecentlyUpdated: boolean;
}

interface AuditLog {
  id: string;
  email: string;
  statusCode: number;
  path: string;
  ip: string;
  duration: number;
  source: "SDK" | "API";
  createdAt: string;
}

interface LogsData {
  success: boolean;
  logs: {
    timelineDays: number;
    dailyUsage: Array<{
      date: string;
      requests: number;
    }>;
    recent: AuditLog[];
  };
}

type EmailAudienceFilter =
  | "all_users"
  | "free_users"
  | "pro_users"
  | "advance_users"
  | "paid_users"
  | "active_users"
  | "inactive_users"
  | "billing_7_days_left"
  | "billing_3_days_left"
  | "billing_1_day_left"
  | "billing_within_7_days"
  | "billing_expired";

const EMAIL_AUDIENCE_FILTER_OPTIONS: Array<{ value: EmailAudienceFilter; label: string }> = [
  { value: "all_users", label: "All users" },
  { value: "free_users", label: "Free users" },
  { value: "pro_users", label: "Pro users" },
  { value: "advance_users", label: "Advance users" },
  { value: "paid_users", label: "Paid users" },
  { value: "active_users", label: "Active users" },
  { value: "inactive_users", label: "Inactive users" },
  { value: "billing_7_days_left", label: "Billing: exactly 7 days left" },
  { value: "billing_3_days_left", label: "Billing: exactly 3 days left" },
  { value: "billing_1_day_left", label: "Billing: exactly 1 day left" },
  { value: "billing_within_7_days", label: "Billing: within next 7 days" },
  { value: "billing_expired", label: "Billing expired" },
];

const getEmailAudienceLabel = (filter: EmailAudienceFilter) =>
  EMAIL_AUDIENCE_FILTER_OPTIONS.find((option) => option.value === filter)?.label || "Selected users";

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

const getBillingDaysLeft = (
  billingDate?: string | null,
  expirationDate?: string | null,
) => {
  const now = Date.now();
  const expiration = expirationDate ? new Date(expirationDate).getTime() : NaN;
  if (Number.isFinite(expiration) && expiration > now) {
    return Math.ceil((expiration - now) / (24 * 60 * 60 * 1000));
  }

  if (!billingDate) return null;
  const billingStart = new Date(billingDate).getTime();
  if (Number.isNaN(billingStart)) return null;
  const remainingMs = billingStart + BILLING_CYCLE_MS - now;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
};

const matchesEmailAudienceFilter = (user: User, filter: EmailAudienceFilter) => {
  const plan = user.plan?.toLowerCase();
  const isFree = plan === "free";
  const isPro = plan === "pro";
  const isAdvance = plan === "enterprise" || plan === "advance";
  const isPaid = isPro || isAdvance;
  const daysLeft = getBillingDaysLeft(
    user.billingDate || null,
    user.expirationDate || null,
  );

  switch (filter) {
    case "all_users":
      return true;
    case "free_users":
      return isFree;
    case "pro_users":
      return isPro;
    case "advance_users":
      return isAdvance;
    case "paid_users":
      return isPaid;
    case "active_users":
      return user.active;
    case "inactive_users":
      return !user.active;
    case "billing_7_days_left":
      return isPaid && daysLeft === 7;
    case "billing_3_days_left":
      return isPaid && daysLeft === 3;
    case "billing_1_day_left":
      return isPaid && daysLeft === 1;
    case "billing_within_7_days":
      return isPaid && daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
    case "billing_expired":
      return isPaid && daysLeft !== null && daysLeft <= 0;
    default:
      return true;
  }
};

// ─── Loader ───────────────────────────────────────────────────────────────────
function Loader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-[#0a0c10] flex flex-col items-center justify-center z-50">
      <div className="relative mb-6">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "2px solid #1e2330",
            borderTop: "2px solid #6ee7b7",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            border: "2px solid #1e2330",
            borderBottom: "2px solid #34d399",
            animation: "spin 1.2s linear infinite reverse",
          }}
        />
      </div>
      <p style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.08em" }}>
        {text}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
    @keyframes responseShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`}</style>
    </div>
  );
}

function PlaygroundResponseSkeleton() {
  const lineWidths = ["92%", "84%", "88%", "66%", "90%", "72%", "58%"];
  return (
    <div
      style={{
        minHeight: 360,
        maxHeight: 520,
        overflow: "hidden",
        padding: "2px 0",
      }}
    >
      <style>{`@keyframes responseShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`}</style>
      <div
        style={{
          width: 96,
          height: 10,
          borderRadius: 999,
          marginBottom: 14,
          background:
            "linear-gradient(90deg, rgba(45,53,72,0.65) 25%, rgba(71,85,105,0.38) 50%, rgba(45,53,72,0.65) 75%)",
          backgroundSize: "200% 100%",
          animation: "responseShimmer 1.4s ease-in-out infinite",
        }}
      />
      {lineWidths.map((width, index) => (
        <div
          key={`${width}-${index}`}
          style={{
            width,
            height: 10,
            borderRadius: 999,
            marginBottom: index === lineWidths.length - 1 ? 0 : 10,
            background:
              "linear-gradient(90deg, rgba(30,41,59,0.7) 25%, rgba(71,85,105,0.42) 50%, rgba(30,41,59,0.7) 75%)",
            backgroundSize: "200% 100%",
            animation: "responseShimmer 1.4s ease-in-out infinite",
            animationDelay: `${index * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconGoogle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ─── Plan Badge ───────────────────────────────────────────────────────────────
const PlanBadge = ({ plan }: { plan: string }) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    free:       { bg: "#1e2330", text: "#94a3b8", border: "#2d3548" },
    pro:        { bg: "#0f2a1d", text: "#6ee7b7", border: "#1a4731" },
    enterprise: { bg: "#1a1060", text: "#a78bfa", border: "#2d1f8a" },
  };
  const s = styles[plan] || styles.free;
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      padding: "2px 8px", borderRadius: 4, fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "uppercase",
    }}>{plan}</span>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    paid:      { bg: "#0f2a1d", text: "#6ee7b7", border: "#1a4731", dot: "#34d399" },
    active:    { bg: "#0f2233", text: "#60a5fa", border: "#1a3a5c", dot: "#3b82f6" },
    created:   { bg: "#1e2330", text: "#94a3b8", border: "#2d3548", dot: "#64748b" },
    failed:    { bg: "#2a0f0f", text: "#f87171", border: "#4a1f1f", dot: "#ef4444" },
    cancelled: { bg: "#2a1f0f", text: "#fb923c", border: "#4a3a1f", dot: "#f97316" },
    expired:   { bg: "#1e2330", text: "#64748b", border: "#2d3548", dot: "#475569" },
  };
  const s = styles[status] || styles.created;
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      padding: "3px 10px", borderRadius: 4, fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status.toUpperCase()}
    </span>
  );
};

const formatCompactDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

const maskEmail = (email: string) => {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) return "*****";

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}***@${domainPart}`;
  }

  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.slice(-1);
  return `${visibleStart}***${visibleEnd}@${domainPart}`;
};

const UserStatusBadge = ({ status }: { status?: User["status"] }) => {
  const value = status || "clean";
  const palette: Record<NonNullable<User["status"]>, { bg: string; border: string; color: string; label: string }> = {
    clean: { bg: "#0f2a1d", border: "#1a4731", color: "#6ee7b7", label: "Clean" },
    flagged: { bg: "#2a1f0f", border: "#4a3a1f", color: "#fb923c", label: "Flagged" },
    banned: { bg: "#2a0f0f", border: "#4a1f1f", color: "#f87171", label: "Banned" },
  };
  const tone = palette[value as NonNullable<User["status"]>];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        padding: "2px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: tone.color,
          boxShadow: `0 0 6px ${tone.color}`,
          flexShrink: 0,
        }}
      />
      {tone.label}
    </span>
  );
};

const MiniBadge = ({
  label,
  bg,
  border,
  color,
}: {
  label: string;
  bg: string;
  border: string;
  color: string;
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace",
      background: bg,
      border: `1px solid ${border}`,
      color,
      padding: "2px 7px",
      borderRadius: 999,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

const displayEmail = (email: string, showSensitiveInfo: boolean) =>
  showSensitiveInfo ? email : maskEmail(email);

// ─── Modal ────────────────────────────────────────────────────────────────────
function OrderModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1117", border: "1px solid #1e2330",
          borderRadius: 12, padding: 28, width: "100%", maxWidth: 480,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>Order Details</span>
          <button type="button" onClick={onClose} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IconX />
          </button>
        </div>
        {Object.entries(order).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1f2e" }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</span>
            <span style={{ color: "#cbd5e1", fontSize: 12, maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Billing Timer Component ──────────────────────────────────────────────────
function BillingTimer({ user }: { user: User }) {
  const [display, setDisplay] = useState<string>("");

  useEffect(() => {
    const updateDisplay = () => {
      if (user.plan === "free") {
        setDisplay("Free plan");
        return;
      }
      const now = Date.now();
      const expiration = user.expirationDate ? new Date(user.expirationDate).getTime() : NaN;
      if (Number.isFinite(expiration) && expiration > now) {
        const remainingMs = expiration - now;
        const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;

        if (days > 0) {
          setDisplay(`${days}d ${hours}h left `);
        } else {
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          setDisplay(`${hours}h ${minutes}m left  `);
        }
        return;
      }
      if (!user.billingDate) {
        setDisplay("Not started");
        return;
      }

      const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
      const billingStart = new Date(user.billingDate).getTime();
      if (Number.isNaN(billingStart)) {
        setDisplay("Invalid date");
        return;
      }

      const billingEndsAt = billingStart + BILLING_CYCLE_MS;
      const remainingMs = billingEndsAt - now;
      if (remainingMs <= 0) {
        setDisplay("Expired");
        return;
      }

      const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;

      if (days > 0) {
        setDisplay(`${days}d ${hours}h left`);
      } else {
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        setDisplay(`${hours}h ${minutes}m left`);
      }
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [user]);

  return (
    <span style={{ color: display === "Expired" ? "#f87171" : "#94a3b8", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, whiteSpace: "nowrap", display: "block" }}>
      {display}
    </span>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({ user, onSave, onClose, showSensitiveInfo }: { user: User; onSave: (id: string, updates: Partial<User> & { statusReason?: string; statusNote?: string }) => void; onClose: () => void; showSensitiveInfo: boolean }) {
  const [draft, setDraft] = useState({ ...user });
  const [statusReason, setStatusReason] = useState("");
  const [statusNote, setStatusNote] = useState("");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1117", border: "1px solid #1e2330",
          borderRadius: 12, padding: 28, width: "100%", maxWidth: 440,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, margin: 0 }}>Edit User</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0", fontFamily: "'JetBrains Mono', monospace" }}>
              {displayEmail(user.email, showSensitiveInfo)}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IconX />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Plan */}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Plan</span>
            <select
              value={draft.plan}
              onChange={(e) => setDraft({ ...draft, plan: e.target.value as User["plan"] })}
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          {/* Usage / Limit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Usage</span>
              <input
                type="number"
                value={draft.usage}
                onChange={(e) => setDraft({ ...draft, usage: Number(e.target.value) })}
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Limit</span>
              <input
                type="number"
                value={draft.limit}
                onChange={(e) => setDraft({ ...draft, limit: Number(e.target.value) })}
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
              />
            </label>
          </div>

          {/* Active */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => setDraft({ ...draft, active: !draft.active })}
              style={{
                width: 38, height: 20, borderRadius: 10,
                background: draft.active ? "#059669" : "#1e2330",
                border: `1px solid ${draft.active ? "#047857" : "#2d3548"}`,
                position: "relative", cursor: "pointer", transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute", top: 2, left: draft.active ? 18 : 2,
                width: 14, height: 14, borderRadius: "50%",
                background: draft.active ? "#fff" : "#64748b",
                transition: "left 0.2s",
              }} />
            </div>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>Account Active</span>
          </label>

          {/* Moderation status */}
          <div
            style={{
              border: "1px solid #1e2330",
              borderRadius: 8,
              padding: 12,
              background: "#0a0d13",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>
                Moderation status
              </span>
              <UserStatusBadge status={draft.status} />
            </div>
            <select
              value={draft.status || "clean"}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as User["status"] })}
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
            >
              <option value="clean">Clean</option>
              <option value="flagged">Flagged (review)</option>
              <option value="banned">Banned (block access)</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", paddingTop: 2 }}>
              <div
                onClick={() => setDraft({ ...draft, whitelisted: !draft.whitelisted })}
                style={{
                  width: 38,
                  height: 20,
                  borderRadius: 10,
                  background: draft.whitelisted ? "#1f4731" : "#1e2330",
                  border: `1px solid ${draft.whitelisted ? "#2d6b46" : "#2d3548"}`,
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: draft.whitelisted ? 18 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: draft.whitelisted ? "#6ee7b7" : "#64748b",
                    transition: "left 0.2s",
                  }}
                />
              </div>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>Whitelisted for abuse worker</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Ban Until</span>
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.bannedUntil)}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft({ ...draft, bannedUntil: value ? new Date(value).toISOString() : null });
                }}
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
              />
              <span style={{ color: "#64748b", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                Edit this to extend or shorten ban window.
              </span>
            </label>
            <input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Reason (e.g. abuse report #4521)"
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <input
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Internal note (optional)"
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>

          {/* Billing Date */}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Billing Date</span>
            <input
              type="datetime-local"
              value={toDateTimeLocalValue(draft.billingDate)}
              onChange={(e) => {
                const value = e.target.value;
                setDraft({ ...draft, billingDate: value ? new Date(value).toISOString() : null });
              }}
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
            />
          </label>

          {/* Expiration Date */}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Expiration Date</span>
            <input
              type="datetime-local"
              value={toDateTimeLocalValue(draft.expirationDate)}
              onChange={(e) => {
                const value = e.target.value;
                setDraft({ ...draft, expirationDate: value ? new Date(value).toISOString() : null });
              }}
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #2d3548", color: "#94a3b8",
              borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(user._id, {
                plan: draft.plan,
                active: draft.active,
                usage: draft.usage,
                limit: draft.limit,
                billingDate: draft.billingDate || null,
                expirationDate: draft.expirationDate || null,
                bannedUntil: draft.bannedUntil || null,
                status: draft.status,
                whitelisted: !!draft.whitelisted,
                statusReason: statusReason.trim() || undefined,
                statusNote: statusNote.trim() || undefined,
              });
              onClose();
            }}
            style={{
              background: "#059669", border: "none", color: "#fff",
              borderRadius: 6, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600,
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Email Composer Modal ────────────────────────────────────────────────────
function EmailComposerModal({
  mode,
  targetUser,
  audienceFilter,
  filteredCount,
  selectedUsers,
  subject,
  html,
  sending,
  onSubjectChange,
  onHtmlChange,
  onSend,
  onClose,
  showSensitiveInfo,
}: {
  mode: "single" | "all" | "manual";
  targetUser: User | null;
  audienceFilter: EmailAudienceFilter;
  filteredCount: number;
  selectedUsers: User[];
  subject: string;
  html: string;
  sending: boolean;
  onSubjectChange: (value: string) => void;
  onHtmlChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  showSensitiveInfo: boolean;
}) {
  const title = mode === "all"
    ? "Send Product Email to Audience"
    : mode === "manual"
      ? "Send Product Email to Selected Users"
      : "Send Product Email";
  const recipientText = mode === "all"
    ? `${getEmailAudienceLabel(audienceFilter)} (${filteredCount})`
    : mode === "manual"
      ? `${selectedUsers.length} selected user${selectedUsers.length === 1 ? "" : "s"}`
      : targetUser?.email ? displayEmail(targetUser.email, showSensitiveInfo) : "Selected user";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110,
        backdropFilter: "blur(4px)", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1117", border: "1px solid #1e2330",
          borderRadius: 12, padding: 24, width: "100%", maxWidth: 680,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, margin: 0 }}>{title}</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "5px 0 0", fontFamily: "'JetBrains Mono', monospace" }}>
              Recipient: {recipientText}
            </p>
            {mode === "manual" && selectedUsers.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  maxHeight: 120,
                  overflowY: "auto",
                  background: "#0a0d13",
                  border: "1px solid #1e2330",
                  borderRadius: 6,
                  padding: "6px 10px",
                }}
              >
                {selectedUsers.map((u) => (
                  <p
                    key={u._id}
                    style={{
                      color: "#cbd5e1",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      margin: "3px 0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {displayEmail(u.email, showSensitiveInfo)}
                    {u.name ? <span style={{ color: "#475569" }}>  ·  {u.name}</span> : null}
                  </p>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IconX />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Subject</span>
            <input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="New updates in RailKit"
              style={{
                background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0",
                borderRadius: 6, padding: "9px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Raw HTML</span>
            <textarea
              value={html}
              onChange={(e) => onHtmlChange(e.target.value)}
              rows={12}
              placeholder="<h1>Product Update</h1><p>Share your release notes here...</p>"
              style={{
                background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0",
                borderRadius: 6, padding: "11px 12px", fontSize: 12, resize: "vertical",
                fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5,
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
          <p style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
            HTML is sent as-is. Keep links and styles email-safe.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              style={{
                background: "none", border: "1px solid #2d3548", color: "#94a3b8",
                borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={sending}
              style={{
                background: sending ? "#1a1f2e" : "#059669", border: "none", color: sending ? "#64748b" : "#fff",
                borderRadius: 6, padding: "8px 18px", fontSize: 13, cursor: sending ? "not-allowed" : "pointer", fontWeight: 700,
              }}
            >
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateOrderModal({
  users,
  creating,
  onSubmit,
  onClose,
  showSensitiveInfo,
}: {
  users: User[];
  creating: boolean;
  onSubmit: (payload: ManualCreateOrderPayload) => Promise<void>;
  onClose: () => void;
  showSensitiveInfo: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [amount, setAmount] = useState("0");
  const [planType, setPlanType] = useState<"pro" | "advance">("pro");
  const [timestamp, setTimestamp] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const filteredUsers = users
    .filter((u) => u.email.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 8);
  const selectedUser = users.find((u) => u.email === selectedUserEmail) || null;

  const submit = async () => {
    const parsedAmount = Number(amount);
    if (!selectedUserEmail) {
      setError("Select a user email.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!transactionReference.trim()) {
      setError("Transaction reference is required.");
      return;
    }

    setError("");
    await onSubmit({
      email: selectedUserEmail,
      amount: parsedAmount,
      planType,
      timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
      transactionReference: transactionReference.trim(),
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120,
        backdropFilter: "blur(4px)", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1117", border: "1px solid #1e2330",
          borderRadius: 12, padding: 24, width: "100%", maxWidth: 680,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, margin: 0 }}>Create Manual Order</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "5px 0 0", fontFamily: "'JetBrains Mono', monospace" }}>
              Create paid/manual orders without changing order schema
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <IconX />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Search Email</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user email..."
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "9px 12px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
          </label>

          <div style={{ border: "1px solid #1e2330", borderRadius: 8, maxHeight: 180, overflowY: "auto", background: "#0a0d13" }}>
            {filteredUsers.length > 0 ? filteredUsers.map((u) => (
              <button
                type="button"
                key={u._id}
                onClick={() => setSelectedUserEmail(u.email)}
                style={{
                  width: "100%", textAlign: "left", background: selectedUserEmail === u.email ? "#1e2a3a" : "transparent",
                  border: "none", borderBottom: "1px solid #141820", color: selectedUserEmail === u.email ? "#93c5fd" : "#cbd5e1",
                  padding: "8px 10px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                }}
              >
                {displayEmail(u.email, showSensitiveInfo)}
              </button>
            )) : (
              <p style={{ color: "#475569", padding: "10px 12px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>No users found</p>
            )}
          </div>

          {selectedUser && (
            <p style={{ color: "#6ee7b7", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
              Selected: {displayEmail(selectedUser.email, showSensitiveInfo)}
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Amount</span>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "9px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Plan Type</span>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value as "pro" | "advance")}
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "9px 10px", fontSize: 12 }}
              >
                <option value="pro">pro</option>
                <option value="advance">advance</option>
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Transaction Reference</span>
              <input
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="UPI / bank reference number"
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "9px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Timestamp (optional)</span>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "9px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For internal reference"
              style={{ background: "#1a1f2e", border: "1px solid #2d3548", color: "#e2e8f0", borderRadius: 6, padding: "9px 10px", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            />
          </label>
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: 12, marginTop: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            style={{
              background: "none", border: "1px solid #2d3548", color: "#94a3b8",
              borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={creating}
            style={{
              background: creating ? "#1a1f2e" : "#0f2a1d", border: `1px solid ${creating ? "#2d3548" : "#1a4731"}`,
              color: creating ? "#64748b" : "#6ee7b7", borderRadius: 6, padding: "8px 16px", fontSize: 13,
              cursor: creating ? "not-allowed" : "pointer", fontWeight: 700,
            }}
          >
            {creating ? "Creating..." : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [isAdmin, setIsAdmin]       = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab]   = useState<"users" | "orders" | "unpaid" | "topups" | "issues" | "playground" | "logs">("users");
  const [logsTimelineDays, setLogsTimelineDays] = useState<14 | 30>(14);
  const [editingUser, setEditingUser]   = useState<User | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [clearingUnpaid, setClearingUnpaid] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailScope, setEmailScope] = useState<"single" | "all" | "manual">("single");
  const [emailAudienceFilter, setEmailAudienceFilter] = useState<EmailAudienceFilter>("all_users");
  const [emailTargetUser, setEmailTargetUser] = useState<User | null>(null);
  const [emailSelectedUserIds, setEmailSelectedUserIds] = useState<string[]>([]);
  const [manualSelectionMode, setManualSelectionMode] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailHtml, setEmailHtml] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [createOrderFeedback, setCreateOrderFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sendingReminderOrderId, setSendingReminderOrderId] = useState<string | null>(null);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [adminApiKey, setAdminApiKey] = useState<string | null>(null);
  const [playgroundAction, setPlaygroundAction] = useState<
    "pnr" | "train" | "track" | "history" | "station" | "search" | "availability" | "fare"
  >("pnr");
  const [playgroundInput, setPlaygroundInput] = useState({
    pnr: "",
    trainNumber: "",
    journeyDate: "",
    stationCode: "",
    stationHours: "2",
    fromStation: "",
    toStation: "",
    classCode: "SL",
    quota: "GN",
  });
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundError, setPlaygroundError] = useState("");
  const [playgroundStatus, setPlaygroundStatus] = useState<number | null>(null);
  const [playgroundDuration, setPlaygroundDuration] = useState<number | null>(null);
  const [playgroundResponse, setPlaygroundResponse] = useState("");

  // ── SWR hooks — only active once authenticated ──────────────────────────────
  const {
    data: usersData,
    isLoading: usersLoading,
    isValidating: usersValidating,
    mutate: mutateUsers,
  } = useSWR<{ success: boolean; users: User[] }>(
    isAdmin ? "/api/admin/users" : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 }
  );

  const {
    data: ordersData,
    isLoading: ordersLoading,
    isValidating: ordersValidating,
    mutate: mutateOrders,
  } = useSWR<{ success: boolean; orders: Order[] }>(
    isAdmin ? "/api/admin/orders" : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 }
  );

  const {
    data: topupsData,
    isLoading: topupsLoading,
    isValidating: topupsValidating,
    mutate: mutateTopups,
  } = useSWR<{ success: boolean; topups: Topup[] }>(
    isAdmin ? "/api/admin/topups" : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 }
  );

  const {
    data: issuesData,
    isLoading: issuesLoading,
    isValidating: issuesValidating,
    mutate: mutateIssues,
    error: issuesError,
  } = useSWR<{
    success: boolean;
    owner: string;
    repo: string;
    windowDays: number;
    newCount: number;
    updatedCount: number;
    issues: GithubIssue[];
  }>(
    isAdmin ? "/api/admin/issues" : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 }
  );

  const {
    data: logsData,
    isLoading: logsLoading,
    isValidating: logsValidating,
    mutate: mutateLogs,
  } = useSWR<LogsData>(
    isAdmin ? `/api/admin/logs?days=${logsTimelineDays}` : null,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 }
  );

  const users      = usersData?.users ?? [];
  const paidOrders = (ordersData?.orders ?? []).filter((o) => o.status === "paid");
  const unpaidOrders = (ordersData?.orders ?? []).filter((o) => o.status !== "paid");
  const topups = topupsData?.topups ?? [];
  const paidTopups = topups.filter((t) => t.status === "paid");
  const issues = issuesData?.issues ?? [];
  const auditDailyUsage = logsData?.logs?.dailyUsage ?? [];
  const recentLogs = logsData?.logs?.recent ?? [];
  const [recentIpLocations, setRecentIpLocations] = useState<Record<string, { city: string | null; country: string | null; status: string }>>({});
  const [recentIpLocationsLoading, setRecentIpLocationsLoading] = useState(false);
  const filteredEmailUsers = users.filter((user) => matchesEmailAudienceFilter(user, emailAudienceFilter));
  const dataLoading = usersValidating || ordersValidating || topupsValidating || issuesValidating || logsValidating;
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = filteredEmailUsers.filter((user) => {
    if (!normalizedUserSearch) return true;
    const haystack = `${user.name || ""} ${user.email || ""}`.toLowerCase();
    return haystack.includes(normalizedUserSearch);
  });

  const loadAdminSession = async () => {
    try {
      const res = await fetch("/api/admin/verify");
      if (!res.ok) {
        setIsAdmin(false);
        setAdminApiKey(null);
        return;
      }
      const data = await res.json();
      setIsAdmin(true);
      setAdminApiKey(data.user?.apiKey ?? null);
    } catch (error) {
      console.error(error);
      setIsAdmin(false);
      setAdminApiKey(null);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setRecentIpLocations({});
      return;
    }

    const ips = Array.from(new Set(recentLogs.map((log) => String(log.ip || "").trim()).filter(Boolean))).slice(0, 100);
    if (ips.length === 0) {
      setRecentIpLocations({});
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setRecentIpLocationsLoading(true);

    void fetch("/api/admin/ip-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ips }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Location lookup failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data?.success || !data?.locations || typeof data.locations !== "object") {
          return;
        }
        setRecentIpLocations(data.locations);
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "AbortError") {
          console.error("Admin IP location lookup failed:", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRecentIpLocationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAdmin, recentLogs]);

  // ── Check session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await loadAdminSession();
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const totalRequests = auditDailyUsage.reduce((sum, entry) => sum + entry.requests, 0);
  const avgRequestsPerDay = auditDailyUsage.length > 0 
    ? Math.round(totalRequests / auditDailyUsage.length) 
    : 0;

  const onGoogleLogin = async () => {
    setLoginError("");
    setAuthLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const email = credential.user.email?.trim().toLowerCase();
      const name  = credential.user.displayName?.trim();
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Admin login failed");
      await loadAdminSession();
      // SWR keys become non-null now — data fetches automatically
    } catch (err: unknown) {
      setLoginError(getErrorMessage(err, "Login failed"));
    } finally { setAuthLoading(false); }
  };

  const resetPlaygroundMeta = () => {
    setPlaygroundError("");
    setPlaygroundStatus(null);
    setPlaygroundDuration(null);
    setPlaygroundResponse("");
  };

  const runPlayground = async () => {
    if (!adminApiKey) {
      setPlaygroundError("Admin API key not found. Re-login to refresh it.");
      return;
    }

    setPlaygroundLoading(true);
    resetPlaygroundMeta();
    const start = performance.now();

    try {
      configure(adminApiKey);
      let result: unknown;

      switch (playgroundAction) {
        case "pnr":
          if (!/^\d{10}$/.test(playgroundInput.pnr)) {
            throw new Error("PNR must be exactly 10 digits");
          }
          result = await checkPNRStatus(playgroundInput.pnr);
          break;
        case "train":
          if (!/^\d{5}$/.test(playgroundInput.trainNumber)) {
            throw new Error("Train number must be exactly 5 digits");
          }
          result = await getTrainInfo(playgroundInput.trainNumber);
          break;
        case "track":
          if (!/^\d{5}$/.test(playgroundInput.trainNumber)) {
            throw new Error("Train number must be exactly 5 digits");
          }
          if (!/^\d{2}-\d{2}-\d{4}$/.test(playgroundInput.journeyDate)) {
            throw new Error("Date must be in DD-MM-YYYY format");
          }
          result = await trackTrain(playgroundInput.trainNumber, playgroundInput.journeyDate);
          break;
        case "history":
          if (!/^\d{5}$/.test(playgroundInput.trainNumber)) {
            throw new Error("Train number must be exactly 5 digits");
          }
          if (!/^\d{2}-\d{2}-\d{4}$/.test(playgroundInput.journeyDate)) {
            throw new Error("Date must be in DD-MM-YYYY format");
          }
          result = await getTrainHistory(playgroundInput.trainNumber, playgroundInput.journeyDate);
          break;
        case "station":
          if (!playgroundInput.stationCode.trim()) {
            throw new Error("Station code is required");
          }
          {
            const hours = Number(playgroundInput.stationHours);
            if (![2, 4, 8].includes(hours)) {
              throw new Error("Hours must be 2, 4, or 8");
            }
            result = await liveAtStation(
              playgroundInput.stationCode.trim().toUpperCase(),
              hours as 2 | 4 | 8
            );
          }
          break;
        case "search":
          if (!playgroundInput.fromStation.trim() || !playgroundInput.toStation.trim()) {
            throw new Error("From and To station codes are required");
          }
          if (playgroundInput.journeyDate && !/^\d{2}-\d{2}-\d{4}$/.test(playgroundInput.journeyDate)) {
            throw new Error("Date must be in DD-MM-YYYY format");
          }
          result = await searchTrainBetweenStations(
            playgroundInput.fromStation.trim().toUpperCase(),
            playgroundInput.toStation.trim().toUpperCase(),
            playgroundInput.journeyDate || undefined
          );
          break;
        case "availability":
          if (!/^\d{5}$/.test(playgroundInput.trainNumber)) {
            throw new Error("Train number must be exactly 5 digits");
          }
          if (!playgroundInput.fromStation.trim() || !playgroundInput.toStation.trim()) {
            throw new Error("From and To station codes are required");
          }
          if (!/^\d{2}-\d{2}-\d{4}$/.test(playgroundInput.journeyDate)) {
            throw new Error("Date must be in DD-MM-YYYY format");
          }
          result = await getAvailability(
            playgroundInput.trainNumber,
            playgroundInput.fromStation.trim().toUpperCase(),
            playgroundInput.toStation.trim().toUpperCase(),
            playgroundInput.journeyDate,
            playgroundInput.classCode,
            playgroundInput.quota,
          );
          break;
        case "fare":
          if (!/^\d{5}$/.test(playgroundInput.trainNumber)) {
            throw new Error("Train number must be exactly 5 digits");
          }
          if (!playgroundInput.fromStation.trim() || !playgroundInput.toStation.trim()) {
            throw new Error("From and To station codes are required");
          }
          if (!/^\d{2}-\d{2}-\d{4}$/.test(playgroundInput.journeyDate)) {
            throw new Error("Date must be in DD-MM-YYYY format");
          }
          result = await fareLookup(
            playgroundInput.trainNumber,
            playgroundInput.fromStation.trim().toUpperCase(),
            playgroundInput.toStation.trim().toUpperCase(),
            playgroundInput.journeyDate,
            playgroundInput.classCode,
            playgroundInput.quota,
          );
          break;
      }

      const codeGuess =
        typeof result === "object" &&
        result !== null &&
        "statusCode" in result &&
        typeof (result as { statusCode?: unknown }).statusCode === "number"
          ? ((result as { statusCode: number }).statusCode ?? 200)
          : 200;
      setPlaygroundStatus(codeGuess);
      setPlaygroundResponse(JSON.stringify(result, null, 2) || "{}");
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number; response?: { status?: number } };
      setPlaygroundError(err?.message || "Something went wrong");
      setPlaygroundStatus(err?.status || err?.response?.status || 500);
      setPlaygroundResponse(
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
      setPlaygroundDuration(Math.round(performance.now() - start));
      setPlaygroundLoading(false);
    }
  };

  // Optimistic update: patch cache instantly, revalidate after PUT
  const updateUser = async (id: string, updates: Partial<User> & { statusReason?: string; statusNote?: string }) => {
    // Optimistically update local cache. We don't echo statusReason/statusNote back since
    // they are one-shot payload fields, not part of the User model.
    const { statusReason: _sr, statusNote: _sn, ...patch } = updates;
    await mutateUsers(
      (prev) => prev
        ? { ...prev, users: prev.users.map((u) => u._id === id ? { ...u, ...patch } : u) }
        : prev,
      false
    );
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id, ...patch, statusReason: _sr, statusNote: _sn }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch (e) {
      console.error(e);
    } finally {
      // Revalidate to sync with server truth
      mutateUsers();
    }
  };

  const refreshAll = () => { mutateUsers(); mutateOrders(); mutateTopups(); mutateIssues(); mutateLogs(); };

  const clearAllUnpaidOrders = async () => {
    if (unpaidOrders.length === 0 || clearingUnpaid) return;

    const confirmed = window.confirm(
      `Delete ${unpaidOrders.length} unpaid order(s) older than 24 hours?`
    );
    if (!confirmed) return;

    setClearingUnpaid(true);
    try {
      const res = await fetch("/api/admin/remove-unpaid", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to clear unpaid orders");
      }
      await mutateOrders();
      window.alert(`Removed ${data.deletedCount ?? 0} unpaid order(s).`);
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Failed to clear unpaid orders"));
    } finally {
      setClearingUnpaid(false);
    }
  };

  const openEmailComposer = (scope: "single" | "all" | "manual", user?: User) => {
    setEmailScope(scope);
    setEmailTargetUser(scope === "single" ? (user || null) : null);
    setEmailSubject("");
    setEmailHtml("");
    setEmailComposerOpen(true);
  };

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailHtml.trim()) {
      setEmailFeedback({ type: "error", message: "Subject and raw HTML are required." });
      return;
    }

    if (emailScope === "single" && !emailTargetUser?._id) {
      setEmailFeedback({ type: "error", message: "No user selected for individual email." });
      return;
    }

    if (emailScope === "all" && filteredEmailUsers.length === 0) {
      setEmailFeedback({ type: "error", message: "No users match the selected filter." });
      return;
    }

    if (emailScope === "manual" && emailSelectedUserIds.length === 0) {
      setEmailFeedback({ type: "error", message: "Select at least one user to email." });
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: emailScope,
          userId: emailScope === "single" ? emailTargetUser?._id : undefined,
          userIds: emailScope === "manual" ? emailSelectedUserIds : undefined,
          filter: emailScope === "all" ? emailAudienceFilter : undefined,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send email");
      }

      setEmailFeedback({ type: "success", message: data.message || "Email sent successfully." });
      if (emailScope === "manual") {
        setEmailSelectedUserIds([]);
      }
      setEmailComposerOpen(false);
    } catch (error: unknown) {
      setEmailFeedback({ type: "error", message: getErrorMessage(error, "Failed to send email.") });
    } finally {
      setSendingEmail(false);
    }
  };

  const createManualOrder = async (payload: ManualCreateOrderPayload) => {
    if (creatingOrder) return;

    setCreatingOrder(true);
    setCreateOrderFeedback(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          planType: payload.planType,
          amount: payload.amount,
          timestamp: payload.timestamp,
          transactionReference: payload.transactionReference,
          note: payload.note,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to create order");
      }

      await mutateOrders();
      setCreateOrderOpen(false);
      setCreateOrderFeedback({ type: "success", message: "Manual order created successfully." });
    } catch (error: unknown) {
      setCreateOrderFeedback({ type: "error", message: getErrorMessage(error, "Failed to create order.") });
    } finally {
      setCreatingOrder(false);
    }
  };

  const sendReminder = async (email: string, orderId: string) => {
    setSendingReminderOrderId(orderId);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "reminder", email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to send reminder");
      }
      window.alert(`Reminder sent to ${email}`);
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Failed to send reminder"));
    } finally {
      setSendingReminderOrderId(null);
    }
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (authLoading) return <Loader text="Authenticating..." />;
  if (isAdmin && (usersLoading || ordersLoading || topupsLoading || issuesLoading || logsLoading)) return <Loader text="Fetching data..." />;

  // ── Login screen ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@700;800&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #070910; }
        `}</style>
        <main style={{
          minHeight: "100vh", background: "#070910",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Syne', sans-serif",
        }}>
          {/* Ambient glow */}
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(52,211,153,0.06) 0%, transparent 70%)", borderRadius: "50%" }} />
          </div>

          <div style={{
            width: "100%", maxWidth: 380, position: "relative",
            background: "linear-gradient(145deg, #0f1117 0%, #0a0d13 100%)",
            border: "1px solid #1e2330", borderRadius: 16, padding: 40,
            boxShadow: "0 0 0 1px #0d1117, 0 32px 64px rgba(0,0,0,0.6)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "linear-gradient(135deg, #059669, #047857)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(5,150,105,0.3)",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Admin Portal</h1>
              <p style={{ color: "#475569", fontSize: 13, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>Restricted access only</p>
            </div>

            {loginError && (
              <div style={{ background: "#2a0f0f", border: "1px solid #4a1f1f", borderRadius: 8, padding: "10px 14px", marginBottom: 20 }}>
                <p style={{ color: "#f87171", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>{loginError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={onGoogleLogin}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                background: "#f8fafc", border: "none", borderRadius: 8,
                padding: "11px 16px", cursor: "pointer", fontFamily: "'Syne', sans-serif",
                fontSize: 14, fontWeight: 700, color: "#0f172a",
                transition: "transform 0.1s, box-shadow 0.2s",
                boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
            >
              <IconGoogle />
              Continue with Google
            </button>
          </div>
        </main>
      </>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  const totalRevenue  = paidOrders.reduce((acc, o) => acc + o.amount, 0)
    + paidTopups.reduce((acc, t) => acc + t.amount, 0);
  const maxDailyRequests = Math.max(1, ...auditDailyUsage.map((entry) => entry.requests));
  const chartData = auditDailyUsage.map((entry) => ({
    ...entry,
    label: new Date(entry.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    }),
  }));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070910; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #2d3548; border-radius: 3px; }
        .row-hover:hover { background: rgba(255,255,255,0.02) !important; }
        .action-btn:hover { background: #2d3548 !important; color: #e2e8f0 !important; }
        .tab-btn { transition: all 0.2s; }
      `}</style>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onSave={updateUser}
          onClose={() => setEditingUser(null)}
          showSensitiveInfo={showSensitiveInfo}
        />
      )}
      {viewingOrder && (
        <OrderModal order={viewingOrder} onClose={() => setViewingOrder(null)} />
      )}
      {emailComposerOpen && (
        <EmailComposerModal
          mode={emailScope}
          targetUser={emailTargetUser}
          audienceFilter={emailAudienceFilter}
          filteredCount={filteredEmailUsers.length}
          selectedUsers={users.filter((u) => emailSelectedUserIds.includes(u._id))}
          subject={emailSubject}
          html={emailHtml}
          sending={sendingEmail}
          onSubjectChange={setEmailSubject}
          onHtmlChange={setEmailHtml}
          onSend={sendEmail}
          onClose={() => setEmailComposerOpen(false)}
          showSensitiveInfo={showSensitiveInfo}
        />
      )}
      {createOrderOpen && (
        <CreateOrderModal
          users={users}
          creating={creatingOrder}
          onSubmit={createManualOrder}
          onClose={() => setCreateOrderOpen(false)}
          showSensitiveInfo={showSensitiveInfo}
        />
      )}

      <main style={{ minHeight: "100vh", background: "#070910", fontFamily: "'Syne', sans-serif", color: "#e2e8f0" }}>
        {/* Header */}
        <header style={{
          borderBottom: "1px solid #1e2330",
          background: "rgba(7,9,16,0.95)",
          backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 50,
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #059669, #047857)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: "#f1f5f9" }}>Admin</span>
              <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#334155", padding: "1px 6px", background: "#1e2330", borderRadius: 4 }}>CONSOLE</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {dataLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", animation: "ping 1s infinite" }} />
                  <span style={{ color: "#64748b", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>Syncing</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowSensitiveInfo((prev) => !prev)}
                style={{
                  background: showSensitiveInfo ? "#2a1f0f" : "#0f2a1d",
                  border: `1px solid ${showSensitiveInfo ? "#4a3a1f" : "#1a4731"}`,
                  color: showSensitiveInfo ? "#fb923c" : "#6ee7b7",
                  borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {showSensitiveInfo ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                onClick={refreshAll}
                style={{
                  background: "#1a1f2e", border: "1px solid #2d3548", color: "#94a3b8",
                  borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px" }}>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
              { label: "Total Users", value: users.length, sub: `${users.filter((u) => u.active).length} active`, color: "#6ee7b7" },
              { label: "Pro / Enterprise", value: users.filter((u) => u.plan !== "free").length, sub: "paid plans", color: "#a78bfa" },
              { label: "Avg Requests/Day", value: avgRequestsPerDay.toLocaleString("en-IN"), sub: `last ${logsTimelineDays} days`, color: "#60a5fa" },
              { label: "Total Revenue", value: showSensitiveInfo ? `₹${(totalRevenue).toFixed(0)}` : "*****", sub: "orders + topups", color: "#fbbf24" },
            ].map((s) => (
              <div key={s.label} style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 10, padding: "18px 20px" }}>
                <p style={{ color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 26, fontFamily: "'JetBrains Mono', monospace" ,fontWeight: 800, color: s.color, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.value}</p>
                <p style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0f1117", border: "1px solid #1e2330", borderRadius: 8, padding: 4, width: "fit-content" }}>
            {(["users", "orders", "unpaid", "topups", "logs", "issues", "playground"] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                className="tab-btn"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? "#1e2a3a" : "none",
                  border: activeTab === tab ? "1px solid #2d4060" : "1px solid transparent",
                  color: activeTab === tab ? "#60a5fa" : "#64748b",
                  borderRadius: 6, padding: "6px 18px", fontSize: 13,
                  cursor: "pointer", fontWeight: 700, letterSpacing: "0.02em",
                  textTransform: "capitalize",
                }}
              >
                {tab === "users"
                  ? `Users (${filteredUsers.length})`
                  : tab === "orders"
                  ? `Paid Orders (${paidOrders.length})`
                  : tab === "unpaid"
                  ? `Unpaid Orders (${unpaidOrders.length})`
                  : tab === "topups"
                  ? `Topups (${topups.length})`
                  : tab === "logs"
                  ? `Logs${recentLogs.length ? ` (${recentLogs.length > 99 ? "99+" : recentLogs.length})` : ""}`
                  : tab === "issues"
                  ? `Issues (${issues.length})`
                  : "Playground"}
              </button>
            ))}
          </div>

          {activeTab === "users" && emailFeedback && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 8,
                background: emailFeedback.type === "success" ? "#0f2a1d" : "#2a0f0f",
                border: `1px solid ${emailFeedback.type === "success" ? "#1a4731" : "#4a1f1f"}`,
              }}
            >
              <p style={{ color: emailFeedback.type === "success" ? "#6ee7b7" : "#f87171", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {emailFeedback.message}
              </p>
            </div>
          )}

          {activeTab === "orders" && createOrderFeedback && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 8,
                background: createOrderFeedback.type === "success" ? "#0f2a1d" : "#2a0f0f",
                border: `1px solid ${createOrderFeedback.type === "success" ? "#1a4731" : "#4a1f1f"}`,
              }}
            >
              <p style={{ color: createOrderFeedback.type === "success" ? "#6ee7b7" : "#f87171", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {createOrderFeedback.message}
              </p>
            </div>
          )}

          {activeTab === "issues" && issuesError && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 8,
                background: "#2a0f0f",
                border: "1px solid #4a1f1f",
              }}
            >
              <p style={{ color: "#f87171", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {getErrorMessage(issuesError, "Failed to fetch GitHub issues")}
              </p>
            </div>
          )}

          {/* Users Table */}
          {activeTab === "users" && (
            <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, overflow: "hidden" }}>
              {/* Unified toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #1e2330",
                  background: "#0a0d13",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !manualSelectionMode;
                      setManualSelectionMode(next);
                      if (next) {
                        const visibleIds = filteredUsers.map((u) => u._id);
                        setEmailSelectedUserIds(visibleIds);
                      } else {
                        setEmailSelectedUserIds([]);
                      }
                    }}
                    title={manualSelectionMode ? "Exit manual selection mode" : "Pick specific users to email"}
                    style={{
                      background: manualSelectionMode ? "#1f4731" : "#1a1f2e",
                      border: `1px solid ${manualSelectionMode ? "#2d6b46" : "#2d3548"}`,
                      color: manualSelectionMode ? "#6ee7b7" : "#94a3b8",
                      borderRadius: 6,
                      padding: "7px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: manualSelectionMode ? "#34d399" : "#475569",
                        boxShadow: manualSelectionMode ? "0 0 6px #34d399" : "none",
                      }}
                    />
                    {manualSelectionMode ? "Selection ON" : "Select"}
                  </button>
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name or email"
                    style={{
                      background: "#1a1f2e",
                      border: "1px solid #2d3548",
                      color: "#e2e8f0",
                      borderRadius: 6,
                      padding: "7px 10px",
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      minWidth: 220,
                    }}
                  />
                  {!manualSelectionMode && (
                    <select
                      value={emailAudienceFilter}
                      onChange={(e) => setEmailAudienceFilter(e.target.value as EmailAudienceFilter)}
                      style={{
                        background: "#1a1f2e",
                        border: "1px solid #2d3548",
                        color: "#e2e8f0",
                        borderRadius: 6,
                        padding: "7px 10px",
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {EMAIL_AUDIENCE_FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {manualSelectionMode && emailSelectedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEmailSelectedUserIds([])}
                      title="Clear current selection"
                      style={{
                        background: "none",
                        border: "1px solid #2d3548",
                        color: "#94a3b8",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Clear ({emailSelectedUserIds.length})
                    </button>
                  )}
                  <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                    {manualSelectionMode
                      ? `${emailSelectedUserIds.length} selected of ${filteredUsers.length}`
                      : `${filteredUsers.length} of ${users.length}`}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {manualSelectionMode ? (
                    <button
                      type="button"
                      onClick={() => openEmailComposer("manual")}
                      disabled={emailSelectedUserIds.length === 0}
                      title={emailSelectedUserIds.length === 0 ? "Select at least one user" : "Compose email to selected users"}
                      style={{
                        background: emailSelectedUserIds.length === 0 ? "#1a1f2e" : "#102a1d",
                        border: `1px solid ${emailSelectedUserIds.length === 0 ? "#2d3548" : "#1f4731"}`,
                        color: emailSelectedUserIds.length === 0 ? "#64748b" : "#6ee7b7",
                        borderRadius: 6, padding: "6px 12px", fontSize: 12,
                        cursor: emailSelectedUserIds.length === 0 ? "not-allowed" : "pointer",
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Send to selected ({emailSelectedUserIds.length})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEmailComposer("all")}
                      disabled={filteredUsers.length === 0}
                      style={{
                        background: filteredUsers.length === 0 ? "#1a1f2e" : "#0f2233",
                        border: `1px solid ${filteredUsers.length === 0 ? "#2d3548" : "#1a3a5c"}`,
                        color: filteredUsers.length === 0 ? "#64748b" : "#60a5fa",
                        borderRadius: 6, padding: "6px 12px", fontSize: 12,
                        cursor: filteredUsers.length === 0 ? "not-allowed" : "pointer",
                        fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Send to {getEmailAudienceLabel(emailAudienceFilter)} ({filteredUsers.length})
                    </button>
                  )}
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0a0d13", borderBottom: "1px solid #1e2330" }}>
                      {manualSelectionMode && (
                        <th style={{ padding: "12px 16px", textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
                          <input
                            type="checkbox"
                            checked={filteredUsers.length > 0 && filteredUsers.every((u) => emailSelectedUserIds.includes(u._id))}
                            ref={(el) => {
                              if (el) {
                                const allSelected = filteredUsers.length > 0 && filteredUsers.every((u) => emailSelectedUserIds.includes(u._id));
                                const someSelected = filteredUsers.some((u) => emailSelectedUserIds.includes(u._id));
                                el.indeterminate = !allSelected && someSelected;
                              }
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const merged = new Set([...emailSelectedUserIds, ...filteredUsers.map((u) => u._id)]);
                                setEmailSelectedUserIds(Array.from(merged));
                              } else {
                                const visibleIds = new Set(filteredUsers.map((u) => u._id));
                                setEmailSelectedUserIds(emailSelectedUserIds.filter((id) => !visibleIds.has(id)));
                              }
                            }}
                            style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#60a5fa" }}
                            title="Select all visible users"
                          />
                        </th>
                      )}
                      {["User", "Plan", "Status", "Status (Moderation)", "Usage", "Billing Left", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isSelected = manualSelectionMode && emailSelectedUserIds.includes(u._id);
                      return (
                      <tr
                        key={u._id}
                        className="row-hover"
                        style={{
                          borderBottom: "1px solid #141820",
                          transition: "background 0.15s",
                          background: isSelected ? "#101a2c" : "transparent",
                        }}
                      >
                        {manualSelectionMode && (
                          <td style={{ padding: "14px 16px" }}>
                            <input
                              type="checkbox"
                              checked={emailSelectedUserIds.includes(u._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEmailSelectedUserIds((prev) => prev.includes(u._id) ? prev : [...prev, u._id]);
                                } else {
                                  setEmailSelectedUserIds((prev) => prev.filter((id) => id !== u._id));
                                }
                              }}
                              style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#60a5fa" }}
                              title={`Select ${u.email}`}
                            />
                          </td>
                        )}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: `hsl(${u.email.charCodeAt(0) * 7 % 360}, 60%, 20%)`,
                              border: `1px solid hsl(${u.email.charCodeAt(0) * 7 % 360}, 60%, 30%)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 13, fontWeight: 700, color: `hsl(${u.email.charCodeAt(0) * 7 % 360}, 70%, 65%)`,
                              flexShrink: 0,
                            }}>
                              {(u.name || u.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{u.name || "—"}</p>
                              <p style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                                {displayEmail(u.email, showSensitiveInfo)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}><PlanBadge plan={u.plan} /></td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                              <UserStatusBadge status={u.status} />
                              {u.whitelisted && (
                                <MiniBadge
                                  label="Whitelisted"
                                  bg="#102a1d"
                                  border="#1f4731"
                                  color="#6ee7b7"
                                />
                              )}
                            </div>
                            {u.status === "banned" && u.bannedAt && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ color: "#475569", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                                  Banned {new Date(u.bannedAt).toLocaleDateString("en-IN")}
                                </span>
                                <span style={{ color: "#64748b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                                  {u.bannedUntil
                                    ? `Until ${formatCompactDate(u.bannedUntil)}`
                                    : "No ban expiry set"}
                                </span>
                              </div>
                            )}
                            {u.status === "flagged" && u.flaggedAt && (
                              <span style={{ color: "#475569", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                                {new Date(u.flaggedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.active ? "#34d399" : "#64748b", flexShrink: 0 }} />
                            <span style={{ color: u.active ? "#6ee7b7" : "#64748b" }}>{u.active ? "Active" : "Inactive"}</span>
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                              <span style={{ color: "#94a3b8" }}>{u.usage || 0}</span>
                              <span style={{ color: "#334155" }}>/ {u.limit || 0}</span>
                            </div>
                            <div style={{ height: 3, background: "#1e2330", borderRadius: 2, width: 100, overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 2, background: u.limit && u.usage / u.limit > 0.8 ? "#f97316" : "#34d399", width: `${Math.min(100, u.limit ? (u.usage / u.limit) * 100 : 0)}%`, transition: "width 0.3s" }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <BillingTimer user={u} />
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => setEditingUser(u)}
                              title="Edit user"
                              style={{
                                background: "#1a1f2e", border: "1px solid #2d3548",
                                color: "#64748b", borderRadius: 6, padding: "6px 10px",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                                fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                              }}
                            >
                              <IconEdit />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => openEmailComposer("single", u)}
                              title="Send email"
                              style={{
                                background: "#0f2233", border: "1px solid #1a3a5c",
                                color: "#60a5fa", borderRadius: 6, padding: "6px 10px",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                                fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                              </svg>
                              <span>Email</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={manualSelectionMode ? 8 : 7} style={{ padding: 40, textAlign: "center", color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orders Table */}
          {activeTab === "orders" && (
            <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #1e2330",
                  background: "#0a0d13",
                  gap: 12,
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  Paid orders created through website and manual entries
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOrderFeedback(null);
                    setCreateOrderOpen(true);
                  }}
                  style={{
                    background: "#0f2a1d",
                    border: "1px solid #1a4731",
                    color: "#6ee7b7",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                  }}
                >
                  Create Order
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0a0d13", borderBottom: "1px solid #1e2330" }}>
                      {["Order ID", "User", "Amount", "Status", "Credited", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paidOrders.map((o) => (
                      <tr key={o._id} className="row-hover" style={{ borderBottom: "1px solid #141820", transition: "background 0.15s" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8", fontSize: 11 }}>{o.orderId}</span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#cbd5e1", fontSize: 13 }}>
                          {o.userId?.email ? displayEmail(o.userId.email, showSensitiveInfo) : <span style={{ color: "#334155" }}>N/A</span>}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ color: "#6ee7b7", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13 }}>
                            ₹{(o.amount ).toFixed(2)}
                          </span>
                          <span style={{ color: "#334155", fontSize: 11, marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>{o.currency}</span>
                        </td>
                        <td style={{ padding: "14px 16px" }}><StatusBadge status={o.status} /></td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            {o.credited
                              ? <><span style={{ color: "#34d399" }}><IconCheck /></span><span style={{ color: "#6ee7b7" }}>Yes</span></>
                              : <><span style={{ color: "#64748b" }}><IconX /></span><span style={{ color: "#64748b" }}>No</span></>
                            }
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => setViewingOrder(o)}
                            style={{
                              background: "#1a1f2e", border: "1px solid #2d3548",
                              color: "#64748b", borderRadius: 6, padding: "6px 10px",
                              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                              transition: "background 0.15s, color 0.15s, border-color 0.15s",
                            }}
                          >
                            <IconEye />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {paidOrders.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No paid orders found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unpaid Orders Table */}
          {activeTab === "unpaid" && (
            <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #1e2330",
                  background: "#0a0d13",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  All unpaid orders (not paid)
                </span>
                <button
                  type="button"
                  onClick={clearAllUnpaidOrders}
                  disabled={clearingUnpaid || unpaidOrders.length === 0}
                  style={{
                    background: clearingUnpaid || unpaidOrders.length === 0 ? "#1a1f2e" : "#2a0f0f",
                    border: `1px solid ${clearingUnpaid || unpaidOrders.length === 0 ? "#2d3548" : "#4a1f1f"}`,
                    color: clearingUnpaid || unpaidOrders.length === 0 ? "#64748b" : "#f87171",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: clearingUnpaid || unpaidOrders.length === 0 ? "not-allowed" : "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="Delete unpaid orders older than 1 hour"
                >
                  {clearingUnpaid ? "Clearing..." : "Clear Unpaid > 1h"}
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0a0d13", borderBottom: "1px solid #1e2330" }}>
                      {["Order ID", "User", "Amount", "Status", "Credited", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidOrders.map((o) => (
                      <tr key={o._id} className="row-hover" style={{ borderBottom: "1px solid #141820", transition: "background 0.15s" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8", fontSize: 11 }}>{o.orderId}</span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#cbd5e1", fontSize: 13 }}>
                          {o.userId?.email ? displayEmail(o.userId.email, showSensitiveInfo) : <span style={{ color: "#334155" }}>N/A</span>}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ color: "#6ee7b7", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13 }}>
                            ₹{(o.amount ).toFixed(2)}
                          </span>
                          <span style={{ color: "#334155", fontSize: 11, marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>{o.currency}</span>
                        </td>
                        <td style={{ padding: "14px 16px" }}><StatusBadge status={o.status} /></td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            {o.credited
                              ? <><span style={{ color: "#34d399" }}><IconCheck /></span><span style={{ color: "#6ee7b7" }}>Yes</span></>
                              : <><span style={{ color: "#64748b" }}><IconX /></span><span style={{ color: "#64748b" }}>No</span></>
                            }
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => setViewingOrder(o)}
                              style={{
                                background: "#1a1f2e", border: "1px solid #2d3548",
                                color: "#64748b", borderRadius: 6, padding: "6px 10px",
                                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                                fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                              }}
                            >
                              <IconEye />
                              <span>View</span>
                            </button>
                            {o.userId?.email && (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => sendReminder(o.userId!.email, o._id)}
                                disabled={sendingReminderOrderId === o._id}
                                title="Send checkout reminder"
                                style={{
                                  background: sendingReminderOrderId === o._id ? "#1a1f2e" : "#2a1f0f",
                                  border: `1px solid ${sendingReminderOrderId === o._id ? "#2d3548" : "#4a3a1f"}`,
                                  color: sendingReminderOrderId === o._id ? "#64748b" : "#fb923c",
                                  borderRadius: 6, padding: "6px 10px",
                                  cursor: sendingReminderOrderId === o._id ? "not-allowed" : "pointer",
                                  display: "flex", alignItems: "center", gap: 5,
                                  fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                  <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                <span>{sendingReminderOrderId === o._id ? "Sending..." : "Remind"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {unpaidOrders.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No unpaid orders found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Topups Table */}
          {activeTab === "topups" && (
            <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #1e2330",
                  background: "#0a0d13",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  Paid limit topups
                </span>
                <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  Total: {showSensitiveInfo ? `₹${paidTopups.reduce((sum, t) => sum + t.amount, 0).toFixed(0)}` : "*****"}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0a0d13", borderBottom: "1px solid #1e2330" }}>
                      {["Order ID", "User", "Amount", "Extra Limit", "Status", "Credited", "Date"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "12px 16px",
                            textAlign: "left",
                            color: "#475569",
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topups.map((t) => (
                      <tr key={t._id} className="row-hover" style={{ borderBottom: "1px solid #141820", transition: "background 0.15s" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8", fontSize: 11 }}>{t.orderId}</span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#cbd5e1", fontSize: 13 }}>
                          {t.userId?.email ? displayEmail(t.userId.email, showSensitiveInfo) : <span style={{ color: "#334155" }}>N/A</span>}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ color: "#6ee7b7", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13 }}>
                            ₹{t.amount.toFixed(2)}
                          </span>
                          <span style={{ color: "#334155", fontSize: 11, marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>{t.currency}</span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#93c5fd", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {t.extraLimit.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "14px 16px" }}><StatusBadge status={t.status} /></td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            {t.credited
                              ? <><span style={{ color: "#34d399" }}><IconCheck /></span><span style={{ color: "#6ee7b7" }}>Yes</span></>
                              : <><span style={{ color: "#64748b" }}><IconX /></span><span style={{ color: "#64748b" }}>No</span></>
                            }
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ color: "#64748b", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {topups.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No topups found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  background: "#0f1117",
                  border: "1px solid #1e2330",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700 }}>
                    API Requests Per Day
                  </p>
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Last {logsTimelineDays} days
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      border: "1px solid #243042",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {([14, 30] as const).map((days) => (
                      <button
                        type="button"
                        key={days}
                        onClick={() => setLogsTimelineDays(days)}
                        style={{
                          background: logsTimelineDays === days ? "#1f3048" : "#0a0d13",
                          color: logsTimelineDays === days ? "#93c5fd" : "#64748b",
                          border: "none",
                          borderRight: days === 14 ? "1px solid #243042" : "none",
                          padding: "6px 12px",
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: "pointer",
                        }}
                      >
                        {days}D
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    background: "#0a0d13",
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: 10,
                    height: 260,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 12, right: 16, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="auditAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={{ stroke: "#1f2937" }}
                        tickLine={{ stroke: "#1f2937" }}
                        minTickGap={18}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        axisLine={{ stroke: "#1f2937" }}
                        tickLine={{ stroke: "#1f2937" }}
                      />
                      <Tooltip
                        cursor={{ stroke: "#334155", strokeWidth: 1 }}
                        contentStyle={{
                          background: "#0b1220",
                          border: "1px solid #1e293b",
                          borderRadius: 8,
                          color: "#cbd5e1",
                          fontSize: 12,
                        }}
                        formatter={(value) => {
                          const numericValue =
                            typeof value === "number" ? value : Number(value ?? 0);
                          return [`${numericValue} requests`, "Usage"];
                        }}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="requests"
                        stroke="none"
                        fill="url(#auditAreaFill)"
                      />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={{ r: 3, stroke: "#0a0d13", strokeWidth: 1, fill: "#7dd3fc" }}
                        activeDot={{ r: 5, fill: "#e0f2fe", stroke: "#38bdf8", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    color: "#475569",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <span>
                    Start:{" "}
                    {auditDailyUsage[0]
                      ? new Date(auditDailyUsage[0].date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })
                      : "-"}
                  </span>
                  <span>Peak: {maxDailyRequests} req/day</span>
                  <span>
                    End:{" "}
                    {auditDailyUsage[auditDailyUsage.length - 1]
                      ? new Date(
                        auditDailyUsage[auditDailyUsage.length - 1].date
                      ).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })
                      : "-"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: "#0f1117",
                  border: "1px solid #1e2330",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: "1px solid #1e2330",
                    background: "#0a0d13",
                  }}
                >
                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Recent API Logs (All Users)
                  </span>
                  <span
                    style={{
                      color: "#475569",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {recentLogs.length} entries
                  </span>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#0a0d13",
                          borderBottom: "1px solid #1e2330",
                        }}
                      >
                        {["Time", "User", "Path", "Status", "Duration", "IP", "Location", "Source"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "12px 16px",
                              textAlign: "left",
                              color: "#475569",
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentLogs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            style={{
                              padding: 48,
                              textAlign: "center",
                              color: "#334155",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12,
                            }}
                          >
                            No logs yet.
                          </td>
                        </tr>
                      ) : (
                        recentLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="row-hover"
                            style={{
                              borderBottom: "1px solid #141820",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#94a3b8",
                                fontSize: 11,
                                fontFamily: "'JetBrains Mono', monospace",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {new Date(log.createdAt).toLocaleString("en-IN")}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#cbd5e1",
                                fontSize: 11,
                                fontFamily: "'JetBrains Mono', monospace",
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {displayEmail(log.email, showSensitiveInfo)}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#cbd5e1",
                                fontSize: 12,
                                fontFamily: "'JetBrains Mono', monospace",
                                maxWidth: 420,
                                wordBreak: "break-all",
                              }}
                            >
                              {log.path}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  color:
                                    log.statusCode >= 200 && log.statusCode < 400
                                      ? "#6ee7b7"
                                      : "#fda4af",
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: 12,
                                }}
                              >
                                {log.statusCode}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#93c5fd",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 12,
                              }}
                            >
                              {Number(log.duration).toFixed(2)} ms
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#64748b",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                              }}
                            >
                              {log.ip}
                            </td>
                            <td
                              style={{
                                padding: "12px 16px",
                                color: "#cbd5e1",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {recentIpLocationsLoading && !recentIpLocations[log.ip]
                                ? "Resolving..."
                                : recentIpLocations[log.ip]
                                  ? `${recentIpLocations[log.ip].city ?? "Unknown"}, ${recentIpLocations[log.ip].country ?? "Unknown"}`
                                  : "Unknown"}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontWeight: 700,
                                  letterSpacing: "0.05em",
                                  background: log.source === "SDK" ? "#0f2a1d" : "#1a1060",
                                  border: `1px solid ${log.source === "SDK" ? "#1a4731" : "#2d1f8a"}`,
                                  color: log.source === "SDK" ? "#6ee7b7" : "#a78bfa",
                                }}
                              >
                                {log.source ?? "API"}
                              </span>
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

          {/* Issues Table */}
          {activeTab === "issues" && (
            <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", borderBottom: "1px solid #1e2330", background: "#0a0d13",
                }}
              >
                <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  Recent new / updated GitHub issues (last {issuesData?.windowDays ?? 14} days)
                </span>
                <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                  New: {issuesData?.newCount ?? 0} | Updated: {issuesData?.updatedCount ?? 0}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#0a0d13", borderBottom: "1px solid #1e2330" }}>
                      {["Issue", "State", "Labels", "Updated", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#475569", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((issue) => (
                      <tr key={issue.id} className="row-hover" style={{ borderBottom: "1px solid #141820", transition: "background 0.15s" }}>
                        <td style={{ padding: "14px 16px", minWidth: 320 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>
                              #{issue.number} {issue.title}
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                                @{issue.author}
                              </span>
                              {issue.isNew && (
                                <span style={{ background: "#0f2a1d", color: "#6ee7b7", border: "1px solid #1a4731", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                  NEW
                                </span>
                              )}
                              {issue.isRecentlyUpdated && (
                                <span style={{ background: "#0f2233", color: "#60a5fa", border: "1px solid #1a3a5c", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                  UPDATED
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <StatusBadge status={issue.state === "open" ? "active" : "expired"} />
                        </td>
                        <td style={{ padding: "14px 16px", minWidth: 210 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {issue.labels.slice(0, 3).map((label) => (
                              <span
                                key={`${issue.id}-${label.name}`}
                                style={{
                                  background: "#1a1f2e",
                                  border: `1px solid #${label.color}`,
                                  color: "#cbd5e1",
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {label.name}
                              </span>
                            ))}
                            {issue.labels.length === 0 && (
                              <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>—</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", minWidth: 175 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                              {formatCompactDate(issue.updatedAt)}
                            </span>
                            <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                              Created: {formatCompactDate(issue.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <a
                            className="action-btn"
                            href={issue.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: "#1a1f2e", border: "1px solid #2d3548",
                              color: "#64748b", borderRadius: 6, padding: "6px 10px",
                              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                              fontSize: 12, fontFamily: "'JetBrains Mono', monospace", transition: "background 0.15s, color 0.15s, border-color 0.15s",
                              textDecoration: "none",
                            }}
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    ))}
                    {issues.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#334155", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No recent new or updated issues found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "playground" && (
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 0.9fr" }}>
              <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
                  <p style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 700 }}>API Playground</p>
                  <span
                    style={{
                      color: adminApiKey ? "#6ee7b7" : "#fca5a5",
                      background: adminApiKey ? "#0f2a1d" : "#2a0f0f",
                      border: `1px solid ${adminApiKey ? "#1a4731" : "#4a1f1f"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {adminApiKey ? "Admin API key" : "API key missing"}
                  </span>
                </div>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    lineHeight: 1.7,
                    fontFamily: "'JetBrains Mono', monospace",
                    marginBottom: 18,
                  }}
                >
                  Run quick real requests without leaving the admin console. Results appear on the right panel with status and latency.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {[
                    { id: "pnr", label: "PNR" },
                    { id: "train", label: "Train" },
                    { id: "track", label: "Track" },
                    { id: "history", label: "History" },
                    { id: "station", label: "Station" },
                    { id: "search", label: "Search" },
                    { id: "availability", label: "Availability" },
                    { id: "fare", label: "Fare" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setPlaygroundAction(item.id as typeof playgroundAction);
                        resetPlaygroundMeta();
                      }}
                      style={{
                        background:
                          playgroundAction === item.id ? "#1e2a3a" : "#131722",
                        border:
                          playgroundAction === item.id
                            ? "1px solid #2d4060"
                            : "1px solid #1f2432",
                        color:
                          playgroundAction === item.id ? "#60a5fa" : "#64748b",
                        borderRadius: 6,
                        padding: "7px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                        transition: "background 0.15s, color 0.15s, border-color 0.15s",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {playgroundAction === "pnr" && (
                    <input
                      value={playgroundInput.pnr}
                      onChange={(e) =>
                        setPlaygroundInput((prev) => ({
                          ...prev,
                          pnr: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      maxLength={10}
                      placeholder="PNR number (10 digits)"
                      style={{
                        gridColumn: "1 / -1",
                        background: "#0a0d13",
                        border: "1px solid #2d3548",
                        borderRadius: 8,
                        padding: "11px 12px",
                        color: "#cbd5e1",
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        outline: "none",
                      }}
                    />
                  )}

                  {playgroundAction === "train" && (
                    <input
                      value={playgroundInput.trainNumber}
                      onChange={(e) =>
                        setPlaygroundInput((prev) => ({
                          ...prev,
                          trainNumber: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      maxLength={5}
                      placeholder="Train number (5 digits)"
                      style={{
                        gridColumn: "1 / -1",
                        background: "#0a0d13",
                        border: "1px solid #2d3548",
                        borderRadius: 8,
                        padding: "11px 12px",
                        color: "#cbd5e1",
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        outline: "none",
                      }}
                    />
                  )}

                  {playgroundAction === "track" && (
                    <>
                      <input
                        value={playgroundInput.trainNumber}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            trainNumber: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        maxLength={5}
                        placeholder="Train number"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        type="date"
                        value={toInputDate(playgroundInput.journeyDate)}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            journeyDate: fromInputDate(e.target.value),
                          }))
                        }
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                    </>
                  )}

                  {playgroundAction === "history" && (
                    <>
                      <input
                        value={playgroundInput.trainNumber}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            trainNumber: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        maxLength={5}
                        placeholder="Train number"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        type="date"
                        value={toInputDate(playgroundInput.journeyDate)}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            journeyDate: fromInputDate(e.target.value),
                          }))
                        }
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                    </>
                  )}

                  {playgroundAction === "station" && (
                    <>
                      <input
                        value={playgroundInput.stationCode}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            stationCode: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Station code (e.g. NDLS)"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <select
                        value={playgroundInput.stationHours}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            stationHours: e.target.value,
                          }))
                        }
                        aria-label="Time window in hours"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
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
                        value={playgroundInput.fromStation}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            fromStation: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="From station code"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        value={playgroundInput.toStation}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            toStation: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="To station code"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        type="date"
                        value={toInputDate(playgroundInput.journeyDate)}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            journeyDate: fromInputDate(e.target.value),
                          }))
                        }
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                    </>
                  )}

                  {playgroundAction === "availability" && (
                    <>
                      <input
                        value={playgroundInput.trainNumber}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            trainNumber: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        maxLength={5}
                        placeholder="Train number"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        type="date"
                        value={toInputDate(playgroundInput.journeyDate)}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            journeyDate: fromInputDate(e.target.value),
                          }))
                        }
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        value={playgroundInput.fromStation}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            fromStation: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="From station"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <input
                        value={playgroundInput.toStation}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            toStation: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="To station"
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      />
                      <select
                        value={playgroundInput.classCode}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            classCode: e.target.value,
                          }))
                        }
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      >
                        {["SL", "3A", "2A", "1A", "CC", "EC", "2S"].map((coach) => (
                          <option key={coach} value={coach}>
                            {coach}
                          </option>
                        ))}
                      </select>
                      <select
                        value={playgroundInput.quota}
                        onChange={(e) =>
                          setPlaygroundInput((prev) => ({
                            ...prev,
                            quota: e.target.value,
                          }))
                        }
                        style={{
                          background: "#0a0d13",
                          border: "1px solid #2d3548",
                          borderRadius: 8,
                          padding: "11px 12px",
                          color: "#cbd5e1",
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', monospace",
                          outline: "none",
                        }}
                      >
                        {["GN", "TQ", "LD", "PT", "SS"].map((quota) => (
                          <option key={quota} value={quota}>
                            {quota}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {playgroundAction === "fare" && (
                    <>
                      <input
                        value={playgroundInput.trainNumber}
                        onChange={(e) => setPlaygroundInput((prev) => ({ ...prev, trainNumber: e.target.value.replace(/\D/g, "") }))}
                        maxLength={5}
                        placeholder="Train number"
                        style={{ background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      />
                      <input
                        type="date"
                        value={toInputDate(playgroundInput.journeyDate)}
                        onChange={(e) => setPlaygroundInput((prev) => ({ ...prev, journeyDate: fromInputDate(e.target.value) }))}
                        style={{ background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      />
                      <input
                        value={playgroundInput.fromStation}
                        onChange={(e) => setPlaygroundInput((prev) => ({ ...prev, fromStation: e.target.value.toUpperCase() }))}
                        placeholder="From station"
                        style={{ background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      />
                      <input
                        value={playgroundInput.toStation}
                        onChange={(e) => setPlaygroundInput((prev) => ({ ...prev, toStation: e.target.value.toUpperCase() }))}
                        placeholder="To station"
                        style={{ background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      />
                      <select
                        value={playgroundInput.classCode}
                        onChange={(e) => setPlaygroundInput((prev) => ({ ...prev, classCode: e.target.value }))}
                        style={{ background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      >
                        {["SL","3A","2A","1A","CC","EC","EA","FC","2S","3E","VS","CH","HS","VC","VA"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        value={playgroundInput.quota}
                        onChange={(e) => setPlaygroundInput((prev) => ({ ...prev, quota: e.target.value }))}
                        style={{ background: "#0a0d13", border: "1px solid #2d3548", borderRadius: 8, padding: "11px 12px", color: "#cbd5e1", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" }}
                      >
                        {["GN","TQ","PT","LD","DF","FT","LB","YU","DP","HP","PH","SS"].map((q) => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={runPlayground}
                    disabled={playgroundLoading}
                    style={{
                      background: playgroundLoading
                        ? "#1a1f2e"
                        : "linear-gradient(135deg, #059669, #047857)",
                      border: playgroundLoading ? "1px solid #2d3548" : "1px solid #047857",
                      color: playgroundLoading ? "#64748b" : "#ffffff",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: playgroundLoading ? "not-allowed" : "pointer",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {playgroundLoading ? "Running..." : "Run Request"}
                  </button>
                  {playgroundStatus !== null && (
                    <span
                      style={{
                        color: playgroundStatus < 400 ? "#6ee7b7" : "#fca5a5",
                        background: playgroundStatus < 400 ? "#0f2a1d" : "#2a0f0f",
                        border: `1px solid ${playgroundStatus < 400 ? "#1a4731" : "#4a1f1f"}`,
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      HTTP {playgroundStatus}
                    </span>
                  )}
                  {playgroundDuration !== null && (
                    <span
                      style={{
                        color: "#93c5fd",
                        background: "#0b1a2c",
                        border: "1px solid #1e3a5f",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {playgroundDuration}ms
                    </span>
                  )}
                </div>

                {playgroundError && (
                  <p style={{ marginTop: 10, color: "#fda4af", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                    {playgroundError}
                  </p>
                )}
              </div>

              <div style={{ background: "#0f1117", border: "1px solid #1e2330", borderRadius: 12, overflow: "hidden", minHeight: 420 }}>
                <div
                  style={{
                    background: "#0a0d13",
                    borderBottom: "1px solid #1e2330",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      color: "#94a3b8",
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Response
                  </span>
                  <span style={{ color: "#475569", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                    JSON
                  </span>
                </div>
                <div style={{ padding: 14, height: "100%" }}>
                  {playgroundLoading ? (
                    <PlaygroundResponseSkeleton />
                  ) : (
                    <SyntaxHighlighter
                      language="json"
                      style={nightOwl}
                      customStyle={{
                        margin: 0,
                        background: "transparent",
                        fontSize: 12,
                        lineHeight: 1.7,
                        minHeight: 360,
                        maxHeight: 520,
                        borderRadius: 8,
                        overflow: "auto",
                        padding: 0,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {playgroundResponse || `{
  "message": "Run a request to preview the live response"
}`}
                    </SyntaxHighlighter>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
