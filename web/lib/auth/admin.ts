import { getAdminAuthTokenFromCookies, verifyAdminAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";

export async function getActiveAdmin() {
  const token = await getAdminAuthTokenFromCookies();
  const payload = token ? verifyAdminAuthToken(token) : null;
  if (!payload) return null;

  await connectToDatabase();
  const user = await User.findOne({ email: payload.email.toLowerCase() })
    .select("active status")
    .lean();
  return user?.active && user.status !== "banned" ? payload : null;
}
