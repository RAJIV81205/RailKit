import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { connectToDatabase } from "@/lib/db/db";
import Email from "@/lib/db/models/Email";
import { readLimitedText, RequestBodyTooLargeError } from "@/lib/security/body";

type ResendEmailAttachment = {
	id?: string;
	filename?: string;
	content_type?: string;
	content_disposition?: string;
	content_id?: string;
};

type ResendEmailWebhookPayload = {
	type?: string;
	created_at?: string;
	data?: {
		email_id?: string;
		created_at?: string;
		from?: string;
		to?: string[];
		cc?: string[];
		bcc?: string[];
		message_id?: string;
		subject?: string;
		attachments?: ResendEmailAttachment[];
	};
};

function toDate(value: string | undefined) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function toStringArray(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function normalizePayload(payload: unknown): ResendEmailWebhookPayload {
	if (typeof payload === "string") {
		return JSON.parse(payload) as ResendEmailWebhookPayload;
	}

	if (typeof payload === "object" && payload !== null) {
		return payload as ResendEmailWebhookPayload;
	}

	throw new Error("Invalid webhook payload");
}

export async function POST(request: Request) {
	try {
		const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
		if (!webhookSecret) {
			return NextResponse.json(
				{ success: false, message: "RESEND_WEBHOOK_SECRET is not set" },
				{ status: 500 }
			);
		}

		const rawBody = await readLimitedText(request, 256 * 1024);
		const webhookId = request.headers.get("svix-id");
		const webhookTimestamp = request.headers.get("svix-timestamp");
		const webhookSignature = request.headers.get("svix-signature");

		if (!webhookId || !webhookTimestamp || !webhookSignature) {
			return NextResponse.json(
				{ success: false, message: "missing webhook signature headers" },
				{ status: 400 }
			);
		}

		const webhook = new Webhook(webhookSecret);
		const verifiedPayload = webhook.verify(rawBody, {
			"svix-id": webhookId,
			"svix-timestamp": webhookTimestamp,
			"svix-signature": webhookSignature,
		});

		const event = normalizePayload(verifiedPayload);

		if (event.type !== "email.received") {
			return NextResponse.json({ success: true, message: "event ignored" }, { status: 200 });
		}

		const eventData = event.data;
		if (!eventData?.email_id || !eventData?.from) {
			return NextResponse.json(
				{ success: false, message: "invalid email.received payload" },
				{ status: 400 }
			);
		}

		await connectToDatabase();

		await Email.findOneAndUpdate(
			{ deliveryId: webhookId },
			{
				$setOnInsert: {
					deliveryId: webhookId,
					eventType: event.type,
					eventCreatedAt: toDate(event.created_at) || new Date(),
					emailId: eventData.email_id,
					emailCreatedAt: toDate(eventData.created_at),
					from: eventData.from,
					to: toStringArray(eventData.to),
					cc: toStringArray(eventData.cc),
					bcc: toStringArray(eventData.bcc),
					messageId: eventData.message_id || null,
					subject: eventData.subject || "",
					attachments: (eventData.attachments || []).map((attachment) => ({
						id: attachment.id || null,
						filename: attachment.filename || null,
						contentType: attachment.content_type || null,
						contentDisposition: attachment.content_disposition || null,
						contentId: attachment.content_id || null,
					})),
					rawPayload: event,
					verifiedAt: new Date(),
				},
			},
			{ upsert: true, new: true }
		);

		return NextResponse.json(
			{ success: true, message: "webhook processed" },
			{ status: 200 }
		);
	} catch (error: unknown) {
		if (error instanceof RequestBodyTooLargeError) {
			return NextResponse.json({ success: false, message: error.message }, { status: 413 });
		}
		const message = error instanceof Error ? error.message : "unknown webhook error";
		const invalidSignature = message.toLowerCase().includes("signature");

		console.error("Resend email webhook error:", message);

		return NextResponse.json(
			{
				success: false,
				message: invalidSignature ? "invalid webhook signature" : "failed to process webhook",
			},
			{ status: invalidSignature ? 401 : 500 }
		);
	}
}
