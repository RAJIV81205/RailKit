import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthTokenFromCookies, verifyAdminAuthToken } from "@/lib/auth";

type AdminIpLocationsRequest = {
  ips?: unknown;
};

type IpApiBatchItem = {
  status?: string;
  message?: string;
  query?: string;
  country?: string;
  countryCode?: string;
  city?: string;
};

async function verifyRequest() {
  const token = await getAdminAuthTokenFromCookies();
  if (!token) return null;
  const payload = verifyAdminAuthToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}

function normalizeIp(value: unknown) {
  if (typeof value !== "string") return null;
  const ip = value.trim();
  return ip.length > 0 ? ip : null;
}

function uniqueIps(rawIps: unknown) {
  if (!Array.isArray(rawIps)) return [];
  const seen = new Set<string>();
  const ips: string[] = [];

  for (const item of rawIps) {
    const ip = normalizeIp(item);
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    ips.push(ip);
  }

  return ips.slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await verifyRequest();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as AdminIpLocationsRequest | null;
    const ips = uniqueIps(body?.ips);

    if (ips.length === 0) {
      return NextResponse.json({
        success: true,
        locations: {},
      });
    }

    const response = await fetch("http://ip-api.com/batch?fields=status,message,query,country,countryCode,city&lang=en", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ips),
    });

    const data = (await response.json().catch(() => [])) as IpApiBatchItem[];
    const locations: Record<
      string,
      {
        country: string | null;
        city: string | null;
        status: string;
      }
    > = {};

    for (const item of Array.isArray(data) ? data : []) {
      const ip = normalizeIp(item?.query);
      if (!ip) continue;

      locations[ip] = {
        country: typeof item.country === "string" && item.country.trim() ? item.country.trim() : null,
        city: typeof item.city === "string" && item.city.trim() ? item.city.trim() : null,
        status: item.status || "fail",
      };
    }

    return NextResponse.json({
      success: true,
      locations,
      rateLimited: response.status === 429,
      status: response.status,
    });
  } catch (error) {
    console.error("Admin IP locations fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch IP locations",
      },
      { status: 500 }
    );
  }
}
