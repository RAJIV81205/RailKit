import { NextResponse } from "next/server";
import User from "@/lib/db/models/User";
import { connectToDatabase } from "@/lib/db/db";
import { getAuthTokenFromCookies, verifyAuthToken } from "@/lib/auth";
import {
  getAdvanceUpgradeQuote,
  UpgradeQuoteError,
} from "@/lib/billing/upgrade";

export async function GET() {
  try {
    await connectToDatabase();
    const token = await getAuthTokenFromCookies();
    const payload = token ? verifyAuthToken(token) : null;
    if (!payload?.userId)
      return NextResponse.json(
        { success: false, message: "unauthorized" },
        { status: 401 },
      );
    const user = await User.findById(payload.userId).lean();
    if (!user)
      return NextResponse.json(
        { success: false, message: "account not found" },
        { status: 401 },
      );
    const quote = getAdvanceUpgradeQuote(user);
    return NextResponse.json({
      success: true,
      quote: {
        ...quote,
        quotedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof UpgradeQuoteError)
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 409 },
      );
    console.error("Upgrade quote error:", error);
    return NextResponse.json(
      { success: false, message: "unable to calculate upgrade" },
      { status: 500 },
    );
  }
}
