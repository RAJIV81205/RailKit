import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import AuditLog from "@/lib/db/models/AuditLog";
import {
  getAuthCookieName,
  getAuthTokenFromCookies,
  verifyAuthToken,
} from "@/lib/auth";

export async function GET(request: Request) {
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

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { success: false, message: "unauthorized: invalid token payload" },
        { status: 401 }
      );
    }

    const user = await User.findById(payload.userId).lean();

    if (!user || !user.active) {
      const response = NextResponse.json(
        { success: false, message: "unauthorized: invalid user" },
        { status: 401 }
      );
      response.cookies.set(getAuthCookieName(), "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    if (user.status === "banned") {
      const response = NextResponse.json(
        { success: false, message: "unauthorized: account is banned" },
        { status: 403 }
      );
      response.cookies.set(getAuthCookieName(), "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const email = String(user.email || "").trim().toLowerCase();
    const { searchParams } = new URL(request.url);
    const daysParam = Number(searchParams.get("days") || 14);
    const timelineDays = daysParam === 30 ? 30 : 14;
    const now = new Date();
    const usageFromDate = new Date(now);
    usageFromDate.setDate(usageFromDate.getDate() - (timelineDays - 1));
    usageFromDate.setHours(0, 0, 0, 0);

    const [dailyUsageRaw, recentLogsRaw] = await Promise.all([
      AuditLog.aggregate([
        {
          $match: {
            email,
            createdAt: { $gte: usageFromDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            requests: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AuditLog.find({ email })
        .sort({ createdAt: -1 })
        .limit(50)
        .select("email statusCode path ip duration createdAt")
        .lean(),
    ]);

    const dailyUsageMap = new Map<string, number>(
      dailyUsageRaw.map((item: { _id: string; requests: number }) => [
        item._id,
        item.requests,
      ])
    );

    const dailyUsage = Array.from({ length: timelineDays }, (_, idx) => {
      const day = new Date(usageFromDate);
      day.setDate(usageFromDate.getDate() + idx);
      const date = day.toISOString().slice(0, 10);
      return {
        date,
        requests: dailyUsageMap.get(date) || 0,
      };
    });

    const recentLogs = recentLogsRaw.map((log) => ({
      id: log._id.toString(),
      email: log.email,
      statusCode: log.statusCode,
      path: log.path,
      ip: log.ip,
      duration: log.duration,
      createdAt: log.createdAt,
    }));

    return NextResponse.json(
      {
        success: true,
        message: "token verified",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          apiKey: user.apiKey,
          usage: user.usage,
          limit: user.limit,
          active: user.active,
          plan: user.plan,
          billingDate: user.billingDate,
          expirationDate: user.expirationDate,
          entitlementVersion: user.entitlementVersion ?? null,
          billingInterval: user.billingInterval ?? null,
          baseLimit: user.baseLimit ?? null,
          addonLimit: user.addonLimit ?? null,
        },
        logs: {
          timelineDays,
          dailyUsage,
          recent: recentLogs,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const response = NextResponse.json(
      { success: false, message: "unauthorized: invalid or expired token" },
      { status: 401 }
    );
    response.cookies.set(getAuthCookieName(), "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    console.error("Verify route error:", error);
    return response;
  }
}

export async function DELETE() {
  const response = NextResponse.json(
    { success: true, message: "logged out successfully" },
    { status: 200 }
  );

  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
