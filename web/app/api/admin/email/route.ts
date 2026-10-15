import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import { getActiveAdmin } from "@/lib/auth/admin";
import { sendRawHtmlEmail, sendRawHtmlEmailBatch } from "@/lib/services/email";
import { reminder_template } from "@/lib/services/templates.email";

const BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;
const BATCH_INTERVAL_MS = 250;
const RETRY_BASE_DELAY_MS = 250;
const MAX_RATE_LIMIT_RETRIES = 3;

const EMAIL_AUDIENCE_FILTERS = [
  "all_users",
  "free_users",
  "pro_users",
  "advance_users",
  "paid_users",
  "active_users",
  "inactive_users",
  "billing_7_days_left",
  "billing_3_days_left",
  "billing_1_day_left",
  "billing_within_7_days",
  "billing_expired",
] as const;

type EmailAudienceFilter = (typeof EMAIL_AUDIENCE_FILTERS)[number];

type EmailTargetUser = {
  email: string;
  plan?: string;
  active?: boolean;
  billingDate?: Date | string | null;
};

async function verifyRequest() {
  return getActiveAdmin();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function getBillingDaysLeft(user: EmailTargetUser): number | null {
  if (!user.billingDate) return null;

  const billingStart = new Date(user.billingDate).getTime();
  if (Number.isNaN(billingStart)) return null;

  const billingEndsAt = billingStart + BILLING_CYCLE_MS;
  const remainingMs = billingEndsAt - Date.now();
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

function matchesAudienceFilter(user: EmailTargetUser, filter: EmailAudienceFilter): boolean {
  const plan = (user.plan || "").toLowerCase();
  const isFree = plan === "free";
  const isPro = plan === "pro";
  const isAdvance = plan === "enterprise" || plan === "advance";
  const isPaid = isPro || isAdvance;
  const daysLeft = getBillingDaysLeft(user);

  switch (filter) {
    case "all_users":
      return true;
    case "free_users":
      return isFree;
    case "pro_users":
      return isPro;
    case "advance_users":
      return isAdvance;
    case "paid_users":
      return isPaid;
    case "active_users":
      return user.active === true;
    case "inactive_users":
      return user.active === false;
    case "billing_7_days_left":
      return isPaid && daysLeft === 7;
    case "billing_3_days_left":
      return isPaid && daysLeft === 3;
    case "billing_1_day_left":
      return isPaid && daysLeft === 1;
    case "billing_within_7_days":
      return isPaid && daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
    case "billing_expired":
      return isPaid && daysLeft !== null && daysLeft <= 0;
    default:
      return true;
  }
}

function getFilterLabel(filter: EmailAudienceFilter): string {
  switch (filter) {
    case "all_users":
      return "all users";
    case "free_users":
      return "free users";
    case "pro_users":
      return "pro users";
    case "advance_users":
      return "advance users";
    case "paid_users":
      return "paid users";
    case "active_users":
      return "active users";
    case "inactive_users":
      return "inactive users";
    case "billing_7_days_left":
      return "users with 7 billing days left";
    case "billing_3_days_left":
      return "users with 3 billing days left";
    case "billing_1_day_left":
      return "users with 1 billing day left";
    case "billing_within_7_days":
      return "users billing within 7 days";
    case "billing_expired":
      return "users with expired billing";
    default:
      return "selected users";
  }
}

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybeError = error as { name?: string; statusCode?: number; message?: string };
  return (
    maybeError.name === "rate_limit_exceeded" ||
    maybeError.statusCode === 429 ||
    maybeError.message?.toLowerCase().includes("too many requests") === true
  );
}

async function sendEmailWithRetry(params: { to: string; subject: string; html: string }) {
  let attempt = 0;
  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    try {
      await sendRawHtmlEmail(params);
      return;
    } catch (error) {
      if (!isRateLimitError(error) || attempt === MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }
      attempt += 1;
      await sleep((attempt + 1) * RETRY_BASE_DELAY_MS);
    }
  }
}

async function sendBatchEmailWithRetry(params: {
  emails: Array<{ to: string; subject: string; html: string }>;
}) {
  let attempt = 0;
  while (attempt <= MAX_RATE_LIMIT_RETRIES) {
    try {
      return await sendRawHtmlEmailBatch(params);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }
      attempt += 1;
      await sleep((attempt + 1) * RETRY_BASE_DELAY_MS);
    }
  }

  return { sentCount: 0, failedEmails: params.emails.map((email) => email.to) };
}

type EmailRequestBody = {
  scope?: "single" | "all" | "manual" | "reminder";
  userId?: string;
  userIds?: string[];
  email?: string;
  subject?: string;
  html?: string;
  filter?: EmailAudienceFilter;
};

