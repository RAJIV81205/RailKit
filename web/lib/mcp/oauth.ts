import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

type CodePayload = {
  type: "code";
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  railkitApiKey: string;
  email: string;
  name: string;
  exp: number;
};

type AccessPayload = {
  type: "access";
  railkitApiKey: string;
  email: string;
  name: string;
  exp: number;
};

type GoogleStatePayload = {
  type: "google_state";
  nonce: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  oauthState: string;
  exp: number;
};

function keys() {
  const secrets = [process.env.MCP_OAUTH_SECRET, process.env.JWT_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );
  if (!secrets.length) throw new Error("MCP_OAUTH_SECRET or JWT_SECRET is not set");
  return [...new Set(secrets)].map((secret) => createHash("sha256").update(secret).digest());
}

const encode = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url");

function seal(payload: CodePayload | AccessPayload | GoogleStatePayload | { redirectUris: string[]; exp: number }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return `mcp_${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(encrypted)}`;
}

function open<T>(value: string) {
  const parts = value.startsWith("mcp_") ? value.slice("mcp_".length).split(".") : null;
  if (!parts || parts.length !== 3) return null;
  try {
    for (const secretKey of keys()) {
      try {
        const decipher = createDecipheriv("aes-256-gcm", secretKey, decode(parts[0]));
        decipher.setAuthTag(decode(parts[1]));
        return JSON.parse(Buffer.concat([decipher.update(decode(parts[2])), decipher.final()]).toString("utf8")) as T;
      } catch {
        // Try next configured key for clients registered before secret rotation.
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function createClientId(redirectUris: string[]) {
  return seal({ redirectUris, exp: Date.now() + 365 * 24 * 60 * 60 * 1000 });
}

export function isAllowedRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function getClient(clientId: string) {
  const client = open<{ redirectUris: string[]; exp: number }>(clientId);
  return client && client.exp > Date.now() ? client : null;
}

export function createAuthorizationCode(payload: Omit<CodePayload, "type" | "exp">) {
  return seal({ ...payload, type: "code", exp: Date.now() + 5 * 60 * 1000 });
}

export function createGoogleState(payload: Omit<GoogleStatePayload, "type" | "exp">) {
  return seal({ ...payload, type: "google_state", exp: Date.now() + 10 * 60 * 1000 });
}

export function getGoogleState(value: string) {
  const payload = open<GoogleStatePayload>(value);
  return payload && payload.type === "google_state" && payload.exp > Date.now() ? payload : null;
}

export function exchangeAuthorizationCode(code: string, clientId: string, redirectUri: string, verifier: string) {
  const payload = open<CodePayload>(code);
  if (!payload || payload.type !== "code" || payload.exp < Date.now()) return null;
  if (payload.clientId !== clientId || payload.redirectUri !== redirectUri) return null;
  const expected = createHash("sha256").update(verifier).digest("base64url");
  if (expected.length !== payload.codeChallenge.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(payload.codeChallenge))) return null;
  return { railkitApiKey: payload.railkitApiKey, email: payload.email, name: payload.name };
}

export function createAccessToken(payload: Omit<AccessPayload, "type" | "exp">) {
  return seal({ type: "access", ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
}

export function getRailkitKeyFromAccessToken(token: string) {
  const payload = open<AccessPayload>(token);
  return payload && payload.type === "access" && payload.exp > Date.now() ? payload.railkitApiKey : null;
}

export function getUserFromAccessToken(token: string) {
  const payload = open<AccessPayload>(token);
  return payload && payload.type === "access" && payload.exp > Date.now()
    ? { email: payload.email, name: payload.name }
    : null;
}
