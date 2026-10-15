import { NextResponse } from "next/server";

import {
  authenticateWithGoogleCode,
  buildAuthCookie,
} from "@/lib/auth/google";
import { readLimitedJson, RequestBodyTooLargeError } from "@/lib/security/body";

export async function POST(req: Request) {
  try {
    const body = await readLimitedJson<{ code?: unknown }>(req, 8 * 1024).catch((error) => {
      if (error instanceof RequestBodyTooLargeError) throw error;
      return { code: undefined };
    });
    const code = typeof body?.code === "string" && body.code.length <= 2048
      ? body.code
      : undefined;

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Authorization code is required" },
        { status: 400 }
      );
    }

    const result = await authenticateWithGoogleCode(code, req);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        action: result.action,
        user: result.user,
      },
      { status: result.action === "register" ? 201 : 200 }
    );

    const cookie = buildAuthCookie(result.token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);

    return response;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 413 });
    }
    console.error("Google login route error:", error);
    return NextResponse.json(
      { success: false, message: "Authentication failed" },
      { status: 500 }
    );
  }
}
