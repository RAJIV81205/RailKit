"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import type { PricingPlan, PaidPlanType, PricingFeature } from "../../lib/constants";
import { TOPUP_OPTIONS, formatINR } from "../../lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

type NoticeKind = "success" | "error" | "info";
type Notice = { id: number; kind: NoticeKind; text: string } | null;
type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; plan: "free" | PaidPlanType };
type TimeLeft = { days: number; hours: number; minutes: number; seconds: number; expired: boolean };
type CashfreeCheckoutMode = "sandbox" | "production";
type CashfreeCheckoutClient = {
  checkout: (options: { paymentSessionId: string; redirectTarget: "_modal" }) => Promise<unknown>;
};
type CreatedPaymentOrder = {
  orderId?: string;
  paymentSessionId?: string;
  planType?: PaidPlanType;
  cashfreeMode?: CashfreeCheckoutMode;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: CashfreeCheckoutMode }) => CashfreeCheckoutClient;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getNumericPrice(value: string): number {
  return Number(value.replace(/[^\d.]/g, "")) || 0;
}

function getDiscountPercent(originalPrice: string, discountedPrice: string): number | null {
  const original = getNumericPrice(originalPrice);
  const discounted = getNumericPrice(discountedPrice);
  if (!original || !Number.isFinite(discounted)) return null;
  const percent = Math.round(((original - discounted) / original) * 100);
  return Math.max(0, percent);
}

function normalizePlan(raw: string): "free" | PaidPlanType | null {
  const lower = raw.toLowerCase();
  const mapped = lower === "enterprise" ? "advance" : lower;
  if (mapped === "free" || mapped === "pro" || mapped === "advance") {
    return mapped as "free" | PaidPlanType;
  }
  return null;
}

// Quantitative features (request quota, rate limits) exist on every plan with
// tier-specific values — they are never "missing", only categorical perks are.
function isQuantitativeFeature(feature: PricingFeature): boolean {
  return Boolean(feature.highlight) || /\bmin\b/i.test(feature.text);
}

// For each plan, the categorical perks that only higher-tier plans unlock.
// Derived from the plan list (assumed ordered cheapest → most capable) so it
// stays in sync if the underlying pricing config changes.
function computeMissingByPlan(plans: PricingPlan[]): Record<string, PricingFeature[]> {
  const result: Record<string, PricingFeature[]> = {};
  plans.forEach((plan, index) => {
    const ownTexts = new Set(plan.features.map((f) => f.text.toLowerCase()));
    const seen = new Set<string>();
    const missing: PricingFeature[] = [];
    for (let higher = index + 1; higher < plans.length; higher++) {
      for (const feature of plans[higher].features) {
        if (isQuantitativeFeature(feature)) continue;
        const key = feature.text.toLowerCase();
        if (ownTexts.has(key) || seen.has(key)) continue;
        seen.add(key);
        missing.push(feature);
      }
    }
    result[plan.id] = missing;
  });
  return result;
}

// ─── SDK loader ───────────────────────────────────────────────────────────────

let cashfreeLoadPromise: Promise<void> | null = null;

function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Cashfree checkout is unavailable on server"));
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

// ─── Root export ──────────────────────────────────────────────────────────────

