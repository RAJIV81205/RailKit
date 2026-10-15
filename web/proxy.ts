import { NextRequest, NextResponse } from "next/server";
import { getApiRequestRejection } from "@/lib/security/request-policy";

export function proxy(request: NextRequest) {
  const rejection = getApiRequestRejection(request);
  if (rejection) {
    return NextResponse.json(
      { success: false, message: rejection.message },
      { status: rejection.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
