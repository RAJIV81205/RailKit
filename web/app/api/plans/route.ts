import { NextResponse } from "next/server";
import { getPublicPlanConfig } from "@/lib/constants";

export async function GET() {
  try {
    const config = getPublicPlanConfig();

    return NextResponse.json(
      {
        success: true,
        billingV2Enabled: config.billingV2Enabled,
        offerEndsAt: config.offerEndsAt,
        contactEmail: config.contactEmail,
        plans: config.plans,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Public plans fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
