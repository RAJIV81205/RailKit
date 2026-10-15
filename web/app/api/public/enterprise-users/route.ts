import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/db";
import User from "@/lib/db/models/User";

type EnterpriseShowcaseUser = {
  id: string;
  name: string;
  maskedEmail: string;
};

const FALLBACK_USERS: EnterpriseShowcaseUser[] = [
  { id: "f-1", name: "Nikhil S.", maskedEmail: "nikh.....gma.com" },
  { id: "f-2", name: "Priya R.", maskedEmail: "priy.....out.com" },
  { id: "f-3", name: "Ankit V.", maskedEmail: "anki.....yah.com" },
  { id: "f-4", name: "Ritika M.", maskedEmail: "riti.....gma.com" },
  { id: "f-5", name: "Aarav J.", maskedEmail: "aara.....pro.com" },
  { id: "f-6", name: "Sneha K.", maskedEmail: "sneh.....zoh.com" },
];

function maskEmail(email: string): string {
  const normalized = String(email || "").toLowerCase().trim();
  if (!normalized || !normalized.includes("@")) {
    return "use.....com";
  }

  const minReveal = 3;
  const maxReveal = 4;
  const revealCount = Math.min(
    maxReveal,
    Math.max(minReveal, Math.floor(normalized.length / 4)),
  );

  const start = normalized.slice(0, revealCount);
  const end = normalized.slice(-revealCount);
  return `${start}.....${end}`;
}

function shuffleUsers<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function GET() {
  try {
    await connectToDatabase();
    const users = await User.find({
      plan: "enterprise",
      active: true,
    })
      .sort({ updatedAt: -1 })
      .limit(16)
      .select("_id name email")
      .lean();

    const cleaned = users
      .filter((user) => user?.email && user?.name)
      .slice(0, 16)
      .map((user) => ({
        id: String(user._id),
        name: String(user.name).trim(),
        maskedEmail: maskEmail(String(user.email)),
      }))
      .filter((user) => user.name.length > 0);

    // Shuffle so the landing-page showcase rotates across requests
    // instead of being locked to the same `sort: { updatedAt: -1 }` order.
    for (let i = cleaned.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cleaned[i], cleaned[j]] = [cleaned[j], cleaned[i]];
    }

    return NextResponse.json(
      {
        success: true,
        users: cleaned.length > 0 ? cleaned : shuffleUsers(FALLBACK_USERS),
      },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("Enterprise users public route error:", error);
    return NextResponse.json(
      {
        success: true,
        users: shuffleUsers(FALLBACK_USERS),
      },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
}
