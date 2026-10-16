import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import AuditLog from "@/lib/db/models/AuditLog";
import { getActiveAdmin } from "@/lib/auth/admin";

async function verifyRequest() {
  return getActiveAdmin();
}

export async function GET() {
  try {
    const admin = await verifyRequest();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const timelineDays = 14;

    await connectToDatabase();

    // Start of the window (beginning of day, timelineDays ago)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (timelineDays - 1));
    startDate.setHours(0, 0, 0, 0);

    // Daily usage aggregation across ALL users
    const dailyUsageAgg = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
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
    ]);

    // Fill in every date in the window with 0 if no data
    const dailyUsageMap = new Map<string, number>(
      dailyUsageAgg.map((item: { _id: string; requests: number }) => [
        item._id,
        item.requests,
      ])
    );

    const dailyUsage = Array.from({ length: timelineDays }, (_, idx) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + idx);
      const dateStr = day.toISOString().slice(0, 10);
      return {
        date: dateStr,
        requests: dailyUsageMap.get(dateStr) || 0,
      };
    });

    // Most recent 100 logs across all users, newest first
    const recentLogsRaw = await AuditLog.find({ createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("email trainNo userAgent referer statusCode path ip duration source createdAt")
      .lean();

    const recent = recentLogsRaw.map((log) => ({
      id: (log._id as { toString(): string }).toString(),
      email: log.email as string,
      trainNo: (log.trainNo as string | null) || null,
      userAgent: (log.userAgent as string | null) || null,
      referer: (log.referer as string | null) || null,
      statusCode: log.statusCode as number,
      path: log.path as string,
      ip: log.ip as string,
      duration: log.duration as number,
      source: (log.source as string) || "Unknown",
      createdAt: (log.createdAt instanceof Date
        ? log.createdAt
        : new Date(log.createdAt as string)
      ).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      logs: {
        timelineDays,
        dailyUsage,
        recent,
      },
    });
  } catch (error) {
    console.error("Admin logs fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch logs",
      },
      { status: 500 }
    );
  }
}
