import crypto from "crypto";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import { getAuthTokenFromCookies, verifyAuthToken } from "@/lib/auth";

function createApiKey() {
  return `irctc_${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST() {
  try {
    await connectToDatabase();

    const token = await getAuthTokenFromCookies();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "unauthorized: missing token" },
        { status: 401 }
      );
    }

    const payload = verifyAuthToken(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, message: "unauthorized: invalid token" },
        { status: 401 }
      );
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.active || user.status === "banned") {
      return NextResponse.json(
        { success: false, message: "user not found or inactive" },
        { status: 404 }
      );
    }

    const newApiKey = createApiKey();
    user.apiKey = newApiKey;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: "API key regenerated successfully",
        apiKey: newApiKey,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Regenerate key route error:", error);
    return NextResponse.json(
      { success: false, message: "internal server error" },
      { status: 500 }
    );
  }
}
