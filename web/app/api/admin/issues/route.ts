import { NextResponse } from "next/server";
import { getActiveAdmin } from "@/lib/auth/admin";

const DEFAULT_OWNER = "RAJIV81205";
const DEFAULT_REPO = "railkit";
const RECENT_WINDOW_DAYS = 14;
const MAX_ISSUES = 30;

async function verifyRequest() {
  return getActiveAdmin();
}

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  comments: number;
  user?: { login?: string };
  labels?: Array<{ name?: string; color?: string }>;
  pull_request?: unknown;
};

export async function GET() {
  try {
    const admin = await verifyRequest();
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const owner = process.env.GITHUB_REPO_OWNER?.trim() || DEFAULT_OWNER;
    const repo = process.env.GITHUB_REPO_NAME?.trim() || DEFAULT_REPO;
    const githubToken = process.env.GITHUB_TOKEN?.trim();

    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&sort=updated&direction=desc&per_page=${MAX_ISSUES}`;

    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "railkit-admin-issues",
    };

    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          message: `GitHub API failed (${response.status})`,
          details: errorText.slice(0, 400),
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as GitHubIssue[];

    const now = Date.now();
    const recentWindowMs = RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const issues = (Array.isArray(data) ? data : [])
      .filter((issue) => !issue.pull_request)
      .map((issue) => {
        const createdAtMs = new Date(issue.created_at).getTime();
        const updatedAtMs = new Date(issue.updated_at).getTime();
        const isNew = Number.isFinite(createdAtMs) && now - createdAtMs <= recentWindowMs;
        const isRecentlyUpdated =
          Number.isFinite(updatedAtMs) &&
          now - updatedAtMs <= recentWindowMs &&
          !isNew;

        return {
          id: issue.id,
          number: issue.number,
          title: issue.title,
          htmlUrl: issue.html_url,
          state: issue.state,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          comments: issue.comments ?? 0,
          author: issue.user?.login || "unknown",
          labels: (issue.labels || [])
            .filter((label) => Boolean(label.name))
            .map((label) => ({
              name: label.name as string,
              color: label.color || "64748b",
            })),
          isNew,
          isRecentlyUpdated,
        };
      })
      .filter((issue) => issue.isNew || issue.isRecentlyUpdated);

    return NextResponse.json(
      {
        success: true,
        owner,
        repo,
        windowDays: RECENT_WINDOW_DAYS,
        newCount: issues.filter((issue) => issue.isNew).length,
        updatedCount: issues.filter((issue) => issue.isRecentlyUpdated).length,
        issues,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Fetch GitHub issues error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
