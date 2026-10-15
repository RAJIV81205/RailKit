import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import LimitTopup from "@/lib/db/models/LimitTopup";
import User from "@/lib/db/models/User";
import { getActiveAdmin } from "@/lib/auth/admin";

async function verifyRequest() {
	return getActiveAdmin();
}

export async function GET() {
	try {
		const admin = await verifyRequest();
		if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

		await connectToDatabase();
		const topups = await LimitTopup.find({})
			.populate({ path: "userId", select: "name email", model: User })
			.sort({ createdAt: -1 })
			.limit(200);

		return NextResponse.json({ success: true, topups }, { status: 200 });
	} catch (error) {
		console.error("Fetch topups error:", error);
		return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
	}
}
