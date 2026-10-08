import { NextRequest, NextResponse } from "next/server";
import { rejectNonFirstPartyRequest } from "@/lib/rail-atlas-origin";
import { RAIL_ATLAS_TOKEN_TTL_SECONDS, setRailAtlasAccessCookie } from "@/lib/rail-atlas-token";

export const dynamic = "force-dynamic";

type TurnstileVerification = {
  success?: boolean;
  hostname?: string;
  action?: string;
};

export async function POST(request: NextRequest) {
  const originError = rejectNonFirstPartyRequest(request);
  if (originError) return originError;

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
      if (!verificationResponse.ok
        || !verification.success
        || verification.hostname !== request.nextUrl.hostname
        || verification.action !== "rail_atlas_access") {
        return NextResponse.json({ success: false, error: "Security check failed. Reload the page and try again." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ success: false, error: "Security check is temporarily unavailable." }, { status: 503 });
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
