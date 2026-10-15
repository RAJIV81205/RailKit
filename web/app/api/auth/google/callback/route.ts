import { NextResponse } from "next/server";

import {
  authenticateWithGoogleCode,
  buildAuthCookie,
} from "@/lib/auth/google";

const POST_MESSAGE_TYPE = "railkit:google-auth";
const STATE_COOKIE_NAME =
  process.env.OAUTH_STATE_COOKIE_NAME || "railkit_oauth_state";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function renderShim(payload: {
  type: string;
  success: boolean;
  message?: string;
}) {
  const safe = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Signing in…</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
             display: flex; min-height: 100vh; align-items: center; justify-content: center;
             color: #6F6F6F; font-size: 13px; font-weight: 300; margin: 0; }
      p { text-align: center; padding: 0 16px; }
    </style>
  </head>
  <body>
    <p>${escapeHtml(payload.success ? "Signed in. Redirecting…" : (payload.message || "Sign in failed."))}</p>
    <script>
      (function () {
        var payload = ${safe};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, window.location.origin);
          }
        } catch (e) {}
        setTimeout(function () { try { window.close(); } catch (e) {} }, 50);
      })();
    </script>
  </body>
</html>`;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const target = name + "=";
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Build the redirect_uri the same way the popup used it, so the
  // token exchange matches exactly. This is the same logic the popup
  // uses on the client.
  const expectedState = parseCookie(
    req.headers.get("cookie") || "",
    STATE_COOKIE_NAME
  );

  function shimResponse(
    success: boolean,
    message?: string,
    options: { setAuthCookie?: string; clearStateCookie?: boolean } = {}
  ) {
    const body = renderShim({
      type: POST_MESSAGE_TYPE,
      success,
      message,
    });
    const response = new NextResponse(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    if (options.setAuthCookie) {
      const cookie = buildAuthCookie(options.setAuthCookie);
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    if (options.clearStateCookie) {
      response.cookies.set(STATE_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  }

  if (oauthError) {
    const description =
      url.searchParams.get("error_description") || oauthError;
    return shimResponse(false, description, { clearStateCookie: true });
  }

  if (!code || !state) {
    return shimResponse(false, "Missing authorization code or state", {
      clearStateCookie: true,
    });
  }

  if (!expectedState) {
    return shimResponse(false, "OAuth state cookie missing", {
      clearStateCookie: true,
    });
  }

  if (expectedState !== state) {
    return shimResponse(false, "OAuth state validation failed", {
      clearStateCookie: true,
    });
  }

  const result = await authenticateWithGoogleCode(code, req);

  if (!result.ok) {
    return shimResponse(false, result.message, { clearStateCookie: true });
  }

  return shimResponse(true, undefined, {
    setAuthCookie: result.token,
    clearStateCookie: true,
  });
}
