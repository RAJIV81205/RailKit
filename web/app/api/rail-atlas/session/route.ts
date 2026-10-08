import { NextRequest, NextResponse } from "next/server";
import { rejectNonFirstPartyRequest } from "@/lib/rail-atlas-origin";
import { RAIL_ATLAS_TOKEN_TTL_SECONDS, setRailAtlasAccessCookie } from "@/lib/rail-atlas-token";

export const dynamic = "force-dynamic";

type TurnstileVerification = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: unknown;
};

export async function POST(request: NextRequest) {
  const originError = rejectNonFirstPartyRequest(request);
  if (originError) return originError;

  const requestId = crypto.randomUUID();

  const isLocalDevelopment = process.env.NODE_ENV !== "production"
    && request.nextUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (process.env.NODE_ENV === "production" && (!secret || !siteKey)) {
    return NextResponse.json(
      { success: false, error: "Rail Atlas security check is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (secret && siteKey && !isLocalDevelopment) {
    const body = await request.json().catch(() => null) as { turnstileToken?: unknown } | null;
    const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";
    if (!turnstileToken || turnstileToken.length > 2048) {
      return NextResponse.json({ success: false, error: "Complete the security check and try again." }, { status: 400 });
    }

    try {
      const form = new URLSearchParams({ secret, response: turnstileToken });
      const verificationResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const verification = await verificationResponse.json() as TurnstileVerification;
      const hostnameMatches = verification.hostname === request.nextUrl.hostname;
      const actionMatches = verification.action === "rail_atlas_access";
      if (!verificationResponse.ok || !verification.success || !hostnameMatches || !actionMatches) {
        // Never log the submitted token, secret, or raw Siteverify response.
        console.warn("[rail-atlas] Turnstile verification rejected", {
          requestId,
          httpStatus: verificationResponse.status,
          success: Boolean(verification.success),
          errorCodes: Array.isArray(verification["error-codes"])
            ? verification["error-codes"].filter((code): code is string => typeof code === "string")
            : [],
          hostname: verification.hostname ?? null,
          expectedHostname: request.nextUrl.hostname,
          hostnameMatches,
          action: verification.action ?? null,
          actionMatches,
        });
        return NextResponse.json(
          { success: false, error: "Security check failed. Reload the page and try again.", requestId },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
    } catch (error) {
      console.error("[rail-atlas] Turnstile verification request failed", {
        requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json(
        { success: false, error: "Security check is temporarily unavailable.", requestId },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Security check is not configured." }, { status: 503 });
  }

  const response = NextResponse.json({ success: true, expiresIn: RAIL_ATLAS_TOKEN_TTL_SECONDS }, {
    headers: { "Cache-Control": "no-store" },
  });
  if (!setRailAtlasAccessCookie(response)) {
    return NextResponse.json({ success: false, error: "Rail Atlas token signing is not configured." }, { status: 503 });
  }
  return response;
}
