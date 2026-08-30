import { Resend } from "resend";
import User from "../db/models/User";
import Order from "../db/models/Order";
import { addOneMonth, capitalize, formatDate, generateInvoicePdf } from "./invoice";

const resend = new Resend(process.env.RESEND_API_KEY!);

interface IUser {
  name: string;
  email: string;
  plan: string;
  billingDate?: Date | null;
  limit: number;
}

interface IOrder {
  orderId: string;
  planType: string;
  billingInterval?: "month" | "year" | null;
  termMonths?: number | null;
  monthlyLimit?: number | null;
  entitlementStartsAt?: Date | null;
  entitlementEndsAt?: Date | null;
  transactionReference?: string | null;
  amount: number;
  currency?: string | null;
  createdAt?: Date | null;
}

interface BillingExpiredEmailUser {
  name: string;
  email: string;
}

const senderEmail = "railkit@rajivdubey.dev";
const senderName = "RailKit";
const replyToEmail = "lucky81205+railkit@gmail.com";
const replyToName = "Rajiv Dubey";

type SendRawHtmlEmailParams = {
  to: string;
  subject: string;
  html: string;
};

type SendRawHtmlBatchEmailParams = {
  emails: Array<{
    to: string;
    subject: string;
    html: string;
  }>;
};

export type SendRawHtmlBatchEmailResult = {
  sentCount: number;
  failedEmails: string[];
};

// ─── Email Template ──────────────────────────────────────────────────────────

