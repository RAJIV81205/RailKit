import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "rail_atlas_access";
export const RAIL_ATLAS_TOKEN_TTL_SECONDS = 5 * 60;

function getTokenSecret() {
  const configuredSecret = process.env.RAIL_ATLAS_TOKEN_SECRET;
  if (configuredSecret && configuredSecret.length >= 32) return configuredSecret;
  if (process.env.NODE_ENV !== "production") return "local-only-rail-atlas-token-secret-do-not-deploy";
  return null;
}

export function setRailAtlasAccessCookie(response: NextResponse) {
  const secret = getTokenSecret();
  if (!secret) return false;

  const token = jwt.sign({ scope: "rail-atlas:read" }, secret, {
    algorithm: "HS256",
    audience: "railkit-web",
    issuer: "railkit-rail-atlas",
    expiresIn: RAIL_ATLAS_TOKEN_TTL_SECONDS,
    jwtid: crypto.randomUUID(),
  });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/rail-atlas",
    maxAge: RAIL_ATLAS_TOKEN_TTL_SECONDS,
  });
  return true;
}

export function hasValidRailAtlasAccess(request: NextRequest) {
  const secret = getTokenSecret();
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!secret || !token) return false;

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      audience: "railkit-web",
      issuer: "railkit-rail-atlas",
    });
    return typeof payload !== "string" && payload.scope === "rail-atlas:read";
  } catch {
    return false;
  }
}

export function rejectMissingRailAtlasAccess(request: NextRequest) {
  if (hasValidRailAtlasAccess(request)) return null;
  return NextResponse.json(
    { success: false, error: "Rail Atlas access expired. Reload the page and try again." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
