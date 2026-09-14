import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import {
  getAdminCookieName,
  getAuthTokenFromCookies,
  signAdminAuthToken,
  verifyAuthToken,
} from "@/lib/auth";

export async function POST() {
  try {
    await connectToDatabase();
    const authToken = await getAuthTokenFromCookies();
    const payload = authToken ? verifyAuthToken(authToken) : null;
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!payload?.userId || !payload.email || !adminEmail) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(payload.userId).lean();
    const email = user?.email?.trim().toLowerCase();
    if (!user || !user.active || user.status === "banned" || email !== adminEmail) {
      return NextResponse.json({ success: false, message: "Unauthorized: Not an admin" }, { status: 403 });
    }

    const token = signAdminAuthToken({
      email,
      name: user.name || payload.name || "Admin",
      role: "admin",
    });

    const response = NextResponse.json({
      success: true,
      message: "Admin login successful",
      user: { email, name: user.name || payload.name || "Admin", role: "admin" },
    }, { status: 200 });

    response.cookies.set(getAdminCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Admin Login route error:", error);
    return NextResponse.json({ success: false, message: "internal server error" }, { status: 500 });
  }
}
