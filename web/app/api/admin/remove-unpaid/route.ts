import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import Order from "@/lib/db/models/Order";
import { getActiveAdmin } from "@/lib/auth/admin";

async function verifyRequest() {
	return getActiveAdmin();
}

export async function DELETE() {
	try {
		const admin = await verifyRequest();
		if (!admin) {
			return NextResponse.json(
				{ success: false, message: "Unauthorized" },
				{ status: 401 }
			);
		}

		await connectToDatabase();

		const cutoffDate = new Date(Date.now() - 60 * 60 * 1000);

		const result = await Order.deleteMany({
			createdAt: { $lt: cutoffDate },
			status: { $ne: "paid" },
		});

		return NextResponse.json(
			{
				success: true,
				message: "Unpaid orders older than 1 hour removed",
				deletedCount: result.deletedCount,
				cutoffDate: cutoffDate.toISOString(),
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error("Remove unpaid orders error:", error);
		return NextResponse.json(
			{ success: false, message: "Internal Server Error" },
			{ status: 500 }
		);
	}
}
