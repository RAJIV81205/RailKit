import jwt, { JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "irctc_auth_token";
const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || "irctc_admin_token";
const JWT_EXPIRES_IN = "7d";

export type AuthTokenPayload = JwtPayload & {
  userId: string;
  email: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
};

export type AdminAuthTokenPayload = JwtPayload & {
  email: string;
  name: string;
  role: "admin";
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signAuthToken(payload: Omit<AuthTokenPayload, "iat" | "exp">) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function signAdminAuthToken(payload: Omit<AdminAuthTokenPayload, "iat" | "exp">) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "24h",
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as AuthTokenPayload;
  } catch { return null }
}

export function verifyAdminAuthToken(token: string): AdminAuthTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as AdminAuthTokenPayload;
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    return payload.role === "admin" && adminEmail && payload.email?.toLowerCase() === adminEmail
      ? payload
      : null;
  } catch { return null }
}

export function getAuthCookieName() {
  return COOKIE_NAME;
}

export function getAdminCookieName() {
  return ADMIN_COOKIE_NAME;
}

export async function getAuthTokenFromCookies() {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || null;
}

export async function getAdminAuthTokenFromCookies() {
  const store = await cookies();
  return store.get(ADMIN_COOKIE_NAME)?.value || null;
}

