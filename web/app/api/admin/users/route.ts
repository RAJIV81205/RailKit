import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import { getAdminAuthTokenFromCookies, verifyAdminAuthToken } from "@/lib/auth";

async function verifyRequest() {
  const token = await getAdminAuthTokenFromCookies();
  if (!token) return null;
  const payload = verifyAdminAuthToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

export async function GET() {
  try {
    const admin = await verifyRequest();
    if (!admin)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );

    await connectToDatabase();
    const users = await User.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await verifyRequest();
    if (!admin)
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );

    await connectToDatabase();
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request body" },
        { status: 400 },
      );
    }

    const { _id, ...rawUpdates } = body as Record<string, unknown>;

    if (!_id)
      return NextResponse.json(
        { success: false, message: "User ID missing" },
        { status: 400 },
      );


    const updates: Record<string, unknown> = {};
    const allowedFields = [
      "plan",
      "active",
      "usage",
      "limit",
      "billingDate",
      "expirationDate",
      "bannedUntil",
      "whitelisted",
    ] as const;

    for (const field of allowedFields) {
      if (field in rawUpdates) updates[field] = rawUpdates[field];
    }

    // Moderation status (clean / flagged / banned). When provided, append a statusReasons
    // entry so the audit trail is preserved.
    const VALID_STATUSES = ["clean", "flagged", "banned"] as const;
    type ModerationStatus = (typeof VALID_STATUSES)[number];
    let nextStatus: ModerationStatus | undefined;
    if ("status" in rawUpdates) {
      const candidate = rawUpdates.status;
      if (typeof candidate !== "string" || !VALID_STATUSES.includes(candidate as ModerationStatus)) {
        return NextResponse.json(
          { success: false, message: "Invalid status" },
          { status: 400 },
        );
      }
      nextStatus = candidate as ModerationStatus;
    }

    const reason = typeof rawUpdates.statusReason === "string" ? rawUpdates.statusReason.trim() : "";
    const note = typeof rawUpdates.statusNote === "string" ? rawUpdates.statusNote.trim() : "";
    const moderator = admin.email || admin.userId || "admin";
    const now = new Date();

    const existingUser = await User.findById(_id).select("status statusReasons flaggedAt bannedAt bannedBy bannedUntil whitelisted");
    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    if (nextStatus && nextStatus !== existingUser.status) {
      const now = new Date();
      const entry = {
        reason: reason || `Status changed to ${nextStatus}`,
        by: moderator,
        at: now,
        note: note || null,
      };

      const nextReasons = [...((existingUser.statusReasons as unknown as Array<typeof entry>) || []), entry];

      if (nextStatus === "banned") {
        updates.status = "banned";
        updates.flaggedAt = existingUser.flaggedAt ?? null;
        updates.bannedAt = now;
        updates.bannedBy = moderator;
        if (!("bannedUntil" in rawUpdates) && !("bannedUntil" in updates)) {
          updates.bannedUntil = new Date(now.getTime() + 12 * 60 * 60 * 1000);
        }
      } else if (nextStatus === "flagged") {
        updates.status = "flagged";
        updates.flaggedAt = now;
        updates.bannedAt = null;
        updates.bannedUntil = null;
        updates.bannedBy = null;
      } else {
        // clean
        updates.status = "clean";
        updates.flaggedAt = null;
        updates.bannedAt = null;
        updates.bannedUntil = null;
        updates.bannedBy = null;
      }
      updates.statusReasons = nextReasons;
    } else if (nextStatus === existingUser.status && reason) {
      // No status change but a follow-up note — append to the log without touching timestamps.
      const entry = {
        reason,
        by: moderator,
        at: new Date(),
        note: note || null,
      };
      const nextReasons = [...((existingUser.statusReasons as unknown as Array<typeof entry>) || []), entry];
      updates.statusReasons = nextReasons;
    }

    const normalizeNullableDate = (value: unknown) => {
      if (value === null || value === "") return null;
      if (typeof value !== "string") return undefined;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return undefined;
      return parsed;
    };

    if ("billingDate" in updates) {
      const normalized = normalizeNullableDate(updates.billingDate);
      if (normalized === undefined) {
        return NextResponse.json(
          { success: false, message: "Invalid billingDate" },
          { status: 400 },
        );
      }
      updates.billingDate = normalized;
    }

    if ("expirationDate" in updates) {
      const normalized = normalizeNullableDate(updates.expirationDate);
      if (normalized === undefined) {
        return NextResponse.json(
          { success: false, message: "Invalid expirationDate" },
          { status: 400 },
        );
      }
      updates.expirationDate = normalized;
    }

    if ("bannedUntil" in updates) {
      const normalized = normalizeNullableDate(updates.bannedUntil);
      if (normalized === undefined) {
        return NextResponse.json(
          { success: false, message: "Invalid bannedUntil" },
          { status: 400 },
        );
      }
      updates.bannedUntil = normalized;
    }

    const user = await User.findByIdAndUpdate(_id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user)
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