export async function POST(req: Request) {
  try {
    const admin = await verifyRequest();
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as EmailRequestBody;
    const scope = body.scope;
    const subject = body.subject?.trim();
    const html = body.html?.trim();
    const filter = (body.filter || "all_users") as EmailAudienceFilter;

    if (!scope || (scope !== "single" && scope !== "all" && scope !== "manual" && scope !== "reminder")) {
      return NextResponse.json({ success: false, message: "Invalid email scope" }, { status: 400 });
    }

    // ── Reminder scope — sends the fixed reminder template to a direct email ──
    if (scope === "reminder") {
      const to = body.email?.trim();
      if (!to) {
        return NextResponse.json({ success: false, message: "email is required for reminder" }, { status: 400 });
      }

      await sendEmailWithRetry({
        to,
        subject: reminder_template.subject,
        html: reminder_template.text,
      });

      return NextResponse.json(
        { success: true, message: `Reminder sent to ${to}`, sentCount: 1, failedCount: 0 },
        { status: 200 }
      );
    }

    // scope is now narrowed to "single" | "all" — reminder already returned above
    if (!subject) {
      return NextResponse.json({ success: false, message: "Email subject is required" }, { status: 400 });
    }

    if (!html) {
      return NextResponse.json({ success: false, message: "Email HTML is required" }, { status: 400 });
    }

    if (!EMAIL_AUDIENCE_FILTERS.includes(filter)) {
      return NextResponse.json({ success: false, message: "Invalid email filter" }, { status: 400 });
    }

    await connectToDatabase();

    if (scope === "single") {
      if (!body.userId) {
        return NextResponse.json({ success: false, message: "userId is required for single email" }, { status: 400 });
      }

      const user = await User.findById(body.userId).select("email name");
      if (!user) {
        return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
      }

      await sendEmailWithRetry({
        to: user.email,
        subject: subject as string,
        html: html as string,
      });

      return NextResponse.json(
        {
          success: true,
          message: `Email sent to ${user.email}`,
          sentCount: 1,
          failedCount: 0,
        },
        { status: 200 }
      );
    }

    if (scope === "manual") {
      const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
      if (userIds.length === 0) {
        return NextResponse.json({ success: false, message: "userIds is required for manual email" }, { status: 400 });
      }

      const manualUsers = await User.find({ _id: { $in: userIds } }).select("email");
      if (manualUsers.length === 0) {
        return NextResponse.json({ success: false, message: "No users found for the provided userIds" }, { status: 404 });
      }

      const failedEmails: string[] = [];
      const emailBatches = chunkArray(manualUsers, BATCH_SIZE);

      for (const [batchIndex, batch] of emailBatches.entries()) {
        if (batchIndex > 0) {
          await sleep(BATCH_INTERVAL_MS);
        }

        const payload = batch.map((user) => ({
          to: user.email,
          subject: subject as string,
          html: html as string,
        }));

        try {
          const result = await sendBatchEmailWithRetry({ emails: payload });
          failedEmails.push(...result.failedEmails);
        } catch (error) {
          console.error("Failed to send manual admin email batch:", error);
          failedEmails.push(...batch.map((user) => user.email));
        }
      }

      const uniqueFailedEmails = [...new Set(failedEmails)];
      const sentCount = Math.max(0, manualUsers.length - uniqueFailedEmails.length);

      return NextResponse.json(
        {
          success: true,
          message: `Sent ${sentCount} email(s) to ${manualUsers.length} selected user${manualUsers.length === 1 ? "" : "s"}${uniqueFailedEmails.length ? `, ${uniqueFailedEmails.length} failed` : ""}`,
          recipientCount: manualUsers.length,
          sentCount,
          failedCount: uniqueFailedEmails.length,
          failedEmails: uniqueFailedEmails,
        },
        { status: 200 }
      );
    }

    const users = await User.find({}).select("email plan active billingDate");
    if (users.length === 0) {
      return NextResponse.json({ success: false, message: "No users found" }, { status: 404 });
    }

    const filteredUsers = users.filter((user) =>
      matchesAudienceFilter(
        {
          email: user.email,
          plan: user.plan,
          active: user.active,
          billingDate: user.billingDate,
        },
        filter
      )
    );

    if (filteredUsers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: `No users found for filter: ${getFilterLabel(filter)}`,
          filter,
          recipientCount: 0,
        },
        { status: 404 }
      );
    }

    const failedEmails: string[] = [];
    const emailBatches = chunkArray(filteredUsers, BATCH_SIZE);

    for (const [batchIndex, batch] of emailBatches.entries()) {
      if (batchIndex > 0) {
        await sleep(BATCH_INTERVAL_MS);
      }

      const payload = batch.map((user) => ({
        to: user.email,
        subject: subject as string,
        html: html as string,
      }));

      try {
        const result = await sendBatchEmailWithRetry({ emails: payload });
        failedEmails.push(...result.failedEmails);
      } catch (error) {
        console.error("Failed to send admin email batch:", error);
        failedEmails.push(...batch.map((user) => user.email));
      }
    }

    const uniqueFailedEmails = [...new Set(failedEmails)];
    const sentCount = Math.max(0, filteredUsers.length - uniqueFailedEmails.length);

    return NextResponse.json(
      {
        success: true,
        message: `Sent ${sentCount} email(s) to ${getFilterLabel(filter)}${uniqueFailedEmails.length ? `, ${uniqueFailedEmails.length} failed` : ""}`,
        filter,
        recipientCount: filteredUsers.length,
        sentCount,
        failedCount: uniqueFailedEmails.length,
        failedEmails: uniqueFailedEmails,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Admin email error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
