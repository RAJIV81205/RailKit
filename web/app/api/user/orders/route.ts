import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";
import Order from "@/lib/db/models/Order";
import {
	getAuthCookieName,
	getAuthTokenFromCookies,
	verifyAuthToken,
} from "@/lib/auth";

function unauthorizedResponse(message = "unauthorized") {
	const response = NextResponse.json(
		{ success: false, message },
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

export async function GET() {
	try {
		await connectToDatabase();

		const token = await getAuthTokenFromCookies();
		if (!token) {
			return unauthorizedResponse("unauthorized: missing token");
		}

		const payload = verifyAuthToken(token);
		if (!payload || !payload.userId) {
			return unauthorizedResponse("unauthorized: invalid token payload");
		}

		const user = await User.findById(payload.userId).select("_id active").lean();
		if (!user || !user.active) {
			return unauthorizedResponse("unauthorized: invalid user");
		}

		const orders = await Order.find({ userId: user._id })
			.sort({ createdAt: -1 })
			.lean();

		return NextResponse.json(
			{
				success: true,
				message: "orders fetched",
				orders: orders.map((order) => ({
					_id: order._id.toString(),
					orderId: order.orderId,
					planType: order.planType,
					billingInterval: order.billingInterval ?? null,
					entitlementVersion: order.entitlementVersion ?? null,
					amount: order.amount,
					currency: order.currency,
					status: order.status,
					credited: order.credited,
					createdAt: order.createdAt,
				})),
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error("Get orders route error:", error);
		return NextResponse.json(
			{
				success: false,
				message: "failed to fetch orders",
			},
			{ status: 500 }
		);
	}
}
