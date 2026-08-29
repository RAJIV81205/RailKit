"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ThemeObject } from "react-json-view";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { packageInfo, sidebarGroups } from "./docsData";
import { endpointDocs, type EndpointDoc } from "./endpointDocs";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle,
  ChevronRight,
  Copy,
  ExternalLink,
  Gamepad2,
  KeyRound,
  Package,
  Rocket,
  Ticket,
  Train,
  type LucideIcon,
} from "lucide-react";

type IntegrationView = "sdk" | "rest";
type ApiCodeLanguage = "javascript" | "python" | "curl";

const endpointDocsById = new Map(
  endpointDocs.map((endpoint) => [endpoint.id, endpoint]),
);

const ReactJson = dynamic(() => import("react-json-view"), { ssr: false });

const nightOwlJsonTheme: ThemeObject = {
  base00: "#0d1117",
  base01: "#161b22",
  base02: "#21262d",
  base03: "#637777",
  base04: "#8b949e",
  base05: "#d6deeb",
  base06: "#d6deeb",
  base07: "#ffffff",
  base08: "#ff5874",
  base09: "#ecc48d",
  base0A: "#f78c6c",
  base0B: "#addb67",
  base0C: "#7fdbca",
  base0D: "#82aaff",
  base0E: "#c792ea",
  base0F: "#d3423e",
};

const apiLanguageMeta: Record<
  ApiCodeLanguage,
  { label: string; syntax: string }
> = {
  javascript: { label: "JavaScript", syntax: "javascript" },
  python: { label: "Python", syntax: "python" },
  curl: { label: "cURL", syntax: "bash" },
};

function buildRestSnippet(
  baseUrl: string,
  examplePath: string,
  language: ApiCodeLanguage,
) {
  const url = `${baseUrl}${examplePath}`;
  if (language === "python")
    return `import requests

response = requests.get(
    "${url}",
    headers={"x-api-key": "YOUR_API_KEY", "accept": "application/json"},
)

print(response.json())`;
  if (language === "curl")
    return `curl -X GET "${url}" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "accept: application/json"`;
  return `const response = await fetch("${url}", {
  method: "GET",
  headers: {
    "x-api-key": process.env.RAILKIT_API_KEY,
    "accept": "application/json",
  },
});

const data = await response.json();
console.log(data);`;
}

const installSnippet = "npm install railkit";

const quickStartSnippet = `import {
  configure,
  checkPNRStatus,
  getTrainInfo,
  trackTrain,
  getTrainHistory,
  liveAtStation,
  searchTrainBetweenStations,
  getAvailability,
  fareLookup,
  cancelList
} from "railkit";

configure(process.env.RAILKIT_API_KEY);

const pnr    = await checkPNRStatus("1234567890");
const train  = await getTrainInfo("12345");
const live   = await trackTrain("12345", "06-12-2025");
const hist   = await getTrainHistory("12345", "06-12-2025");
const stn    = await liveAtStation("NDLS");
const search = await searchTrainBetweenStations("NDLS", "BCT");
const seats  = await getAvailability("12496","ASN","DDU","27-12-2025","2A","GN");
const fare   = await fareLookup("12313","ASN","NDLS","06-06-2026","3A","GN");
const cancelled = await cancelList();`;

const docsBaseUrl = "https://railkit.in/docs";

const sdkExampleOverrides: Partial<Record<EndpointDoc["id"], string>> = {
  "station-timetable": `const result = await trainTimetableAtStation(
  "ASN",
  "28-08-2026",
);`,
  "station-by-code": `const result = await stationByCode("NDLS");

if (result.success) {
  console.log(result.data.code, result.data.name);
}`,
  "station-search": `const result = await stationsByName("delhi");

if (result.success) {
  console.log(result.data.stations);
}`,
  "train-by-number": `const result = await trainByNumber("12345");

if (result.success) {
  console.log(result.data.trainNo, result.data.trainName);
}`,
  "train-name-search": `const result = await trainsByName("rajdhani");

if (result.success) {
  console.log(result.data.trains);
}`,
};

function getSdkFunctionName(endpoint: EndpointDoc) {
  return endpoint.signature.slice(0, endpoint.signature.indexOf("("));
}

function buildSdkEndpointSnippet(endpoint: EndpointDoc) {
  const functionName = getSdkFunctionName(endpoint);
  const usage = sdkExampleOverrides[endpoint.id] || endpoint.example;

  return `import { configure, ${functionName} } from "railkit";

configure(process.env.RAILKIT_API_KEY);

${usage}`;
}

function getEndpointParamLocation(endpointId: string, name: string) {
  const queryParams: Record<string, readonly string[]> = {
    "station-live": ["hours"],
    "train-search": ["date"],
    "station-timetable": ["date"],
    "station-search": ["name"],
    "train-name-search": ["name"],
  };

  return queryParams[endpointId]?.includes(name) ? "query" : "path";
}

function isSdkParamOptional(endpointId: string, name: string) {
  return (
    (endpointId === "live-tracking" && name === "date") ||
    (endpointId === "station-live" && name === "hours") ||
    (endpointId === "train-search" && name === "date") ||
    (endpointId === "station-timetable" && name === "date")
  );
}

function isRestParamOptional(endpointId: string, name: string) {
  return (
    (endpointId === "station-live" && name === "hours") ||
    (endpointId === "train-search" && name === "date") ||
    (endpointId === "station-timetable" && name === "date")
  );
}