export default function PricingClient({
  initialPlans,
  initialOfferEndsAt,
  initialContactEmail,
  initialBillingV2Enabled,
}: {
  initialPlans: PricingPlan[];
  initialOfferEndsAt: string | null;
  initialContactEmail: string;
  initialBillingV2Enabled: boolean;
}) {
  return (
    <Suspense fallback={<PricingPageSkeleton />}>
      <PricingPageContent
        initialPlans={initialPlans}
        initialOfferEndsAt={initialOfferEndsAt}
        initialContactEmail={initialContactEmail}
        initialBillingV2Enabled={initialBillingV2Enabled}
      />
    </Suspense>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PricingPageSkeleton() {
  return (
    <div className="min-h-screen bg-white px-6 pt-40 pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 h-4 w-40 animate-pulse rounded-full bg-gray-100 mx-auto" />
        <div className="mb-6 h-16 max-w-2xl animate-pulse rounded-xl bg-gray-100 mx-auto" />
        <div className="mb-16 h-5 max-w-lg animate-pulse rounded-lg bg-gray-100 mx-auto" />
        <div className="grid gap-5 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-140 animate-pulse rounded-3xl bg-gray-50 border border-gray-100"
              style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Notice bar ───────────────────────────────────────────────────────────────

function NoticeBar({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    if (notice.kind === "success" || notice.kind === "info") {
      const t = setTimeout(onDismiss, 6000);
      return () => clearTimeout(t);
    }
  }, [notice, onDismiss]);

  if (!notice) return null;

  const styles: Record<NoticeKind, string> = {
    success: "border-emerald-100 bg-emerald-50 text-emerald-800",
    error: "border-red-100 bg-red-50 text-red-700",
    info: "border-sky-100 bg-sky-50 text-sky-800",
  };
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info }[notice.kind];

  return (
    <div role="status" aria-live="polite"
      className={`mb-10 flex max-w-2xl mx-auto items-start gap-3 rounded-2xl border px-5 py-4 ${styles[notice.kind]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 text-sm leading-relaxed">{notice.text}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(offerEndsAt: string | null): TimeLeft {
  const EXPIRED: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  const calc = (): TimeLeft => {
    if (!offerEndsAt) return EXPIRED;
    const deadline = new Date(offerEndsAt).getTime();
    if (!Number.isFinite(deadline)) return EXPIRED;
    const diff = deadline - Date.now();
    if (diff <= 0) return EXPIRED;
    return {
      days: Math.floor(diff / 864e5),
      hours: Math.floor((diff / 36e5) % 24),
      minutes: Math.floor((diff / 6e4) % 60),
      seconds: Math.floor((diff / 1e3) % 60),
      expired: false,
    };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calc);

  useEffect(() => {
    if (!offerEndsAt) return;
    const deadline = new Date(offerEndsAt).getTime();
    if (!Number.isFinite(deadline)) return;
    const tick = () => {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft(EXPIRED); return; }
      setTimeLeft({
        days: Math.floor(diff / 864e5),
        hours: Math.floor((diff / 36e5) % 24),
        minutes: Math.floor((diff / 6e4) % 60),
        seconds: Math.floor((diff / 1e3) % 60),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerEndsAt]);

  return timeLeft;
}

// ─── Payment modal ────────────────────────────────────────────────────────────

function PaymentModal({
  selectedPlan, billingInterval, isCreatingOrder, onConfirm, onCancel,
}: {
  selectedPlan: PaidPlanType;
  billingInterval: "month" | "year";
  isCreatingOrder: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    confirmBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCreatingOrder) { onCancel(); return; }
      if (e.key !== "Tab") return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [isCreatingOrder, onCancel]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !isCreatingOrder) onCancel(); }}>
      <div ref={modalRef}
        className="w-full max-w-md overflow-y-auto rounded-3xl border border-black/8 bg-white p-8 shadow-2xl"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-black">
          <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
        </div>
        <h3 id="modal-title" className="text-xl font-semibold text-black" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
          Secure Checkout
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#6F6F6F]">
          A secure Cashfree popup will open to complete payment for the{" "}
          <span className="font-semibold text-black uppercase">{selectedPlan}</span> plan ({billingInterval === "year" ? "annual" : "monthly"}).
        </p>
        <ul className="mt-6 space-y-2.5">
          {["256-bit SSL encrypted transaction", "Payment processed by Cashfree — card data never stored here", "Instant plan activation on success"].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-[#6F6F6F]">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black">
                <Check className="h-2.5 w-2.5 text-white" aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <button type="button" ref={confirmBtnRef} onClick={onConfirm} disabled={isCreatingOrder}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60">
            {isCreatingOrder && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isCreatingOrder ? "Opening Checkout…" : "Proceed to Payment"}
          </button>
          <button type="button" onClick={onCancel} disabled={isCreatingOrder}
            className="rounded-full border border-black/10 px-6 py-3.5 text-sm text-[#6F6F6F] transition hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Restart plan caution modal ─────────────────────────────────────────────

function RestartPlanCautionModal({
  isOpen,
  onProceed,
  onCancel,
}: {
  isOpen: boolean;
  onProceed: () => void;
  onCancel: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    setSecondsLeft(3);
    setProgress(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const remaining = Math.max(0, 3 - elapsedSeconds);
      setSecondsLeft(remaining);
      setProgress(Math.min(100, (elapsedMs / 3000) * 100));
      if (remaining === 0) {
        setProgress(100);
        clearInterval(timer);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const prev = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const canProceed = secondsLeft === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="restart-caution-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-md overflow-y-auto rounded-3xl border border-amber-200 bg-white p-8 shadow-2xl"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500">
          <AlertCircle className="h-5 w-5 text-white" aria-hidden />
        </div>

        <h3 id="restart-caution-title" className="text-xl font-semibold text-black" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
          Restart plan caution
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#6F6F6F]">
          Renewing this plan will remove your remaining request quota and reset the expiry date. The plan will start again from a fresh cycle.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onProceed}
            disabled={!canProceed}
            aria-busy={!canProceed}
            className="relative inline-flex items-center justify-center overflow-hidden rounded-full border border-black/10 px-6 py-3.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-100"
            style={{
              background: canProceed ? "#000000" : "#f5f5f5",
              color: canProceed ? "#ffffff" : "#111827",
            }}
          >
            {!canProceed && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-amber-400/90 transition-[width] duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              Continue to payment
              {!canProceed && <span className="text-xs font-medium text-black/45">{secondsLeft}s</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-black/10 px-6 py-3.5 text-sm text-[#6F6F6F] transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────

function PricingPageContent({
  initialPlans, initialOfferEndsAt, initialContactEmail, initialBillingV2Enabled,
}: {
  initialPlans: PricingPlan[];
  initialOfferEndsAt: string | null;
  initialContactEmail: string;
  initialBillingV2Enabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [notice, setNotice] = useState<Notice>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRestartWarningModal, setShowRestartWarningModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanType | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const timeLeft = useCountdown(initialOfferEndsAt);
  const missingByPlan = computeMissingByPlan(initialPlans);
  const contactUrl = `mailto:${initialContactEmail}?subject=${encodeURIComponent("RailKit Payment Help")}`;
  const orderIdFromQuery = searchParams.get("order_id");
  const isPaymentReturn = searchParams.get("payment_return") === "1";

  const showNotice = useCallback((kind: NoticeKind, text: string) => {
    setNotice({ id: Date.now(), kind, text });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const verifyPayment = useCallback(async (orderId: string, paidPlanType?: PaidPlanType) => {
    showNotice("info", "Verifying payment status…");
    const response = await fetch(`/api/user/get-order?orderId=${encodeURIComponent(orderId)}&sync=true`, { method: "GET", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to verify payment status");
    if (data?.order?.credited) {
      showNotice("success", "Payment successful! Your plan is now active.");
      if (paidPlanType) setAuthState({ status: "authenticated", plan: paidPlanType });
      const url = new URL(window.location.href);
      url.searchParams.delete("order_id");
      url.searchParams.delete("payment_return");
      router.replace(url.pathname + url.search, { scroll: false });
      return;
    }
    if (data?.order?.paymentStatus === "FAILED") { showNotice("error", "Payment failed. Please try again or contact support."); return; }
    if (data?.order?.paymentStatus === "USER_DROPPED") { showNotice("info", "Payment was cancelled. You can try again anytime."); return; }
    showNotice("info", "Payment is still processing — please check back shortly.");
  }, [showNotice, router]);

  // Auth check
  useEffect(() => {
    let cancelled = false;
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/user/verify", { method: "GET", cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) { setAuthState({ status: "unauthenticated" }); return; }
        const data = await res.json();
        if (!data?.success) { setAuthState({ status: "unauthenticated" }); return; }
        const plan = normalizePlan(String(data?.user?.plan || ""));
        setAuthState({ status: "authenticated", plan: plan ?? "free" });
      } catch { if (!cancelled) setAuthState({ status: "unauthenticated" }); }
    };
    verifyAuth();
    return () => { cancelled = true; };
  }, []);

  // Payment return
  useEffect(() => {
    if (!isPaymentReturn || !orderIdFromQuery) return;
    if (authState.status === "loading" || authState.status === "unauthenticated") return;
    let cancelled = false;
    const handleReturn = async () => {
      try { if (!cancelled) await verifyPayment(orderIdFromQuery); }
      catch (error: unknown) { if (!cancelled) showNotice("error", getErrorMessage(error, "Unable to verify payment.")); }
    };
    handleReturn();
    return () => { cancelled = true; };
  }, [isPaymentReturn, orderIdFromQuery, authState.status, verifyPayment, showNotice]);

  const openPaymentModal = (planType: PaidPlanType | "free") => {
    if (planType === "free") return;
    if (!initialBillingV2Enabled) { showNotice("info", "New billing plans are temporarily unavailable."); return; }
    if (authState.status === "loading") { showNotice("info", "Please wait while we check your login status."); return; }
    if (authState.status === "unauthenticated") { router.push("/auth?redirect=/pricing"); return; }
    setSelectedPlan(planType);
    setShowPaymentModal(true);
  };

  const openRestartWarningModal = (planType: PaidPlanType) => {
    if (authState.status === "loading") { showNotice("info", "Please wait while we check your login status."); return; }
    if (authState.status === "unauthenticated") { router.push("/auth?redirect=/pricing"); return; }
    setSelectedPlan(planType);
    setShowRestartWarningModal(true);
  };

  const startPayment = async () => {
    if (!selectedPlan) return;
    setIsCreatingOrder(true);
    dismissNotice();
    try {
      const response = await fetch("/api/user/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planType: selectedPlan, billingInterval }) });
      const data = await response.json();
      const order = data?.order as CreatedPaymentOrder | undefined;
      if (!response.ok || !order?.orderId || !order?.paymentSessionId) throw new Error(data?.message || "Unable to create order. Please try again.");
      await loadCashfreeSdk();
      if (!window.Cashfree) throw new Error("Cashfree checkout failed to load. Please refresh and try again.");
      setShowPaymentModal(false);
      showNotice("info", "Opening secure payment popup…");
      const cashfree = window.Cashfree({ mode: data?.cashfreeMode === "sandbox" ? "sandbox" : "production" });
      try { await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_modal" }); } catch { /* modal close */ }
      await verifyPayment(order.orderId, order.planType);
    } catch (error: unknown) {
      setShowPaymentModal(false);
      showNotice("error", getErrorMessage(error, "Something went wrong. Please try again."));
    } finally { setIsCreatingOrder(false); }
  };

  const getButtonState = (plan: PricingPlan): { label: string; disabled: boolean; action: () => void } => {
    const isLoading = authState.status === "loading";
    const isAuthed = authState.status === "authenticated";
    const currentPlan = isAuthed ? (authState as { plan: "free" | PaidPlanType }).plan : null;
    if (!initialBillingV2Enabled && plan.planType !== "free") return { label: "Coming soon", disabled: true, action: () => {} };
    if (isAuthed && currentPlan && currentPlan !== "free") return { label: "Current plan active", disabled: true, action: () => {} };
    if (plan.planType === "free") return { label: plan.buttonText, disabled: false, action: () => router.push("/auth?redirect=/pricing") };
    if (isLoading) return { label: "Checking Login…", disabled: true, action: () => {} };
    if (!isAuthed) return { label: "Login to Continue", disabled: false, action: () => router.push("/auth?redirect=/pricing") };
    if (currentPlan === plan.planType) return { label: "Current Plan", disabled: true, action: () => {} };
    return { label: currentPlan && currentPlan !== "free" ? "Change Plan" : "Upgrade Now", disabled: false, action: () => openPaymentModal(plan.planType) };
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white text-black" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        /* Animations */
        @keyframes pr-rise { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .pr-a1 { animation: pr-rise 0.7s ease both; }
        .pr-a2 { animation: pr-rise 0.7s ease 0.1s both; }
        .pr-a3 { animation: pr-rise 0.7s ease 0.2s both; }
        .pr-a4 { animation: pr-rise 0.7s ease 0.3s both; }
        .pr-a5 { animation: pr-rise 0.7s ease 0.4s both; }
        .pr-a6 { animation: pr-rise 0.7s ease 0.5s both; }
        @media (prefers-reduced-motion: reduce) {
          .pr-a1,.pr-a2,.pr-a3,.pr-a4,.pr-a5,.pr-a6 { animation: none; }
        }

        /* Card hover */
        .pr-card { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; }
        .pr-card:hover { transform: translateY(-4px); box-shadow: 0 20px 56px rgba(0,0,0,0.08); }
        .pr-card-popular:hover { border-color: rgba(0,0,0,0.2); }

        /* Pack card hover */
        .pr-pack { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
        .pr-pack:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.12); }

        /* Button */
        .pr-btn { transition: transform 0.18s ease, background 0.18s ease, opacity 0.18s ease; }
        .pr-btn:hover:not(:disabled) { transform: scale(1.02); }
        .pr-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>

      <main className="px-6 pt-36 pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* ── Hero ── */}
          <div className="mb-20 text-center">
            <p className="pr-a1 mb-6 text-xs tracking-[0.22em] uppercase text-[#9ca3af]">
              RailKit Pricing
            </p>
            <h1 className="pr-a2 mx-auto max-w-4xl leading-[0.95] tracking-[-0.04em] text-black"
              style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(40px, 7vw, 80px)", fontWeight: 400 }}>
              Infrastructure pricing,{" "}
              <em style={{ fontStyle: "italic", color: "#6F6F6F" }}>built for</em>
              <br />
              <em style={{ fontStyle: "italic", color: "#6F6F6F" }}>scale.</em>
            </h1>
            <p className="pr-a3 mx-auto mt-7 max-w-xl text-base leading-relaxed text-[#6F6F6F]" style={{ fontWeight: 300 }}>
              Start free for development, then scale request capacity as your railway application grows.
              Transparent pricing, clean limits, production-ready infrastructure.
            </p>

            {/* Status bar
            <div className="pr-a4 mt-10 inline-flex flex-wrap items-center justify-center gap-6 rounded-full border border-black/5 bg-white/70 px-8 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.06)]"
              style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
              {[
                { val: "99.9%", lbl: "Uptime" },
                { val: "Instant", lbl: "Activation" },
                { val: "Secure", lbl: "Payments" },
                { val: "Live", lbl: "Railway API" },
              ].map((s, i) => (
                <div key={s.lbl} className="flex items-center gap-6">
                  {i > 0 && <span className="h-4 w-px bg-black/8" aria-hidden />}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-600 text-black" style={{ fontWeight: 600 }}>{s.val}</span>
                    <span className="text-xs text-[#9ca3af]">{s.lbl}</span>
                  </div>
                </div>
              ))}
            </div> */}
          </div>

          {/* ── Notices ── */}
          <NoticeBar notice={notice} onDismiss={dismissNotice} />

          {authState.status === "loading" && (
            <div className="mb-10 flex max-w-xs mx-auto items-center gap-2 rounded-2xl border border-black/6 bg-white px-4 py-3 text-sm text-[#6F6F6F]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking login status…
            </div>
          )}

          <div className="mb-8 flex justify-center" role="group" aria-label="Billing interval">
            <div className="inline-flex rounded-full border border-black/10 bg-[#f7f7f7] p-1">
              {(["month", "year"] as const).map((interval) => (
                <button key={interval} type="button" onClick={() => setBillingInterval(interval)}
                  className={`rounded-full px-5 py-2 text-sm ${billingInterval === interval ? "bg-black text-white" : "text-[#6F6F6F]"}`}>
                  {interval === "month" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Pricing cards ── */}
          <section aria-label="Pricing plans" className="pr-a5">
            <div className="grid gap-5 lg:grid-cols-3">
              {initialPlans.map((plan) => {
                const btnState = getButtonState(plan);
                const isPopular = plan.planType === "advance";
                const displayPrice = billingInterval === "year" ? (plan.annualPrice ?? plan.price) : plan.price;
                const originalDisplay = billingInterval === "year" ? (plan.annualOriginalPrice ?? displayPrice) : (plan.originalPrice ?? displayPrice);
                const discountPercent = originalDisplay ? getDiscountPercent(originalDisplay, displayPrice) : null;

                return (
                  <article key={plan.id} aria-label={`${plan.name} plan`}
                    className={`pr-card relative flex flex-col rounded-[28px] border p-7 ${
                      isPopular
                        ? "pr-card-popular border-black/12 bg-[#0a0a0a] text-white shadow-[0_12px_48px_rgba(0,0,0,0.18)]"
                        : "border-black/6 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
                    }`}>

                    {/* Popular badge */}
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-medium text-black shadow-sm border border-black/8">
                          <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden />
                          Most Popular
                        </span>
                      </div>
                    )}

                    {/* Plan name */}
                    <div className="mb-5 mt-2">
                      <h2 className="text-lg font-medium" style={{ color: isPopular ? "#fff" : "#000" }}>
                        {plan.name}
                      </h2>
                      <p className="mt-2 text-sm leading-6" style={{ color: isPopular ? "rgba(255,255,255,0.55)" : "#6F6F6F", fontWeight: 300 }}>
                        {plan.description}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      {plan.originalPrice && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm line-through" style={{ color: isPopular ? "rgba(255,255,255,0.35)" : "#9ca3af" }}>
                            {originalDisplay}
                          </span>
                          {discountPercent && (
                            <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{ background: isPopular ? "rgba(255,255,255,0.1)" : "#f5f5f5", color: isPopular ? "rgba(255,255,255,0.7)" : "#374151" }}>
                              {discountPercent}% off
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(40px,5vw,56px)", fontWeight: 400, lineHeight: 1, color: isPopular ? "#fff" : "#000", letterSpacing: "-0.03em" }}>
                          {displayPrice}
                        </span>
                        <span className="mb-1.5 text-sm" style={{ color: isPopular ? "rgba(255,255,255,0.45)" : "#9ca3af" }}>
                          {billingInterval === "year" ? "/year" : plan.period}
                        </span>
                      </div>

                      {!timeLeft.expired && plan.originalPrice && (
                        <div className="mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-medium"
                          style={{ background: isPopular ? "rgba(255,255,255,0.08)" : "#fafafa", border: "1px solid", borderColor: isPopular ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", color: isPopular ? "rgba(255,255,255,0.6)" : "#6b7280" }}
                          aria-live="polite">
                          Offer ends in {timeLeft.days}d {pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <button type="button" onClick={btnState.action} disabled={btnState.disabled}
                      aria-label={`${btnState.label} — ${plan.name} plan`}
                      className="pr-btn w-full rounded-full py-3.5 text-sm font-medium cursor-pointer"
                      style={{
                        background: btnState.disabled ? (isPopular ? "rgba(255,255,255,0.08)" : "#f5f5f5") : isPopular ? "#ffffff" : "#000000",
                        color: btnState.disabled ? (isPopular ? "rgba(255,255,255,0.3)" : "#9ca3af") : isPopular ? "#000" : "#fff",
                      }}>
                      {authState.status === "loading" && plan.planType !== "free" ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Checking…
                        </span>
                      ) : btnState.label}
                    </button>

                    {/* Features */}
                    <div className="mt-7 border-t pt-6" style={{ borderColor: isPopular ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                      <ul className="space-y-3" role="list">
                        {/* What you get — check icon + bold text */}
                        {plan.features.map((feature, i) => (
                          <li key={`inc-${i}`} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                              style={{ background: isPopular ? "rgba(255,255,255,0.16)" : "#000" }} aria-hidden>
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            </span>
                            <span className="text-sm leading-6"
                              style={{ color: isPopular ? "#fff" : "#000", fontWeight: feature.highlight ? 600 : 500 }}>
                              {feature.text}
                            </span>
                          </li>
                        ))}

                        {/* What you miss out on — cross icon + faded text */}
                        {missingByPlan[plan.id]?.map((feature, i) => (
                          <li key={`miss-${i}`} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                              style={{ background: isPopular ? "rgba(255,255,255,0.06)" : "#f3f4f6" }} aria-hidden>
                              <X className="h-2.5 w-2.5" strokeWidth={3} style={{ color: isPopular ? "rgba(255,255,255,0.35)" : "#b0b0b0" }} />
                            </span>
                            <span className="text-sm leading-6"
                              style={{ color: isPopular ? "rgba(255,255,255,0.3)" : "#b8b8b8", fontWeight: 300 }}>
                              {feature.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Request packs ── */}
          <section aria-label="Additional request packs" className="pr-a6 mt-16">
            <div className="mb-8">
              <p className="mb-2 text-xs tracking-[0.12em] uppercase text-[#9ca3af]">Flexible usage</p>
              <h2 className="text-2xl text-black" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em" }}>
                Need more requests?
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-7 text-[#6F6F6F]" style={{ fontWeight: 300 }}>
                Scale usage anytime with additional request packs — no forced plan changes, no hidden limits.
                Top up only when you need it.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {TOPUP_OPTIONS.map((opt, i) => {
                const lbl = opt.requests >= 1000 ? `+${Math.round(opt.requests / 1000)}K Requests` : `+${opt.requests} Requests`;
                const notes = ["Great for testing", "Most flexible", "Best value", "Large volume"];
                const note = notes[i] ?? "Flexible top-up";
                return (
                  <div key={String(opt.requests)}
                    className="pr-pack flex items-center justify-between rounded-2xl border border-black/6 bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                    <div>
                      <div className="text-sm font-medium text-black">{lbl}</div>
                      <div className="mt-0.5 text-xs text-[#9ca3af]">{note}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-black" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
                        {formatINR(opt.price)}
                      </div>
                      <div className="mt-0.5 text-xs text-[#9ca3af]">one-time</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-[#9ca3af]">
              Request packs are add-ons for active paid subscriptions and may be purchased multiple times. Unused pack requests expire with the associated subscription; packs do not extend or renew subscription validity.
            </p>
          </section>

          {/* ── Enterprise ── */}
          <section aria-label="Enterprise pricing"
            className="mt-12 overflow-hidden rounded-[28px] p-8 sm:p-10"
            style={{ background: "#0a0a0a", position: "relative" }}>
            {/* Atmospheric glow */}
            <div aria-hidden style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)", pointerEvents: "none" }} />
            <div aria-hidden style={{ position: "absolute", bottom: -60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.03), transparent 70%)", pointerEvents: "none" }} />

            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="mb-3 text-xs tracking-[0.14em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Enterprise
                </p>
                <h2 className="text-2xl text-white sm:text-3xl" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                  Custom railway infrastructure
                  <br />
                  <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.5)" }}>for teams.</em>
                </h2>
                <p className="mt-4 text-sm leading-7" style={{ color: "rgba(255,255,255,0.45)", fontWeight: 300 }}>
                  Higher request limits, dedicated support, private infrastructure, and custom SLAs.
                  We&apos;ll build a plan around your production requirements.
                </p>
                <ul className="mt-5 space-y-2">
                  {["Custom request limits", "Dedicated support channel", "Private infrastructure options", "Custom SLA agreements"].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                      <span className="h-1 w-1 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.25)" }} aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <a href={contactUrl} target="_blank" rel="noreferrer noopener"
                className="pr-btn inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-6 py-3.5 text-sm font-medium text-white"
                style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", textDecoration: "none" }}>
                <Mail className="h-4 w-4" aria-hidden />
                Contact Enterprise
              </a>
            </div>
          </section>

          {/* ── Footer note ── */}
          <p className="mt-10 text-center text-xs leading-6 text-[#9ca3af]">
            By purchasing a premium plan, you are directly supporting this open-source project. Thank you.
          </p>

        </div>
      </main>

      {/* Payment modal */}
      {showPaymentModal && selectedPlan && (
        <PaymentModal
          selectedPlan={selectedPlan}
          billingInterval={billingInterval}
          isCreatingOrder={isCreatingOrder}
          onConfirm={startPayment}
          onCancel={() => { if (!isCreatingOrder) { setShowPaymentModal(false); setSelectedPlan(null); } }}
        />
      )}

      {/* Restart plan caution modal */}
      <RestartPlanCautionModal
        isOpen={showRestartWarningModal && !!selectedPlan}
        onProceed={() => {
          if (!selectedPlan) return;
          setShowRestartWarningModal(false);
          setShowPaymentModal(true);
        }}
        onCancel={() => {
          setShowRestartWarningModal(false);
          setSelectedPlan(null);
        }}
      />
    </div>
  );
}
