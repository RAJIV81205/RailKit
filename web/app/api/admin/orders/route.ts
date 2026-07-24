import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import Order from "@/lib/db/models/Order";
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
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    
    await connectToDatabase();
    // Use standard mongoose populate
    const orders = await Order.find({})
      .populate("userId", "name email")
      .sort({ createdAt: -1 });
      
    return NextResponse.json({ success: true, orders }, { status: 200 });
  } catch (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await verifyRequest();
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    
    await connectToDatabase();
    const body = await req.json();
    const { _id, ...updates } = body;
    
    if (!_id) return NextResponse.json({ success: false, message: "Order ID missing" }, { status: 400 });
    
    const order = await Order.findByIdAndUpdate(_id, updates, { new: true });
    if (!order) return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    
    return NextResponse.json({ success: true, order }, { status: 200 });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

function makeManualOrderId(userId: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `manual_${userId.slice(-8)}_${Date.now()}_${suffix}`;
}

type ManualOrderCreateBody = {
  email?: string;
  amount?: number;
  planType?: "pro" | "advance";
  timestamp?: string;
  transactionReference?: string;
  note?: string;
};

export async function POST(req: Request) {
  try {
    const admin = await verifyRequest();
    if (!admin) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const body = (await req.json()) as ManualOrderCreateBody;

    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: "Valid amount is required" }, { status: 400 });
    }

    const transactionReference = body.transactionReference?.trim();
    if (!transactionReference) {
      return NextResponse.json({ success: false, message: "Transaction reference is required" }, { status: 400 });
    }

    if (body.planType && body.planType !== "pro" && body.planType !== "advance") {
      return NextResponse.json({ success: false, message: "Invalid plan type" }, { status: 400 });
    }

    const user = await User.findOne({ email }).select("_id plan").lean();
    if (!user?._id) {
      return NextResponse.json({ success: false, message: "User not found for this email" }, { status: 404 });
    }

    const resolvedPlanType = body.planType
      || (user.plan === "enterprise" ? "advance" : "pro");

    const manualPaidAt = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(manualPaidAt.getTime())) {
      return NextResponse.json({ success: false, message: "Invalid timestamp" }, { status: 400 });
    }

    const createdOrder = await Order.create({
      userId: user._id,
      orderId: makeManualOrderId(user._id.toString()),
      cfOrderId: null,
      paymentSessionId: null,
      source: "manual",
      planType: resolvedPlanType,
      amount,
      currency: "INR",
      status: "paid",
      paymentStatus: "SUCCESS",
      credited: true,
      cashfreeOrderStatus: null,
      transactionReference,
      note: body.note?.trim() || null,
      manualPaidAt,
      lastWebhookAt: null,
    });

    // Keep ordering + UI timestamp aligned with the manually supplied time.
    await Order.collection.updateOne(
      { _id: createdOrder._id },
      { $set: { createdAt: manualPaidAt, updatedAt: new Date() } }
    );

    const order = await Order.findById(createdOrder._id).populate("userId", "name email");
    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    console.error("Create manual order error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
