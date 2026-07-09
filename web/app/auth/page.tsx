"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

const POST_MESSAGE_TYPE = "railkit:google-auth";
const OAUTH_STATE_COOKIE_NAME = "railkit_oauth_state";

type LoginApiResponse = {
  success: boolean;
  message?: string;
};

type PopupMessage = {
  type?: string;
  success?: boolean;
  message?: string;
};

async function waitForAuthSession(maxAttempts = 5, delayMs = 200) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetch("/api/user/verify", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success) return true;
      }
    } catch {
      // Keep retrying for short cookie-commit race after popup closes.
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}

function openGooglePopup(redirectUri: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error("Google client id is not configured"));
      return;
    }

    const state = crypto.randomUUID();
    // Short-lived cookie that the /api/auth/google/callback route
    // reads to validate the OAuth state. Cleared by the callback.
    document.cookie =
      OAUTH_STATE_COOKIE_NAME +
      "=" +
      encodeURIComponent(state) +
      "; path=/; max-age=600; samesite=lax" +
      (window.location.protocol === "https:" ? "; secure" : "");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      include_granted_scopes: "true",
      prompt: "select_account",
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const width = 500;
    const height = 620;
    const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - height) / 2));

    const popup = window.open(
      url,
      "irctc_google_oauth",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (!popup) {
      reject(
        new Error(
          "Popup was blocked. Please allow popups for this site and try again."
        )
      );
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PopupMessage;
      if (!data || data.type !== POST_MESSAGE_TYPE) return;
      window.removeEventListener("message", onMessage);
      clearInterval(pollClosed);
      if (data.success) {
        finish(resolve);
      } else {
        finish(() => reject(new Error(data.message || "Google login failed")));
      }
    };
    window.addEventListener("message", onMessage);

    const pollClosed = window.setInterval(() => {
      if (popup.closed) {
        window.removeEventListener("message", onMessage);
        clearInterval(pollClosed);
        finish(() => reject(new Error("Google sign in was cancelled.")));
      }
    }, 500);
  });
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always derive the redirect URI from the current origin so it matches
  // whatever host the user is on (localhost, staging, production, etc.).
  // The env var override exists for cases where Google must be told a
  // different URI than the one the browser actually visits.
  const redirectUri =
    process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/google/callback`
      : "/api/auth/google/callback");

  useEffect(() => {
    return () => {
      // no-op cleanup
    };
  }, []);

  const onGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await openGooglePopup(redirectUri);
      const sessionReady = await waitForAuthSession();
      if (!sessionReady) {
        throw new Error("Signed in, but session is still syncing. Please try again.");
      }
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="auth-root relative z-0 flex min-h-screen items-center justify-center bg-white px-6 pt-20 pb-12 sm:max-[480px]:px-5 sm:max-[480px]:pt-[72px] sm:max-[480px]:pb-10"
    >
      {/* Subtle radial atmosphere (matches the original ::before pseudo-element) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(0,0,0,0.025), transparent), radial-gradient(ellipse 50% 35% at 80% 80%, rgba(0,0,0,0.02), transparent)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center">
        <p className="auth-rise mb-5 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
          RailKit
        </p>

        <h1 className="auth-rise-delay-1 auth-heading mb-3 text-center text-[clamp(32px,6vw,44px)] font-normal leading-[1.05] tracking-[-0.025em] text-black">
          Your API key,
          <br />
          <em className="auth-heading-em">one click away.</em>
        </h1>

        <p className="auth-rise-delay-2 auth-body mb-8 max-w-[320px] text-center text-[14px] font-light leading-[1.7] text-[#6F6F6F]">
          Sign in with Google to access your developer workspace and start
          calling railway endpoints.
        </p>

        <div className="auth-rise-delay-3 auth-body w-full rounded-[24px] border border-black/[0.07] bg-white p-7 shadow-[0_8px_40px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] sm:max-[480px]:rounded-[20px] sm:max-[480px]:p-5">
          {error && (
            <p className="auth-rise auth-body mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={loading}
            className="auth-body auth-btn mb-5 flex w-full items-center justify-center gap-2.5 rounded-full border-none bg-black px-5 py-3.5 text-[14px] font-medium text-white transition-[background,transform] duration-150 hover:bg-[#1a1a1a] hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden className="inline-flex items-center">
              <svg viewBox="0 0 24 24" width="13" height="13">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.3H12z" />
                <path fill="#34A853" d="M3.4 7.4l3.2 2.4c.9-2.6 3.3-4.5 5.4-4.5 1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.3 12 2.3 8.1 2.3 4.7 4.5 3.4 7.4z" />
                <path fill="#FBBC05" d="M12 21.7c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-2 1.1-3.4 1.1-2.7 0-5-1.8-5.8-4.3l-3.2 2.5c1.3 2.9 4.7 5.6 9 5.6z" />
                <path fill="#4285F4" d="M21.6 14.4c.1-.4.1-.8.1-1.3S21.7 12 21.6 11H12v3.1h5.5c-.3 1.5-1.2 2.6-2.1 3.4l3 2.4c1.8-1.7 3.2-4.2 3.2-7.5z" />
              </svg>
            </span>
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Signing in…
              </>
            ) : (
              "Continue with Google"
            )}
          </button>

          <hr className="mb-[18px] border-0 border-t border-black/[0.06]" />

          <div className="flex flex-col gap-[9px]">
            {[
              "No password to remember.",
              "Your API key stays private inside your dashboard.",
              "Sign out or regenerate access anytime.",
            ].map((item) => (
              <div
                key={item}
                className="auth-body flex items-start gap-[9px] text-[12.5px] font-light leading-[1.55] text-[#6F6F6F]"
              >
                <CheckCircle2
                  size={14}
                  className="mt-px shrink-0 text-black"
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="auth-rise-delay-4 auth-body mt-[22px] max-w-[320px] text-center text-[12px] font-light leading-[1.6] text-neutral-400">
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            className="border-b border-neutral-200 pb-px text-[#6F6F6F] no-underline transition-[color,border-color] duration-150 hover:border-black hover:text-black"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="border-b border-neutral-200 pb-px text-[#6F6F6F] no-underline transition-[color,border-color] duration-150 hover:border-black hover:text-black"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <Link
          href="/"
          className="auth-rise-delay-5 auth-body mt-6 inline-flex items-center gap-1.5 text-[13px] text-neutral-400 no-underline transition-colors duration-150 hover:text-black"
        >
          <ArrowLeft size={13} />
          Back to home
        </Link>
      </div>
    </main>
  );
}