const welcomeTemplateHtml = (user: IUser, order: IOrder): string => {
  const firstName = user.name.split(" ")[0];
  const billingDate = order.entitlementStartsAt
    ? new Date(order.entitlementStartsAt)
    : user.billingDate
      ? new Date(user.billingDate)
      : new Date();
  const nextQuotaReset = addOneMonth(billingDate);
  const planEndsAt = order.entitlementEndsAt
    ? new Date(order.entitlementEndsAt)
    : nextQuotaReset;
  const intervalLabel = order.billingInterval === "year" ? "Annual" : "Monthly";
  const monthlyLimit = order.monthlyLimit ?? user.limit;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to RailKit</title>
</head>
<body style="
  margin: 0;
  padding: 0;
  background: #f4f4f5;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="min-height: 100vh; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
          style="
            max-width: 600px;
            width: 100%;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #e4e4e7;
          ">

          <!-- Header -->
          <tr>
            <td style="background: #18181b; padding: 36px 40px 28px; text-align: center;">
              <img
                src="https://railkit.in/icon.png"
                alt="RailKit"
                width="52" height="52"
                style="border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); display: block; margin: 0 auto 14px;"
              />
              <h1 style="margin: 0 0 4px; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.3px;">
                RailKit
              </h1>
              <p style="margin: 0; color: #a1a1aa; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;">
                Your Smart Rail Companion
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px 32px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">
                Thanks, ${firstName}! 🙏
              </h2>

              <!-- Personal note -->
              <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.75; color: #3f3f46;">
                Really appreciate you subscribing to RailKit. I built this as a side project to make
                working with IRCTC data easy for developers, and it genuinely means a lot when someone finds it useful.
              </p>
              <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.75; color: #3f3f46;">
                You're on the <strong style="color: #18181b;">${capitalize(user.plan)} ${intervalLabel} Plan</strong> —
                that gives you <strong style="color: #18181b;">${monthlyLimit.toLocaleString("en-IN")} API calls/month</strong>.
                Your quota refreshes on <strong style="color: #18181b;">${formatDate(nextQuotaReset)}</strong>, and your plan is valid through
                <strong style="color: #18181b;">${formatDate(planEndsAt)}</strong>.
                Your invoice is attached to this email.
              </p>
              <p style="margin: 0 0 14px; font-size: 13px; line-height: 1.7; color: #71717a;">
                Order ${order.orderId}. Add-on requests remain available across monthly quota refreshes and expire when this plan ends.
              </p>
              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.75; color: #3f3f46;">
                If you ever need a higher limit, a custom plan, or just run into something that's not working right —
                <strong style="color: #18181b;">please reach out directly.</strong>
                I'm just one person running this, so I read every message personally and try to respond fast.
              </p>

              <!-- Reach out options -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 14px; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #71717a;">
                      Ways to reach me
                    </p>

                    <!-- Email row -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                      <tr>
                        <td width="28" style="font-size: 16px; vertical-align: middle;">✉️</td>
                        <td style="font-size: 14px; color: #3f3f46; vertical-align: middle;">
                          Reply to this email
                          <span style="color: #a1a1aa; font-size: 13px;"> — I'll get it directly</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Signal row -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="28" style="font-size: 16px; vertical-align: middle;">💬</td>
                        <td style="font-size: 14px; color: #3f3f46; vertical-align: middle;">
                          <a href="https://signal.me/#eu/F8kHmQ5nKhO1ifpDuDcFXpAMg05zBLyi5GXx6MdLmNH9U1plPehLiKIkFp4aVHtw"
                            target="_blank" rel="noopener noreferrer"
                            style="color: #18181b; font-weight: 600; text-decoration: underline;">
                            Signal
                          </a>
                          <span style="color: #a1a1aa; font-size: 13px;"> — fastest response</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://railkit.in/dashboard" target="_blank" rel="noopener noreferrer"
                      style="
                        display: inline-block;
                        background: #18181b;
                        color: #ffffff;
                        text-decoration: none;
                        font-size: 14px;
                        font-weight: 600;
                        padding: 12px 32px;
                        border-radius: 8px;
                        letter-spacing: 0.2px;
                      ">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #fafafa; border-top: 1px solid #e4e4e7; padding: 20px 40px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #71717a;">
                Built with ❤️ by Rajiv Dubey ·
                <a href="https://railkit.in" style="color: #18181b; text-decoration: none;">railkit.in</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #d4d4d8;">
                You're receiving this because you subscribed with ${user.email}
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

const billingExpiredTemplateHtml = (user: BillingExpiredEmailUser): string => {
  const firstName = user.name.split(" ")[0] || "there";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your RailKit plan has expired</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;padding:40px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:#18181b;padding:36px 40px 28px;text-align:center;">
              <img
                src="https://railkit.in/icon-dark.png"
                alt="RailKit"
                width="52"
                height="52"
                style="border-radius:12px;border:1px solid rgba(255,255,255,0.12);display:block;margin:0 auto 14px;"
              />
              <h1 style="margin:0 0 4px;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:-0.3px;">RailKit</h1>
              <p style="margin:0;color:#a1a1aa;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Billing update</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 32px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">Hi ${firstName},</h2>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#3f3f46;">
                Your paid RailKit plan has expired because the current billing period ended and no renewal was completed.
              </p>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#3f3f46;">
                Your account has been moved to the <strong style="color:#18181b;">Free plan</strong>. API access remains available with the free-plan monthly limit.
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#3f3f46;">
                To restore paid limits, renew your subscription from pricing page. If this looks wrong, reply to this email and it will be reviewed directly.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://railkit.in/pricing" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;letter-spacing:0.2px;">
                      Renew plan
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#71717a;">
                RailKit ·
                <a href="https://railkit.in" style="color:#18181b;text-decoration:none;">railkit.in</a>
              </p>
              <p style="margin:0;font-size:11px;color:#d4d4d8;">
                Transactional billing email for ${user.email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

// ─── Send Welcome Email (with Invoice) ───────────────────────────────────────

export async function sendWelcomeEmail(userId: string, orderId: string) {
  const [user, order] = await Promise.all([
    User.findById(userId),
    Order.findOne({ orderId }),
  ]);
  if (!user) throw new Error("User not found");
  if (!order) throw new Error("Order not found");

  // Generate invoice PDF — if this fails, we still want the email to send,
  // so we catch and log, then send without attachment.
  let invoicePdf: Buffer | null = null;
  try {
    invoicePdf = await generateInvoicePdf(user, order);
  } catch (err) {
    console.error("Invoice generation failed, sending email without attachment:", err);
  }

  const firstName = user.name.split(" ")[0];

  const emailPayload: Parameters<typeof resend.emails.send>[0] = {
    from: `${senderName} <${senderEmail}>`,
    to: [user.email],
    replyTo: `${replyToName} <${replyToEmail}>`,
    subject: `${order.billingInterval === "year" ? "Annual" : "Monthly"} RailKit plan active — invoice inside`,
    html: welcomeTemplateHtml(user, order),
    ...(invoicePdf && {
      attachments: [
        {
          filename: `railkit-invoice-${Date.now()}.pdf`,
          content: invoicePdf.toString("base64"),
        },
      ],
    }),
  };

  const { data, error } = await resend.emails.send(emailPayload);

  if (error) {
    console.error("Failed to send welcome email:", error);
    throw error;
  }

  console.log(`Welcome email sent to ${user.email} | ID: ${data?.id}`);
  return data;
}

export async function sendBillingExpiredEmail(user: BillingExpiredEmailUser) {
  const { data, error } = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to: [user.email],
    replyTo: `${replyToName} <${replyToEmail}>`,
    subject: "Your RailKit paid plan has expired",
    html: billingExpiredTemplateHtml(user),
  });

  if (error) {
    console.error(`Failed to send billing expired email to ${user.email}:`, error);
    throw error;
  }

  return data;
}

// ─── Raw helpers (unchanged) ─────────────────────────────────────────────────

export async function sendRawHtmlEmail({
  to,
  subject,
  html,
}: SendRawHtmlEmailParams) {
  const { data, error } = await resend.emails.send({
    from: `${senderName} <${senderEmail}>`,
    to: [to],
    replyTo: `${replyToName} <${replyToEmail}>`,
    subject,
    html,
  });

  if (error) {
    console.error(`Failed to send custom email to ${to}:`, error);
    throw error;
  }

  return data;
}

export async function sendRawHtmlEmailBatch({
  emails,
}: SendRawHtmlBatchEmailParams): Promise<SendRawHtmlBatchEmailResult> {
  if (emails.length === 0) return { sentCount: 0, failedEmails: [] };

  const { data, error } = await resend.batch.send(
    emails.map((email) => ({
      from: `${senderName} <${senderEmail}>`,
      to: [email.to],
      replyTo: `${replyToName} <${replyToEmail}>`,
      subject: email.subject,
      html: email.html,
    })),
    { batchValidation: "permissive" }
  );

  if (error) {
    console.error("Failed to send custom email batch:", error);
    throw error;
  }

  const failedIndices = new Set(
    (data.errors || [])
      .map((entry) => entry.index)
      .filter((index) => Number.isInteger(index) && index >= 0)
  );

  const failedEmails = emails
    .map((email, index) => (failedIndices.has(index) ? email.to : null))
    .filter((email): email is string => Boolean(email));

  return {
    sentCount: emails.length - failedEmails.length,
    failedEmails,
  };
}
