import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/auth/admin";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";

export async function GET() {
  const payload = await getActiveAdmin();
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  await connectToDatabase();
  const email = payload.email?.trim().toLowerCase();
  const adminUser = email ? await User.findOne({ email }).select("apiKey").lean() : null;

  return NextResponse.json(
    { authenticated: true, user: { ...payload, apiKey: adminUser?.apiKey ?? null } },
    { status: 200 }
  );
}
