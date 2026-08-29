"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { ThemeObject } from "react-json-view";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { packageInfo, responseFormats, sidebarGroups } from "./docsData";
import { endpointDocs, type EndpointDoc } from "./endpointDocs";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Gamepad2,
  Package,
  Rocket,
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

export default function DocsPage({
  activeSlug = "introduction",
}: {
  activeSlug?: string;
}) {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedAIMarkdown, setCopiedAIMarkdown] = useState(false);
  const [setupView, setSetupView] = useState<IntegrationView>("sdk");
  const [quickStartLanguage, setQuickStartLanguage] =
    useState<ApiCodeLanguage>("javascript");

  const directApiBaseUrl =
    process.env.NEXT_PUBLIC_DIRECT_API_BASE_URL ||
    "https://api.railkit.in";

  const flatSections = useMemo(() => sidebarGroups.flatMap((g) => g.items), []);

  const aiDocsMarkdown = useMemo(() => {
    const endpointDetails = endpointDocs
      .map((ep) => {
        const rest = endpointDocsById.get(ep.id);
        const params = ep.params.length
          ? ep.params
              .map((p) => `- \`${p.name}\` (\`${p.type}\`): ${p.desc}`)
              .join("\n")
          : "- None";
        const restContract = rest
          ? `\nREST: \`${rest.method} ${rest.path}\`\nRequired header: \`x-api-key: YOUR_API_KEY\``
          : "";
        return `### ${ep.title}\nLink: [${docsBaseUrl}/${ep.id}](${docsBaseUrl}/${ep.id})\nSDK: \`${ep.signature}\`${restContract}\nParameters:\n${params}\n\nSDK example:\n\`\`\`javascript\n${ep.example}\n\`\`\``;
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
      "errors",
    ]
      .map((id) => {
        const s = flatSections.find((i) => i.id === id);
        return s ? `- [${s.label}](${docsBaseUrl}/${s.id})` : null;
      })
      .filter(Boolean)
      .join("\n");

    return `# RailKit - Implementation Essentials\n\n## Official Links\n- Docs: [${docsBaseUrl}](${docsBaseUrl})\n- NPM: [${packageInfo.links.npm}](${packageInfo.links.npm})\n- GitHub: [${packageInfo.links.github}](${packageInfo.links.github})\n\n## REST API\n- Base URL: \`${directApiBaseUrl}\`\n- Auth header: \`x-api-key: YOUR_API_KEY\`\n- Direct REST access requires the Advance plan.\n\n## SDK Quick Setup\n\`\`\`bash\n${installSnippet}\n\`\`\`\n\n\`\`\`javascript\n${quickStartSnippet}\n\`\`\`\n\n## Section Links\n${sectionLinks}\n\n## Endpoint Contracts\n${endpointDetails}\n\n## Required Input Rules\n- PNR: exactly 10 digits\n- Train number: exactly 5 digits (string)\n- Date: DD-MM-YYYY\n- Station code: uppercase\n\n## Response Handling\nSuccess: \`{ success: true, data: { ... } }\`\nError: \`{ success: false, message: "..." }\`\n\nAlso handle:\n\`\`\`ts\n${responseFormats.error}\n\`\`\``;
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
          .docs-reveal, .docs-card-lift, .docs-chip, .docs-code-swap { animation: none; transform: none; transition: none; }
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <IntegrationTabs value={setupView} onChange={setSetupView} />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {setupView === "sdk"
                ? "Typed package for Node.js"
                : "Direct HTTP access for Advance plan"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 32,
            }}
          >
            <Link href="/dashboard" className="docs-chip docs-chip-primary">
              Open Dashboard <ChevronRight size={13} />
            </Link>
            <a
              href="https://www.npmjs.com/package/railkit"
              target="_blank"
              rel="noreferrer"
              className="docs-chip"
            >
              NPM Package
            </a>
            <button
              type="button"
              onClick={copyAIDocsMarkdown}
              className="docs-chip"
            >
              {copiedAIMarkdown ? "Copied ✓" : "Copy AI Markdown"}
            </button>
            <Link href="/dashboard" className="docs-chip">
              Playground <ChevronRight size={13} />
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
            }}
          >
            {[
              { label: "Endpoints", value: "14" },
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
  const getLocation = (name: string) => endpointId === "station-live" && name === "hours" || endpointId === "train-search" && name === "date" || endpointId === "station-timetable" && name === "date" ? "QUERY" : "PATH";
  return (
    <div className="docs-card" style={{ overflowX: "auto", marginBottom: 16 }}>
      <table className="docs-table">
        <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          {params.map((param) => {
            const location = getLocation(param.name);
            const required = location === "PATH";
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
