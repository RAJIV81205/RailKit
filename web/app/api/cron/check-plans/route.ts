import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import { sendBillingExpiredEmail } from "@/lib/services/email";
import { syncV2Entitlement } from "@/lib/billing/entitlements";

/**
 * Daily cron job to check and update user plans based on billing dates.
 * Triggered by GitHub Actions at midnight.
 *
 * Rules:
 * - If expirationDate is set and in the future, skip 30-day billing checks
 * - If expirationDate is set and has passed, set expirationDate to null
 * - Pro/Enterprise: If 30 days passed since billing date, downgrade to free with limit 50 and usage 0
 * - Free: If 30 days passed since billing date, reset limit to 50
 * - Paid expiry email: send transactional email during downgrade
 * - On billing downgrade/reset: clear both expirationDate and billingDate to null
 *
 * FIXES APPLIED:
 * 1. Promise.all → Promise.allSettled: single user failure no longer kills entire batch
 * 2. CRON_SECRET empty-string guard: "" now treated as misconfigured, not valid
 * 3. Structured error logging per user failure
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

async function verifyCronSecret(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // FIX 2: Treat missing OR empty CRON_SECRET as misconfiguration.
  // Previously: !cronSecret only caught undefined/null, not "".
  // Now: .trim() ensures empty-string env var is also rejected with a clear error.
  if (!cronSecret || cronSecret.trim() === "") {
    console.error(
      "[cron] CRON_SECRET is not configured or is empty. " +
      "Set a non-empty CRON_SECRET environment variable."
    );
    return false;
  }

  if (!authHeader) {
    return false;
  }

  // Support "Bearer <secret>" or raw secret
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return token === cronSecret;
}

// ─── POST: main cron handler ──────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const isAuthorized = await verifyCronSecret(req);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Invalid cron secret" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch users that need any kind of update:
    //   (a) expired manual expirationDate that needs clearing, OR
    //   (b) billingDate older than 30 days with no active expiration override
    const users = await User.find({
      $or: [
        // (a) manual expiry has passed → clear it
        { expirationDate: { $ne: null, $lte: now } },
        // (b) billing window elapsed and no active expiry override
        {
          billingDate: { $lte: thirtyDaysAgo, $ne: null },
          $or: [
            { expirationDate: null },
            { expirationDate: { $lte: now } },
          ],
        },
        { entitlementVersion: 2, quotaPeriodEnd: { $lte: now } },
      ],
    });

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No users found requiring expiration/billing updates",
          updated: 0,
        },
        { status: 200 }
      );
    }

    // After downgrade/reset, billingDate = null so user is excluded from later cron runs.
    // Expiry email is sent only in same execution path as paid-plan downgrade.

    const updatePromises = users.map(async (user) => {
      if (user.entitlementVersion === 2) {
        const result = syncV2Entitlement(user, now);
        if (!result.changed) return user;
        const savedUser = await user.save();
        if (result.expired) {
          await sendBillingExpiredEmail({ name: savedUser.name, email: savedUser.email });
        }
        return savedUser;
      }

      // Snapshot booleans from DB state BEFORE any mutations
      const hasActiveExpiration =
        user.expirationDate != null &&
        new Date(user.expirationDate).getTime() > now.getTime();

      const hasExpiredExpiration =
        user.expirationDate != null &&
        new Date(user.expirationDate).getTime() <= now.getTime();

      const hasExpiredBilling =
        user.billingDate != null &&
        new Date(user.billingDate).getTime() <= thirtyDaysAgo.getTime();

      let shouldSendBillingExpiredEmail = false;

      // Step 1: Clear expired manual expiry
      if (hasExpiredExpiration) {
        user.expirationDate = null;
      }

      // Step 2: Expired paid plans downgrade immediately. Legacy billing-only
      // plans still use the 30-day billing window.
      if (!hasActiveExpiration) {
        if (user.plan === "pro" || user.plan === "enterprise") {
          if (!hasExpiredExpiration && !hasExpiredBilling) {
            return user;
          }
          user.plan = "free";
          user.limit = 50;
          user.usage = 0;
          shouldSendBillingExpiredEmail = true;
          user.billingDate = null;
          user.expirationDate = null; // defensive clear
        } else if (user.plan === "free" && hasExpiredBilling) {
          user.limit = 50;
          user.usage = 0;
          user.billingDate = null;
          user.expirationDate = null; // defensive clear
        }
      }

      const savedUser = await user.save();

      if (shouldSendBillingExpiredEmail) {
        await sendBillingExpiredEmail({
          name: savedUser.name,
          email: savedUser.email,
        });
      }

      return savedUser;
    });

    // Promise.allSettled keeps other users processing even if one save/email fails.
    const settled = await Promise.allSettled(updatePromises);

    const succeeded: Array<{
      userId: string;
      email: string;
      plan: string;
      limit: number;
      usage: number;
      billingDate: Date | null;
      expirationDate: Date | null;
    }> = [];
    const failed: { userId: string; reason: string }[] = [];

    settled.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        const user = result.value;
        succeeded.push({
          userId: String(user._id),
          email: user.email,
          plan: user.plan,
          limit: user.limit,
          usage: user.usage,
          billingDate: user.billingDate ?? null,
          expirationDate: user.expirationDate ?? null,
        });
      } else {
        // Log full error server-side; return only safe summary to caller
        const user = users[idx];
        console.error(
          `[cron] Failed to save user ${user?._id} (${user?.email}):`,
          result.reason
        );
        failed.push({
          userId: String(user?._id ?? "unknown"),
          reason:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    // Return 207 Multi-Status when some updates failed so callers/monitors can alert
    const status = failed.length > 0 ? 207 : 200;

    return NextResponse.json(
      {
        success: failed.length === 0,
        message:
          failed.length === 0
            ? "Plan check completed successfully"
            : `Plan check completed with ${failed.length} error(s)`,
        updated: succeeded.length,
        failed: failed.length,
      },
      { status }
    );
  } catch (error) {
    console.error("[cron] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ─── GET: health check ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const isAuthorized = await verifyCronSecret(req);
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Cron endpoint is healthy and ready",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[cron] Health check error:", error);
    return NextResponse.json(
      { success: false, message: "Service unavailable" },
      { status: 503 }
    );
  }
}
