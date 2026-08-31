import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import { signAuthToken, getAuthCookieName } from "@/lib/auth";

export type GoogleAuthSuccess = {
  ok: true;
  action: "login" | "register";
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    apiKey: string;
    usage: number;
    limit: number;
    plan: "free" | "pro" | "enterprise";
  };
};

export type GoogleAuthFailure = {
  ok: false;
  status: number;
  message: string;
};

export type GoogleAuthResult = GoogleAuthSuccess | GoogleAuthFailure;

function getGoogleClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth client is not configured (missing GOOGLE_CLIENT_ID/SECRET)"
    );
  }
  return new OAuth2Client(clientId, clientSecret);
}

export function getGoogleRedirectUri(req: Request) {
  if (process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;
  }

  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.headers.get("host")?.startsWith("localhost") ? "http" : "https");
  const host = req.headers.get("host");
  if (host) {
    return `${proto}://${host}/api/auth/google/callback`;
  }

  if (process.env.APP_BASE_URL) {
    return `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/auth/google/callback`;
  }

  return "";
}

function createApiKey() {
  return `railkit_${crypto.randomBytes(24).toString("hex")}`;
}

function fallbackNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "user";
  return localPart.replace(/[._-]+/g, " ").trim() || "user";
}

export async function authenticateWithGoogleCode(
  code: string,
  req: Request,
  redirectUriOverride?: string,
): Promise<GoogleAuthResult> {
  await connectToDatabase();

  const googleClient = getGoogleClient();
  const redirectUri = redirectUriOverride || getGoogleRedirectUri(req);

  const { tokens } = await googleClient.getToken({
    code,
    redirect_uri: redirectUri,
  });

  if (!tokens.id_token) {
    return {
      ok: false,
      status: 401,
      message: "Google did not return an id_token",
    };
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    return { ok: false, status: 401, message: "Invalid Google token" };
  }

  if (!payload.email_verified) {
    return {
      ok: false,
      status: 401,
      message: "Google email is not verified",
    };
  }

  const email = payload.email?.trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      status: 401,
      message: "Google account does not contain an email",
    };
  }

  const name = payload.name?.trim() || fallbackNameFromEmail(email);

  let user = await User.findOne({ email });

  let authAction: "login" | "register" = "login";

  if (!user) {
    user = await User.create({
      name,
      email,
      apiKey: createApiKey(),
      plan: "free",
      limit: 50,
      active: true,
      status: "clean",
    });
    authAction = "register";
  } else if (name && user.name !== name) {
    user = await User.findByIdAndUpdate(
      user._id,
      { name },
      { new: true }
    );
  }

  if (!user) {
    return {
      ok: false,
      status: 500,
      message: "Unable to load user",
    };
  }

  if (!user.active) {
    return {
      ok: false,
      status: 403,
      message: "User account is inactive",
    };
  }

  if (user.status === "banned") {
    return {
      ok: false,
      status: 403,
      message: "User account is banned",
    };
  }

  const token = signAuthToken({
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    plan: user.plan,
  });

  return {
    ok: true,
    action: authAction,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      apiKey: user.apiKey,
      usage: user.usage,
      limit: user.limit,
      plan: user.plan,
    },
  };
}

export function buildAuthCookie(token: string) {
  return {
    name: getAuthCookieName(),
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    },
  };
}