const introductionEndpointGroups = [
  {
    title: "Trains",
    icon: Train,
    endpointIds: [
      "train-info",
      "live-tracking",
      "train-history",
      "train-search",
      "seat-availability",
      "fare-lookup",
      "cancelled-trains",
      "train-by-number",
      "train-name-search",
    ],
  },
  {
    title: "PNR Status",
    icon: Ticket,
    endpointIds: ["pnr-status"],
  },
  {
    title: "Stations",
    icon: Building2,
    endpointIds: [
      "station-live",
      "station-timetable",
      "station-by-code",
      "station-search",
    ],
  },
] as const;

export default function DocsPage({
  activeSlug = "introduction",
}: {
  activeSlug?: string;
}) {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedAIMarkdown, setCopiedAIMarkdown] = useState(false);
  const [setupView] = useState<IntegrationView>("sdk");
  const [quickStartLanguage, setQuickStartLanguage] =
    useState<ApiCodeLanguage>("javascript");

  const directApiBaseUrl =
    process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL ||
    "https://api.railkit.in";

  const flatSections = useMemo(() => sidebarGroups.flatMap((g) => g.items), []);

  const aiDocsMarkdown = useMemo(() => {
    const endpointDetails = endpointDocs
      .map((ep, index) => {
        const params = ep.params.length
          ? `| Name | Type | REST location | SDK required | REST required | Description |
|---|---|---|---|---|---|
${ep.params
  .map(
    (param) =>
      `| \`${param.name}\` | \`${param.type}\` | ${getEndpointParamLocation(ep.id, param.name)} | ${isSdkParamOptional(ep.id, param.name) ? "No" : "Yes"} | ${isRestParamOptional(ep.id, param.name) ? "No" : "Yes"} | ${param.desc} |`,
  )
  .join("\n")}`
          : "No parameters.";

        return `### ${index + 1}. ${ep.title}

- ID: \`${ep.id}\`
- Purpose: ${ep.description}
- Documentation: [${docsBaseUrl}/${ep.id}](${docsBaseUrl}/${ep.id})
- SDK function: \`${ep.signature}\`
- REST contract: \`${ep.method} ${ep.path}\`
- Complete REST URL example: \`${directApiBaseUrl}${ep.examplePath}\`
- Endpoint notes: ${ep.notes}

#### Parameters

${params}

Parameter order matters. For SDK calls, follow SDK signature. For REST calls, follow REST path exactly; fare lookup uses different argument/path ordering.

#### Complete SDK example

\`\`\`javascript
${buildSdkEndpointSnippet(ep)}
\`\`\`

#### Complete REST JavaScript example

\`\`\`javascript
${buildRestSnippet(directApiBaseUrl, ep.examplePath, "javascript")}
\`\`\`

#### Complete REST cURL example

\`\`\`bash
${buildRestSnippet(directApiBaseUrl, ep.examplePath, "curl")}
\`\`\`

#### Sample successful response

\`\`\`json
${ep.response}
\`\`\``;
      })
      .join("\n\n");

    const sectionLinks = [
      "installation",
      "quickstart",
      "pnr-status",
      "train-info",
      "live-tracking",
      "train-history",
      "station-live",
      "train-search",
      "seat-availability",
      "fare-lookup",
      "cancelled-trains",
      "station-timetable",
      "station-by-code",
      "station-search",
      "train-by-number",
      "train-name-search",
      "validation",
      "status-codes",
      "errors",
    ]
      .map((id) => {
        const s = flatSections.find((i) => i.id === id);
        return s ? `- [${s.label}](${docsBaseUrl}/${s.id})` : null;
      })
      .filter(Boolean)
      .join("\n");

    return `# RailKit — Complete AI Integration Reference

This document is self-contained context for an AI model or developer integrating RailKit. Use only contracts documented here. Do not invent endpoint paths, parameter names, enum values, or response fields. Railway data is live and response values shown below are examples, not constants.

## Product and official sources

- Product: RailKit Indian Railways data service
- Documentation: [${docsBaseUrl}](${docsBaseUrl})
- Dashboard and API keys: [https://railkit.in/dashboard](https://railkit.in/dashboard)
- npm package: [${packageInfo.links.npm}](${packageInfo.links.npm})
- GitHub: [${packageInfo.links.github}](${packageInfo.links.github})
- Package name: \`railkit\`
- Runtime: Node.js 14 or newer
- Module format: ESM named imports

## Choose one integration mode

### Node.js SDK

- Recommended for Node.js, Express, Next.js server code, and other supported server runtimes.
- Install with \`${installSnippet}\`.
- Import named functions from \`railkit\`.
- Call \`configure(apiKey)\` once during server startup before any endpoint function.
- Every endpoint function returns a Promise resolving to a result object.
- Always test \`result.success\` before reading \`result.data\`.

### Direct REST API

- Base URL: \`${directApiBaseUrl}\`
- Authentication header on every request: \`x-api-key: YOUR_API_KEY\`
- Optional request header: \`accept: application/json\`
- All documented endpoints use HTTP GET.
- Direct REST access requires the Advance plan.
- Check both HTTP status and parsed JSON body.
- URL-encode dynamic path and query values when constructing URLs from user input.

## Security requirements

- Keep API keys in server-side environment variables such as \`RAILKIT_API_KEY\`.
- Never hard-code, log, commit, or expose an API key in browser/client code.
- Route browser requests through your own authenticated backend.
- Rotate a key from the RailKit dashboard if it is exposed.

## Complete SDK setup

\`\`\`bash
${installSnippet}
\`\`\`

\`\`\`javascript
${quickStartSnippet}
\`\`\`

## Complete SDK export list

\`\`\`ts
configure(apiKey: string): void
checkPNRStatus(pnr: string): Promise<any>
getTrainInfo(trainNumber: string): Promise<any>
trackTrain(trainNumber: string, date?: string): Promise<any>
getTrainHistory(trainNumber: string, journeyDate: string): Promise<any>
liveAtStation(stationCode: string, hours?: 2 | 4 | 8): Promise<any>
searchTrainBetweenStations(fromStnCode: string, toStnCode: string, date?: string): Promise<any>
getAvailability(trainNo: string, fromStnCode: string, toStnCode: string, date: string, coach: string, quota: string): Promise<any>
fareLookup(trainNo: string, fromStnCode: string, toStnCode: string, date: string, travelClass: string, quota: string): Promise<any>
cancelList(): Promise<any>
stationByCode(stationCode: string): Promise<any>
stationsByName(name: string): Promise<any>
trainByNumber(trainNumber: string): Promise<any>
trainsByName(name: string): Promise<any>
trainTimetableAtStation(stationCode: string, date?: string): Promise<any>
\`\`\`

## Input and enum rules

- PNR: exactly 10 numeric digits; treat as a string.
- Train number: exactly 5 numeric digits; treat as a string to preserve leading zeros.
- Date: \`DD-MM-YYYY\`; validate that it is a real calendar date.
- Live tracking SDK date: optional and defaults to today; REST date path segment is required and accepts \`today\`.
- Station code: uppercase, 1–5 letters or digits; examples: \`NDLS\`, \`BCT\`, \`HWH\`.
- Station or train name search: at least 2 characters; returns at most 10 matches.
- Live station hours: \`2\`, \`4\`, or \`8\`; default is \`2\`.
- Seat-availability classes: \`2S\`, \`SL\`, \`3A\`, \`3E\`, \`2A\`, \`1A\`, \`CC\`, \`EC\`.
- Seat-availability quotas: \`GN\`, \`LD\`, \`SS\`, \`TQ\`.
- Fare classes: \`1A\`, \`2A\`, \`3A\`, \`3E\`, \`CC\`, \`EC\`, \`EA\`, \`FC\`, \`SL\`, \`2S\`, \`VS\`, \`CH\`, \`HS\`, \`VC\`, \`VA\`.
- Fare quotas: \`GN\`, \`TQ\`, \`PT\`, \`LD\`, \`DF\`, \`FT\`, \`LB\`, \`YU\`, \`DP\`, \`HP\`, \`PH\`, \`SS\`.
- Station timetable date: optional, limited to today, yesterday, or tomorrow; omission defaults to today.

## Response contract and error handling

Successful response:

\`\`\`json
{ "success": true, "data": {} }
\`\`\`

Failed response:

\`\`\`json
{ "success": false, "error": "Description of what went wrong" }
\`\`\`

Never access \`data\` before checking \`success\`. Do not assume every endpoint returns the same fields inside \`data\`; use each endpoint's sample schema below.

| HTTP status | Meaning | Integration action |
|---|---|---|
| 200 | Success | Read JSON and verify \`success === true\`. |
| 400 | Invalid input or rejected upstream request | Fix request; do not retry unchanged input. |
| 401 | Missing or invalid API key | Verify server-side key and \`x-api-key\` header. |
| 403 | Inactive key or unavailable access | Reactivate key or verify plan access. |
| 404 | Requested record not found | Treat as unavailable data; verify identifiers/date. |
| 429 | Monthly usage limit exceeded | Stop retries; inspect account usage or increase limit. |
| 500 | Backend or upstream failure | Retry later with bounded exponential backoff. |

Also handle network failures and timeouts with \`try/catch\`. Never retry 400, 401, 403, or 404 responses without changing request/auth state.

## PNR status codes

- \`CNF\`: Confirmed
- \`WL\`: Waiting List
- \`RAC\`: Reservation Against Cancellation
- \`CAN\`: Cancelled
- \`PQWL\`: Pooled Quota Waiting List
- \`TQWL\`: Tatkal Quota Waiting List
- \`RLWL\`: Remote Location Waiting List
- \`GNWL\`: General Waiting List

## Endpoint contracts (${endpointDocs.length} total)

${endpointDetails}

## Integration checklist

1. Choose SDK or REST; do not mix their parameter ordering.
2. Create and store API key server-side.
3. Validate all user inputs before calling RailKit.
4. For SDK, call \`configure\` once before other functions.
5. For REST, attach \`x-api-key\` to every request.
6. Check HTTP status where available, then check JSON \`success\`.
7. Read only fields documented for selected endpoint.
8. Handle empty arrays, nullable fields, unavailable live data, timeouts, and documented errors.
9. Avoid long-lived caching for live tracking, seat availability, PNR, and station-live results.
10. Keep links below available for current human-readable documentation.

## Documentation section links

${sectionLinks}
`;
  }, [directApiBaseUrl, flatSections]);

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(installSnippet);
      setCopiedInstall(true);
      setTimeout(() => setCopiedInstall(false), 1400);
    } catch {}
  };
  const copyAIDocsMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(aiDocsMarkdown);
      setCopiedAIMarkdown(true);
      setTimeout(() => setCopiedAIMarkdown(false), 1800);
    } catch {}
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .docs-root {
          min-height: 100vh;
          background: #ffffff;
          color: #000;
          padding-top: 60px;
        }

        /* ── Sidebar ── */
        .docs-sidebar {
          background: #ffffff;
          border-right: 1px solid rgba(0,0,0,0.06);
          overflow-y: auto;
          padding: 20px 12px;
        }
        .docs-sidebar::-webkit-scrollbar { width: 4px; }
        .docs-sidebar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }

        .docs-sidebar-group-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9ca3af;
          padding: 0 10px;
          margin-bottom: 4px;
          margin-top: 4px;
        }

        .docs-sidebar-btn {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          border: none;
          background: transparent;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: #6F6F6F;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s, color 0.15s;
          text-decoration: none;
        }
        .docs-sidebar-btn:hover { background: rgba(0,0,0,0.04); color: #000; }
        .docs-sidebar-btn-active {
          background: #000;
          color: #fff;
          font-weight: 500;
        }
        .docs-sidebar-btn-active:hover { background: #111; color: #fff; }
        .docs-method-badge {
          margin-left: auto;
          border: 1px solid #bbf7d0;
          border-radius: 5px;
          background: #f0fdf4;
          color: #15803d;
          padding: 1px 5px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1.5;
        }
        .docs-sidebar-btn-active .docs-method-badge {
          border-color: rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.12);
          color: #bbf7d0;
        }

        /* ── Main content ── */
        .docs-main { min-width: 0; max-width: 100%; overflow-x: hidden; }

        /* ── Section ── */
        .docs-section { margin-bottom: 28px; scroll-margin-top: 80px; }

        /* ── Cards ── */
        .docs-card {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.07);
          border-radius: 16px;
          overflow: hidden;
        }
        .docs-card-lift {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .docs-card-lift:hover {
          transform: translateY(-2px);
          border-color: rgba(0,0,0,0.12);
          box-shadow: 0 8px 24px rgba(0,0,0,0.06);
        }

        /* ── Introduction endpoint index ── */
        .docs-endpoint-index { margin-top: 40px; }
        .docs-endpoint-group + .docs-endpoint-group { margin-top: 32px; }
        .docs-endpoint-group-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .docs-endpoint-group-title svg { color: #2563eb; }
        .docs-endpoint-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          max-width: 900px;
        }
        .docs-endpoint-card {
          display: block;
          width: 100%;
          min-width: 0;
          height: 116px;
          overflow: hidden;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          background: #fff;
          color: inherit;
          text-decoration: none;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
          touch-action: manipulation;
        }
        .docs-endpoint-card:hover {
          transform: translateY(-1px);
          border-color: #bfdbfe;
          box-shadow: 0 8px 22px rgba(37, 99, 235, 0.07);
        }
        .docs-endpoint-card:active { transform: translateY(0); }
        .docs-endpoint-card:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.28);
          outline-offset: 2px;
        }
        .docs-endpoint-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 7px;
        }
        .docs-endpoint-method {
          flex: 0 0 auto;
          border: 1px solid #a7f3d0;
          border-radius: 4px;
          background: #ecfdf5;
          color: #047857;
          padding: 2px 7px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.04em;
          line-height: 1.4;
        }
        .docs-endpoint-path {
          display: block;
          flex: 1 1 auto;
          min-width: 0;
          overflow: hidden;
          color: #64748b;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          line-height: 1.5;
          text-overflow: ellipsis;
          text-align: right;
          white-space: nowrap;
        }
        .docs-endpoint-title {
          overflow: hidden;
          margin-bottom: 4px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .docs-endpoint-description {
          display: -webkit-box;
          overflow: hidden;
          color: #64748b;
          font-size: 11px;
          line-height: 1.55;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        @media (max-width: 720px) {
          .docs-endpoint-index { margin-top: 32px; }
          .docs-endpoint-grid { grid-template-columns: minmax(0, 1fr); }
          .docs-endpoint-card { height: 116px; }
        }

        /* ── Code block ── */
        .docs-code-wrap pre { background: transparent !important; margin: 0 !important; }
        @keyframes docs-code-fade { from { opacity: 0.35; } to { opacity: 1; } }
        .docs-code-swap { animation: docs-code-fade 0.18s ease-out both; }

        /* ── Chip buttons ── */
        .docs-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 100px;
          border: 1px solid rgba(0,0,0,0.1);
          background: transparent;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          white-space: nowrap;
        }
        .docs-chip:hover { background: #f5f5f5; border-color: rgba(0,0,0,0.15); transform: translateY(-1px); }
        .docs-chip-primary {
          background: #000;
          color: #fff;
          border-color: #000;
        }
        .docs-chip-primary:hover { background: #1a1a1a; border-color: #1a1a1a; }

        .docs-hero-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          max-width: 760px;
          margin-bottom: 32px;
        }
        .docs-hero-action {
          display: inline-flex;
          min-width: 0;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          color: #334155;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.2;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
          touch-action: manipulation;
        }
        .docs-hero-action:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
          color: #0f172a;
        }
        .docs-hero-action:active { background: #f1f5f9; }
        .docs-hero-action:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.28);
          outline-offset: 2px;
        }
        .docs-hero-action-primary {
          border-color: #0f172a;
          background: #0f172a;
          color: #fff;
        }
        .docs-hero-action-primary:hover {
          border-color: #1e293b;
          background: #1e293b;
          color: #fff;
        }
        .docs-hero-action svg { flex: 0 0 auto; }

        @media (max-width: 820px) {
          .docs-hero-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 420px) {
          .docs-hero-actions { grid-template-columns: minmax(0, 1fr); }
        }

        .docs-integration-tabs {
          display: inline-flex;
          gap: 3px;
          padding: 3px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 10px;
          background: #f5f5f5;
        }
        .docs-integration-tab {
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #6b7280;
          padding: 7px 12px;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .docs-integration-tab:hover { color: #000; }
        .docs-integration-tab-active {
          background: #fff;
          color: #000;
          box-shadow: 0 1px 4px rgba(0,0,0,0.09);
        }
        .docs-language-tab {
          border: 0;
          background: transparent;
          color: #6b7280;
          padding: 4px 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .docs-language-tab-active { color: #fff; }

        /* ── Section header ── */
        .docs-section-title {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(22px, 3vw, 30px);
          font-weight: 400;
          color: #000;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        /* ── Param chip ── */
        .docs-param {
          background: #fafafa;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 10px;
          padding: 12px 14px;
        }

        /* ── Info panel ── */
        .docs-info-panel {
          background: #fafafa;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 12px;
          padding: 16px;
        }

        /* ── Table ── */
        .docs-table { width: 100%; border-collapse: collapse; }
        .docs-table th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; border-bottom: 1px solid rgba(0,0,0,0.06); background: #fafafa; }
        .docs-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(0,0,0,0.04); }
        .docs-table tr:last-child td { border-bottom: none; }

        /* ── Animations ── */
        @keyframes docs-rise { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .docs-reveal { animation: docs-rise 0.6s ease both; }

        @media (prefers-reduced-motion: reduce) {
          .docs-reveal, .docs-card-lift, .docs-chip, .docs-hero-action, .docs-endpoint-card, .docs-code-swap { animation: none; transform: none; transition: none; }
        }
      `}</style>

      {/* ── Introduction ── */}
      {activeSlug === "introduction" && (
        <section id="introduction" className="docs-section docs-reveal">
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: 12,
            }}
          >
            RailKit developer platform
          </p>
          <h1
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: "#000",
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            Railway API documentation,{" "}
            <em style={{ fontStyle: "italic", color: "#6F6F6F" }}>
              built for production.
            </em>
          </h1>
          <p
            style={{
              fontSize: 15,
              fontWeight: 300,
              lineHeight: 1.75,
              color: "#6F6F6F",
              maxWidth: 560,
              marginBottom: 28,
            }}
          >
            Use the typed Node.js SDK or call the REST API directly. Both
            integrations cover PNR status, train info, live tracking, station
            boards, train search, seat availability, and cancellations.
          </p>

          <div className="docs-hero-actions" aria-label="Documentation actions">
            <Link
              href="/dashboard"
              className="docs-hero-action docs-hero-action-primary"
            >
              <KeyRound size={15} aria-hidden="true" />
              Get API key
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/docs/playground" className="docs-hero-action">
              <Gamepad2 size={15} aria-hidden="true" />
              Open playground
            </Link>
            <a
              href="https://www.npmjs.com/package/railkit"
              target="_blank"
              rel="noreferrer"
              className="docs-hero-action"
            >
              <Package size={15} aria-hidden="true" />
              npm package
              <ExternalLink size={13} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={copyAIDocsMarkdown}
              className="docs-hero-action"
              aria-live="polite"
            >
              {copiedAIMarkdown ? (
                <CheckCircle size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
              {copiedAIMarkdown ? "AI markdown copied" : "Copy AI markdown"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
            }}
          >
            {[
              { label: "Endpoints", value: String(endpointDocs.length) },
              { label: "Runtime", value: "Node 14+" },
              { label: "Auth", value: "API Key" },
              { label: "Access", value: "SDK + REST" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="docs-card docs-card-lift"
                style={{ padding: "14px 16px" }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#9ca3af",
                    marginBottom: 6,
                  }}
                >
                  {stat.label}
                </p>
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#000",
                  }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="docs-endpoint-index">
            <h2
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 30,
                fontWeight: 400,
                lineHeight: 1.15,
                letterSpacing: "-0.015em",
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Available endpoints
            </h2>
            <p
              style={{
                maxWidth: 560,
                marginBottom: 24,
                color: "#64748b",
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              Browse every REST endpoint. Select one for parameters, examples,
              and response contracts.
            </p>

            {introductionEndpointGroups.map((group) => {
              const GroupIcon = group.icon;
              const endpoints = group.endpointIds
                .map((id) => endpointDocsById.get(id))
                .filter((endpoint): endpoint is EndpointDoc => Boolean(endpoint));

              return (
                <section key={group.title} className="docs-endpoint-group">
                  <h3 className="docs-endpoint-group-title">
                    <GroupIcon size={15} strokeWidth={1.8} aria-hidden="true" />
                    {group.title}
                  </h3>
                  <div className="docs-endpoint-grid">
                    {endpoints.map((endpoint) => (
                      <Link
                        key={endpoint.id}
                        href={`/docs/${endpoint.id}`}
                        prefetch={false}
                        className="docs-endpoint-card"
                        aria-label={`${endpoint.title}: ${endpoint.method} ${endpoint.path}`}
                      >
                        <div className="docs-endpoint-card-top">
                          <span className="docs-endpoint-method">
                            {endpoint.method}
                          </span>
                          <code className="docs-endpoint-path" title={endpoint.path}>
                            {endpoint.path}
                          </code>
                        </div>
                        <p className="docs-endpoint-title">{endpoint.title}</p>
                        <p className="docs-endpoint-description">
                          {endpoint.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Installation ── */}
      {activeSlug === "installation" && (
        <section id="installation" className="docs-section">
          <DocsSectionHeader
            title={setupView === "sdk" ? "SDK Installation" : "REST API Access"}
            icon={Package}
          />
          {setupView === "sdk" ? (
            <>
              <div className="docs-card" style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "11px 16px",
                    borderBottom: "1px solid #21262d",
                    background: "#0d1117",
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#ff5f57",
                        display: "block",
                      }}
                    />
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#febc2e",
                        display: "block",
                      }}
                    />
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#28c840",
                        display: "block",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: "#6b7280",
                    }}
                  >
                    Terminal
                  </span>
                  <button
                    type="button"
                    onClick={copyInstall}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      color: "#9ca3af",
                      background: "transparent",
                      border: "1px solid #374151",
                      borderRadius: 6,
                      padding: "3px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {copiedInstall ? "Copied" : "Copy"}
                  </button>
                </div>
                <div style={{ background: "#0d1117", padding: "14px 18px" }}>
                  <code
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      color: "#6ee7b7",
                    }}
                  >
                    {installSnippet}
                  </code>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                <DocsInfoPanel
                  title="Requirements"
                  items={[
                    "Node.js 14+",
                    "Active internet connection",
                    "Valid API key in environment variables",
                  ]}
                />
                <DocsInfoPanel
                  title="Supported Platforms"
                  items={[
                    "Node.js apps and scripts",
                    "Express servers",
                    "Next.js App Router projects",
                    "React Native environments",
                  ]}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              <DocsInfoPanel title="Base URL" items={[directApiBaseUrl]} />
              <DocsInfoPanel
                title="Authentication"
                items={[
                  "Send x-api-key with every request",
                  "Keep API keys on your server",
                  "Direct REST access requires the Advance plan",
                ]}
              />
            </div>
          )}
        </section>
      )}

      {/* ── Quick Start ── */}
      {activeSlug === "quickstart" && (
        <section id="quickstart" className="docs-section">
          <DocsSectionHeader title="Quick Start" icon={Rocket} />
          <div
            style={{
              marginBottom: 10,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.07)",
              background: "#fafafa",
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.6,
            }}
          >
            {setupView === "sdk" ? (
              <>
                Call{" "}
                <code
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    background: "rgba(0,0,0,0.05)",
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >
                  configure(apiKey)
                </code>{" "}
                once at app startup before any request method.
              </>
            ) : (
              <>
                Send{" "}
                <code
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    background: "rgba(0,0,0,0.05)",
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >
                  x-api-key
                </code>{" "}
                with every request. Never expose keys in browser code.
              </>
            )}
          </div>
          {setupView === "rest" && (
            <LanguageTabs
              value={quickStartLanguage}
              onChange={setQuickStartLanguage}
            />
          )}
          <DocsCodePanel
            key={setupView === "sdk" ? "sdk" : quickStartLanguage}
            language={
              setupView === "sdk"
                ? "javascript"
                : apiLanguageMeta[quickStartLanguage].syntax
            }
            code={
              setupView === "sdk"
                ? quickStartSnippet
                : buildRestSnippet(
                    directApiBaseUrl,
                    endpointDocs[0].examplePath,
                    quickStartLanguage,
                  )
            }
            bodyMinHeight={setupView === "rest" ? 276 : undefined}
            swapping
          />
        </section>
      )}

      {/* ── Endpoints ── */}
      {endpointDocs
        .filter((ep) => ep.id === activeSlug)
        .map((ep) => {
          return (
            <section key={ep.id} id={ep.id} className="docs-section">
              <DocsSectionHeader title={ep.title} icon={ep.icon} />
              <EndpointDocsCard endpoint={ep} baseUrl={directApiBaseUrl} />
            </section>
          );
        })}

      {/* ── Playground ── */}
      {activeSlug === "playground" && (
        <section id="playground" className="docs-section">
          <DocsSectionHeader title="Playground" icon={Gamepad2} />
          <div className="docs-card" style={{ padding: "20px" }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 300,
                lineHeight: 1.7,
                color: "#6F6F6F",
                marginBottom: 16,
                maxWidth: 520,
              }}
            >
              The live playground is available inside your user panel. Run real
              API calls with your account key and inspect latency plus JSON
              responses.
            </p>
            <Link href="/dashboard" className="docs-chip docs-chip-primary">
              Open Playground <ChevronRight size={13} />
            </Link>
          </div>
        </section>
      )}

      {/* ── Validation ── */}
      {activeSlug === "validation" && (
        <section id="validation" className="docs-section">
          <DocsSectionHeader title="Input Validation" icon={CheckCircle} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 10,
            }}
          >
            <DocsInfoPanel
              title="PNR"
              items={[
                "Exactly 10 digits",
                "Numeric input only",
                "Reject malformed values early",
              ]}
            />
            <DocsInfoPanel
              title="Train Number"
              items={[
                "Exactly 5 digits",
                "Treat as string to preserve zeros",
                "No spaces or symbols",
              ]}
            />
            <DocsInfoPanel
              title="Date"
              items={[
                "DD-MM-YYYY format",
                "Validate real calendar date",
                "Use same format across APIs",
              ]}
            />
            <DocsInfoPanel
              title="Station Code"
              items={[
                "Uppercase station code",
                "Examples: NDLS, BCT, HWH",
                "Trim extra whitespace",
              ]}
            />
          </div>
        </section>
      )}

      {/* ── Status codes ── */}
      {activeSlug === "status-codes" && (
        <section id="status-codes" className="docs-section">
          <DocsSectionHeader title="Status Codes" icon={BarChart3} />
          <div className="docs-card" style={{ overflowX: "auto" }}>
            <table className="docs-table">
              <thead>
                <tr>
                  {["Code", "Full Form", "Description"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["CNF", "Confirmed", "Seat or berth is confirmed"],
                  ["WL", "Waiting List", "Seat not confirmed yet"],
                  [
                    "RAC",
                    "Reservation Against Cancellation",
                    "Partial seat allocation",
                  ],
                  ["CAN", "Cancelled", "Ticket is cancelled"],
                  ["PQWL", "Pooled Quota WL", "Pooled quota waiting"],
                  ["TQWL", "Tatkal Quota WL", "Tatkal waiting"],
                  ["GNWL", "General WL", "General waiting list"],
                ].map(([code, full, desc]) => (
                  <tr key={code}>
                    <td>
                      <code
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          background: "#f5f5f5",
                          border: "1px solid rgba(0,0,0,0.07)",
                          borderRadius: 5,
                          padding: "2px 7px",
                        }}
                      >
                        {code}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500, color: "#000" }}>{full}</td>
                    <td style={{ color: "#6F6F6F", fontWeight: 300 }}>
                      {desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Error handling ── */}
      {activeSlug === "errors" && (
        <section
          id="errors"
          className="docs-section"
          style={{ marginBottom: 64 }}
        >
          <DocsSectionHeader title="Error Handling" icon={AlertTriangle} />
          <div className="docs-card" style={{ overflowX: "auto", marginBottom: 10 }}>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Meaning</th>
                  <th>Backend response</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["200", "Success", "{ success: true, data: { ... } }"],
                  ["400", "Bad request — invalid input or upstream request rejected", "{ success: false, error: \"Invalid date format. Use DD-MM-YYYY.\" }"],
                  ["401", "Unauthorized — API key missing or invalid", "{ success: false, error: \"Invalid API key format\" }"],
                  ["403", "Forbidden — API key inactive", "{ success: false, error: \"API key is inactive\" }"],
                  ["404", "Not found — requested record does not exist", "{ success: false, error: \"Train history record not found\" }"],
                  ["429", "Too many requests — usage limit exceeded", "{ success: false, error: \"Usage limit exceeded\" }"],
                  ["500", "Server error — backend or upstream failure", "{ success: false, error: \"Internal server error\" }"],
                ].map(([status, meaning, response]) => (
                  <tr key={status}>
                    <td>
                      <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: status === "200" ? "#15803d" : "#b91c1c" }}>
                        {status}
                      </code>
                    </td>
                    <td style={{ color: "#374151", fontWeight: 400 }}>{meaning}</td>
                    <td>
                      <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6F6F6F" }}>
                        {response}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DocsInfoPanel
            title="Common Error Scenarios"
            items={[
              "Missing configure(apiKey) call",
              "Invalid or expired API key (401)",
              "Inactive API key (403)",
              "Rate limit exceeded (429)",
              "Invalid train/PNR/date inputs",
              "Temporary upstream timeout or API outage",
            ]}
          />
        </section>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntegrationTabs({
  value,
  onChange,
  compact = false,
}: {
  value: IntegrationView;
  onChange: (value: IntegrationView) => void;
  compact?: boolean;
}) {
  return (
    <div className="docs-integration-tabs" aria-label="Integration method">
      {(["sdk", "rest"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={`docs-integration-tab ${value === option ? "docs-integration-tab-active" : ""}`}
          style={compact ? { padding: "5px 9px", fontSize: 11 } : undefined}
          onClick={() => onChange(option)}
        >
          {option === "sdk" ? "SDK" : "REST API"}
        </button>
      ))}
    </div>
  );
}

function LanguageTabs({
  value,
  onChange,
}: {
  value: ApiCodeLanguage;
  onChange: (value: ApiCodeLanguage) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 2,
        marginBottom: 8,
      }}
      aria-label="Code language"
    >
      {(Object.keys(apiLanguageMeta) as ApiCodeLanguage[]).map((language) => (
        <button
          key={language}
          type="button"
          aria-pressed={value === language}
          className={`docs-language-tab ${value === language ? "docs-language-tab-active" : ""}`}
          style={
            value === language
              ? { background: "#0d1117", borderRadius: 6 }
              : undefined
          }
          onClick={() => onChange(language)}
        >
          {apiLanguageMeta[language].label}
        </button>
      ))}
    </div>
  );
}

function EndpointParams({ endpointId, params }: { endpointId: string; params: EndpointDoc["params"] }) {
  if (!params.length) return null;
  return (
    <div className="docs-card" style={{ overflowX: "auto", marginBottom: 16 }}>
      <table className="docs-table">
        <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          {params.map((param) => {
            const location = getEndpointParamLocation(endpointId, param.name).toUpperCase();
            const required = !isRestParamOptional(endpointId, param.name);
            return <tr key={param.name}>
              <td><code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{param.name}</code></td>
              <td><code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6b7280" }}>{location}</code></td>
              <td><code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7280" }}>{param.type}</code></td>
              <td><span style={{ color: required ? "#15803d" : "#6b7280", fontSize: 11, fontWeight: 600 }}>{required ? "YES" : "NO"}</span></td>
              <td style={{ color: "#6F6F6F", fontSize: 12, lineHeight: 1.5 }}>{param.desc}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function EndpointDocsCard({
  endpoint,
  baseUrl,
}: {
  endpoint: EndpointDoc;
  baseUrl: string;
}) {
  const [view, setView] = useState<IntegrationView>("sdk");
  const [language, setLanguage] = useState<ApiCodeLanguage>("javascript");
  const rest = endpointDocsById.get(endpoint.id);

  return (
    <div className="docs-card" style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", marginBottom: 18, overflowX: "auto", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, background: "#f8faf9" }}>
        {view === "sdk" ? (
          <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#111827", whiteSpace: "nowrap" }}>{endpoint.signature}</code>
        ) : (
          <>
            <span className="docs-method-badge" style={{ marginLeft: 0, fontSize: 9, padding: "3px 7px" }}>{endpoint.method}</span>
            <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#111827", whiteSpace: "nowrap" }}>{endpoint.path}</code>
          </>
        )}
      </div>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 7 }}>Description</p>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "#6F6F6F",
            maxWidth: 620,
          }}
        >
          {endpoint.description}
        </p>
        <IntegrationTabs value={view} onChange={setView} compact />
      </div>

      {view === "sdk" ? (
        <div key="sdk" className="docs-code-swap">
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 7 }}>Parameters</p>
          <EndpointParams endpointId={endpoint.id} params={endpoint.params} />
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 7 }}>Code Example</p>
          <DocsCodePanel language="javascript" code={endpoint.example} />
        </div>
      ) : rest ? (
        <div key="rest" className="docs-code-swap">
          <RestEndpointPanel
            endpoint={rest}
            params={endpoint.params}
            baseUrl={baseUrl}
            language={language}
            onLanguageChange={setLanguage}
          />
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 7 }}>Response Example</p>
        <DocsResponsePanel
          tone={
            endpoint.response.includes('"success": false') ? "error" : "success"
          }
          title="JSON response"
          code={endpoint.response}
        />
      </div>
    </div>
  );
}

function RestEndpointPanel({
  endpoint,
  params,
  baseUrl,
  language,
  onLanguageChange,
}: {
  endpoint: EndpointDoc;
  params: EndpointDoc["params"];
  baseUrl: string;
  language: ApiCodeLanguage;
  onLanguageChange: (value: ApiCodeLanguage) => void;
}) {
  return (
    <>
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#6b7280",
          overflowWrap: "anywhere",
          marginBottom: 6,
        }}
      >
        {baseUrl}
        {endpoint.examplePath}
      </p>
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: "#6F6F6F",
          marginBottom: 14,
        }}
      >
        {endpoint.notes}
      </p>
      <EndpointParams endpointId={endpoint.id} params={params} />
      <LanguageTabs value={language} onChange={onLanguageChange} />
      <DocsCodePanel
        key={language}
        language={apiLanguageMeta[language].syntax}
        code={buildRestSnippet(baseUrl, endpoint.examplePath, language)}
        bodyMinHeight={276}
        swapping
      />
    </>
  );
}

function DocsSectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: LucideIcon;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#f5f5f5",
          border: "1px solid rgba(0,0,0,0.07)",
          color: "#000",
          flexShrink: 0,
        }}
      >
        <Icon size={15} />
      </div>
      <h2 className="docs-section-title">{title}</h2>
    </div>
  );
}

function DocsInfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="docs-info-panel">
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#000",
          marginBottom: 10,
        }}
      >
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 13,
              color: "#6F6F6F",
              fontWeight: 300,
              lineHeight: 1.55,
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "#9ca3af",
                flexShrink: 0,
                marginTop: 6,
              }}
              aria-hidden
            />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsResponsePanel({
  title,
  code,
  tone,
}: {
  title: string;
  code: string;
  tone: "success" | "error";
}) {
  const isSuccess = tone === "success";
  const statusCode = isSuccess
    ? 200
    : code.includes('"historyKey"')
      ? 404
      : 400;
  let jsonValue: object | null = null;

  try {
    const parsed = JSON.parse(code);
    if (parsed && typeof parsed === "object") jsonValue = parsed;
  } catch {
    // Keep syntax-highlighted fallback for non-JSON reference snippets.
  }

  return (
    <div
      style={{
        height: 460,
        overflow: "hidden",
        borderRadius: 12,
        border: `1px solid ${isSuccess ? "#dbe5df" : "#f0d5d5"}`,
        background: "#0d1117",
        boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          borderBottom: "1px solid #21262d",
          background: "#161b22",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#ff5f57",
            }}
          />
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#febc2e",
            }}
          />
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#28c840",
            }}
          />
          <span
            style={{
              marginLeft: 5,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8b949e",
            }}
          >
            {title}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
          }}
        >
          <span
            style={{
              color: isSuccess ? "#7ee787" : "#ff7b72",
              fontWeight: 600,
            }}
          >
            {statusCode}
          </span>
          <span style={{ color: "#8b949e" }}>JSON</span>
        </div>
      </div>
      <div style={{ height: "calc(100% - 45px)", overflow: "auto" }}>
        {jsonValue ? (
          <ReactJson
            src={jsonValue}
            name={false}
            theme={nightOwlJsonTheme}
            iconStyle="triangle"
            indentWidth={2}
            collapsed={false}
            collapseStringsAfterLength={100}
            displayObjectSize
            displayDataTypes={false}
            enableClipboard={false}
            quotesOnKeys
            style={{
              margin: 0,
              minHeight: 120,
              padding: "14px 18px",
              background: "#0d1117",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          />
        ) : (
          <SyntaxHighlighter
            language="json"
            style={nightOwl}
            wrapLongLines
            customStyle={{
              margin: 0,
              minHeight: 120,
              padding: "16px 18px",
              background: "#0d1117",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: 1.7,
            }}
            codeTagProps={{ style: { fontFamily: "inherit" } }}
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}

function DocsCodePanel({
  language,
  code,
  bodyMinHeight,
  swapping = false,
}: {
  language: string;
  code: string;
  bodyMinHeight?: number;
  swapping?: boolean;
}) {
  return (
    <div
      className={`docs-card docs-code-wrap ${swapping ? "docs-code-swap" : ""}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          borderBottom: "1px solid #21262d",
          background: "#0d1117",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#ff5f57",
          }}
        />
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#febc2e",
          }}
        />
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#28c840",
          }}
        />
        <span
          style={{
            marginLeft: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          {language}
        </span>
      </div>
      <div
        style={{
          background: "#0d1117",
          overflowX: "auto",
          minHeight: bodyMinHeight,
        }}
      >
        <SyntaxHighlighter
          language={language}
          style={nightOwl}
          customStyle={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.75,
            background: "transparent",
            padding: "16px 18px",
            minWidth: "max-content",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
