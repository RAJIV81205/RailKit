"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { nightOwl } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { packageInfo, responseFormats, sidebarGroups } from "./docsData";
import { useSidebar } from "./SidebarProvider";
import {
  AlertTriangle,
  Armchair,
  BarChart3,
  Building2,
  CheckCircle,
  ChevronRight,
  CircleX,
  Gamepad2,
  History,
  IndianRupee,
  MapPin,
  Package,
  Rocket,
  Search,
  Ticket,
  Train,
  type LucideIcon,
} from "lucide-react";

type EndpointSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  signature: string;
  params: Array<{ name: string; type: string; desc: string }>;
  example: string;
};

const endpointSections: EndpointSection[] = [
  {
    id: "pnr-status",
    title: "PNR Status",
    icon: Ticket,
    description: "Get complete PNR status with passenger details, journey route, and confirmation updates.",
    signature: "checkPNRStatus(pnr: string)",
    params: [{ name: "pnr", type: "string", desc: "10-digit PNR number" }],
    example: `const result = await checkPNRStatus("5827194603");

if (result.success) {
  console.log(result.data.train.name);
  console.log(result.data.journey.source.name);
  console.log(result.data.passengers[0].current.details);
}`,
  },
  {
    id: "train-info",
    title: "Train Information",
    icon: Train,
    description: "Retrieve route details, running schedule, stoppages, and station-level metadata.",
    signature: "getTrainInfo(trainNumber: string)",
    params: [{ name: "trainNumber", type: "string", desc: "5-digit train number" }],
    example: `const result = await getTrainInfo("12345");

if (result.success) {
  console.log(result.data.trainInfo.train_name);
  console.log(result.data.route.length);
}`,
  },
  {
    id: "live-tracking",
    title: "Live Tracking",
    icon: MapPin,
    description: "Track live train movement with station-by-station arrival and delay context.",
    signature: "trackTrain(trainNumber: string, date: string)",
    params: [
      { name: "trainNumber", type: "string", desc: "5-digit train number" },
      { name: "date", type: "string", desc: "Journey date in DD-MM-YYYY" },
    ],
    example: `const result = await trackTrain("12342", "06-12-2025");

if (result.success) {
  console.log(result.data.statusNote);
  console.log(result.data.timeline);
}`,
  },
  {
    id: "train-history",
    title: "Train History",
    icon: History,
    description: "Get the completed journey history of a train for a specific date — full station-by-station timeline, per-stop delays, and final coach position once the train has reached its destination.",
    signature: "getTrainHistory(trainNumber: string, journeyDate: string)",
    params: [
      { name: "trainNumber", type: "string", desc: "5-digit train number" },
      { name: "journeyDate", type: "string", desc: "Journey date in DD-MM-YYYY" },
    ],
    example: `const result = await getTrainHistory("12301", "15-04-2025");

if (result.success) {
  console.log(\`🚂 \${result.data.trainName} — \${result.data.journeyDate}\`);

  result.data.stations.forEach((stop) => {
    console.log(\`🚉 \${stop.stationName} (\${stop.stationCode}) | PF \${stop.platform}\`);
    console.log(\`   Arr: \${stop.arrival.scheduled} → \${stop.arrival.actual} (delay \${stop.arrival.delay}m)\`);
  });
}`,
  },
  {
    id: "station-live",
    title: "Live At Station",
    icon: Building2,
    description: "Get upcoming and passing trains at a station with near real-time status, delays, and platform info.",
    signature: "liveAtStation(stationCode: string, hours?: number)",
    params: [
      { name: "stationCode", type: "string", desc: "Station code such as NDLS, BCT, HWH" },
      { name: "hours", type: "number", desc: "Time window in hours — 2, 4, or 8 (default 2)" },
    ],
    example: `const result = await liveAtStation("NDLS", 2);

if (result.success) {
  console.log(result.data.summary);
  console.log("Total trains:", result.data.totalTrains);

  result.data.trains.forEach((t) => {
    console.log(\`🚂 \${t.trainNo} — \${t.trainName}\`);
    console.log(\`   \${t.sourceName} → \${t.destName} | PF \${t.platform}\`);
    console.log(\`   Arr: \${t.arrival.actual} (scheduled \${t.arrival.scheduled}, delay \${t.arrival.delay})\`);
  });
}`,
  },
  {
    id: "train-search",
    title: "Train Search",
    icon: Search,
    description: "Find available trains between stations with timetable and running-day data.",
    signature: "searchTrainBetweenStations(from: string, to: string, date?: string)",
    params: [
      { name: "from", type: "string", desc: "Origin station code" },
      { name: "to", type: "string", desc: "Destination station code" },
      { name: "date", type: "string", desc: "Journey date in DD-MM-YYYY (optional)" },
    ],
    example: `const result = await searchTrainBetweenStations("NDLS", "BCT", "25-12-2025");

if (result.success) {
  console.log(result.data.map((t) => t.train_name));
}`,
  },
  {
    id: "seat-availability",
    title: "Seat Availability",
    icon: Armchair,
    description: "Check availability forecasts and detailed fare breakup by quota and class.",
    signature: "getAvailability(trainNo, fromStnCode, toStnCode, date, coach, quota)",
    params: [
      { name: "trainNo", type: "string", desc: "5-digit train number" },
      { name: "fromStnCode", type: "string", desc: "Origin station code" },
      { name: "toStnCode", type: "string", desc: "Destination station code" },
      { name: "date", type: "string", desc: "Journey date in DD-MM-YYYY" },
      { name: "coach", type: "string", desc: "SL, 3A, 2A, 1A, CC, EC, 2S" },
      { name: "quota", type: "string", desc: "GN, TQ, LD, SS" },
    ],
    example: `const result = await getAvailability(
  "12496", "ASN", "DDU",
  "27-12-2025", "2A", "GN"
);`,
  },
  {
    id: "fare-lookup",
    title: "Fare Lookup",
    icon: IndianRupee,
    description: "Get the full fare breakdown for a journey — base fare, reservation, superfast, catering, GST, dynamic fare, and total collectible amount.",
    signature: "fareLookup(trainNo, fromStnCode, toStnCode, date, travelClass, quota)",
    params: [
      { name: "trainNo", type: "string", desc: "5-digit train number" },
      { name: "fromStnCode", type: "string", desc: "Origin station code" },
      { name: "toStnCode", type: "string", desc: "Destination station code" },
      { name: "date", type: "string", desc: "Journey date in DD-MM-YYYY" },
      { name: "travelClass", type: "string", desc: "1A · 2A · 3A · 3E · CC · EC · EA · FC · SL · 2S · VS · CH · HS · VC · VA" },
      { name: "quota", type: "string", desc: "GN · TQ · PT · LD · DF · FT · LB · YU · DP · HP · PH · SS" },
    ],
    example: `const result = await fareLookup(
  "12313", "ASN", "NDLS",
  "06-06-2026", "3A", "GN"
);

if (result.success) {
  const d = result.data;
  console.log(\`\${d.trainName} (\${d.trainNo})\`);
  console.log(\`\${d.from} → \${d.to} | \${d.distance} km\`);
  console.log(\`Base: ₹\${d.baseFare}  GST: ₹\${d.gst}  Total: ₹\${d.totalFare}\`);
}`,
  },
  {
    id: "cancelled-trains",
    title: "Cancelled Trains",
    icon: CircleX,
    description: "Get the complete list of fully and partially cancelled trains, with route details and the affected segment for partial cancellations.",
    signature: "cancelList(): Promise<Result>",
    params: [],
    example: `const result = await cancelList();

if (result.success) {
  console.log("Total:", result.summary.total);
  console.log("Fully cancelled:", result.summary.fullyCancelled);
  console.log("Partially cancelled:", result.summary.partiallyCancelled);

  result.data.fullyCancelledTrains.forEach((train) => {
    console.log(train.trainNo + " — " + train.trainName);
  });

  result.data.partiallyCancelledTrains.forEach((train) => {
    console.log(
      train.trainNo + ": " +
      train.cancelledSegment.from.name + " → " +
      train.cancelledSegment.to.name
    );
  });
}`,
  },
];

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

const docsBaseUrl = "https://railkit.rajivdubey.dev/docs";

export default function DocsPage() {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [activeSection, setActiveSection] = useState("introduction");
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedAIMarkdown, setCopiedAIMarkdown] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const flatSections = useMemo(() => sidebarGroups.flatMap((g) => g.items), []);

  const aiDocsMarkdown = useMemo(() => {
    const endpointDetails = endpointSections.map((ep) => {
      const params = ep.params.length
        ? ep.params.map((p) => `- \`${p.name}\` (\`${p.type}\`): ${p.desc}`).join("\n")
        : "- None";
      return `### ${ep.title}\nLink: [${docsBaseUrl}#${ep.id}](${docsBaseUrl}#${ep.id})\nSignature: \`${ep.signature}\`\nParameters:\n${params}\n\nExample:\n\`\`\`javascript\n${ep.example}\n\`\`\``;
    }).join("\n\n");

    const sectionLinks = ["installation","quickstart","pnr-status","train-info","live-tracking","train-history","station-live","train-search","seat-availability","fare-lookup","cancelled-trains","validation","errors"]
      .map((id) => { const s = flatSections.find((i) => i.id === id); return s ? `- [${s.label}](${docsBaseUrl}#${s.id})` : null; })
      .filter(Boolean).join("\n");

    return `# RailKit - Implementation Essentials\n\n## Official Links\n- Docs: [${docsBaseUrl}](${docsBaseUrl})\n- NPM: [${packageInfo.links.npm}](${packageInfo.links.npm})\n- GitHub: [${packageInfo.links.github}](${packageInfo.links.github})\n\n## Quick Setup\n\`\`\`bash\n${installSnippet}\n\`\`\`\n\n\`\`\`javascript\n${quickStartSnippet}\n\`\`\`\n\n## Section Links\n${sectionLinks}\n\n## Endpoint Contracts\n${endpointDetails}\n\n## Required Input Rules\n- PNR: exactly 10 digits\n- Train number: exactly 5 digits (string)\n- Date: DD-MM-YYYY\n- Station code: uppercase\n\n## Response Handling\nSuccess: \`{ success: true, data: { ... } }\`\nError: \`{ success: false, message: "..." }\`\n\nAlso handle:\n\`\`\`ts\n${responseFormats.error}\n\`\`\``;
  }, [flatSections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState(null, "", `#${sectionId}`); }
    setSidebarOpen(false);
  };

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target) return;
    setTimeout(() => { target.scrollIntoView({ behavior: "smooth", block: "start" }); setActiveSection(hash); }, 120);
  }, []);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const sections = flatSections.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[];
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.3, 0.5, 0.7] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [flatSections]);

  const copyInstall = async () => {
    try { await navigator.clipboard.writeText(installSnippet); setCopiedInstall(true); setTimeout(() => setCopiedInstall(false), 1400); } catch {}
  };
  const copyAIDocsMarkdown = async () => {
    try { await navigator.clipboard.writeText(aiDocsMarkdown); setCopiedAIMarkdown(true); setTimeout(() => setCopiedAIMarkdown(false), 1800); } catch {}
  };

  return (
    <div className="docs-root" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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
        }
        .docs-sidebar-btn:hover { background: rgba(0,0,0,0.04); color: #000; }
        .docs-sidebar-btn-active {
          background: #000;
          color: #fff;
          font-weight: 500;
        }
        .docs-sidebar-btn-active:hover { background: #111; color: #fff; }

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
          .docs-reveal, .docs-card-lift, .docs-chip { animation: none; transform: none; transition: none; }
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "240px minmax(0,1fr)" : "1fr", gap: 0, minHeight: "calc(100vh - 60px)" }}>

          {/* ── Sidebar ── */}
          <aside
            className="docs-sidebar"
            style={{
              position: isDesktop ? "sticky" : "fixed",
              top: isDesktop ? 60 : 60,
              left: isDesktop ? "auto" : 0,
              width: isDesktop ? "auto" : 260,
              height: isDesktop ? "calc(100vh - 60px)" : "calc(100vh - 60px)",
              zIndex: 30,
              transform: sidebarOpen || isDesktop ? "translateX(0)" : "translateX(-110%)",
              transition: "transform 0.22s ease",
              alignSelf: "start",
            }}
          >
            {sidebarGroups.map((group, gi) => (
              <div key={group.title} style={{ marginBottom: gi < sidebarGroups.length - 1 ? 20 : 0 }}>
                <p className="docs-sidebar-group-label">{group.title}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
                  {group.items.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className={`docs-sidebar-btn ${isActive ? "docs-sidebar-btn-active" : ""}`}
                      >
                        <Icon size={14} style={{ flexShrink: 0 }} />
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          {/* ── Main ── */}
          <main className="docs-main" style={{ padding: isDesktop ? "32px 0 64px 40px" : "24px 0 64px" }}>

            {/* ── Introduction ── */}
            <section id="introduction" className="docs-section docs-reveal">
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 12 }}>
                RailKit SDK
              </p>
              <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.025em", color: "#000", marginBottom: 16, maxWidth: 640 }}>
                Railway API documentation,{" "}
                <em style={{ fontStyle: "italic", color: "#6F6F6F" }}>built for production.</em>
              </h1>
              <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.75, color: "#6F6F6F", maxWidth: 560, marginBottom: 28 }}>
                Install the Node.js SDK, configure your API key, and call typed methods for PNR status,
                train info, live tracking, station boards, train search, seat availability, and cancellations.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
                <Link href="/dashboard" className="docs-chip docs-chip-primary">
                  Open Dashboard <ChevronRight size={13} />
                </Link>
                <a href="https://www.npmjs.com/package/railkit" target="_blank" rel="noreferrer" className="docs-chip">
                  NPM Package
                </a>
                <button type="button" onClick={copyAIDocsMarkdown} className="docs-chip">
                  {copiedAIMarkdown ? "Copied ✓" : "Copy AI Markdown"}
                </button>
                <Link href="/dashboard" className="docs-chip">
                  Playground <ChevronRight size={13} />
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                {[
                  { label: "Endpoints", value: "9" },
                  { label: "Runtime", value: "Node 14+" },
                  { label: "Auth", value: "API Key" },
                  { label: "Package", value: "railkit" },
                ].map((stat) => (
                  <div key={stat.label} className="docs-card docs-card-lift" style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 6 }}>{stat.label}</p>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 500, color: "#000" }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Installation ── */}
            <section id="installation" className="docs-section">
              <DocsSectionHeader title="Installation" icon={Package} />
              <div className="docs-card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid #21262d", background: "#0d1117" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "block" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e", display: "block" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", display: "block" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7280" }}>Terminal</span>
                  <button type="button" onClick={copyInstall}
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#9ca3af", background: "transparent", border: "1px solid #374151", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                    {copiedInstall ? "Copied" : "Copy"}
                  </button>
                </div>
                <div style={{ background: "#0d1117", padding: "14px 18px" }}>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#6ee7b7" }}>{installSnippet}</code>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <DocsInfoPanel title="Requirements" items={["Node.js 14+", "Active internet connection", "Valid API key in environment variables"]} />
                <DocsInfoPanel title="Supported Platforms" items={["Node.js apps and scripts", "Express servers", "Next.js App Router projects", "React Native environments"]} />
              </div>
            </section>

            {/* ── Quick Start ── */}
            <section id="quickstart" className="docs-section">
              <DocsSectionHeader title="Quick Start" icon={Rocket} />
              <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "#fafafa", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                Call <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 4 }}>configure(apiKey)</code> once at app startup before any request method.
              </div>
              <DocsCodePanel language="javascript" code={quickStartSnippet} />
            </section>

            {/* ── Endpoints ── */}
            {endpointSections.map((ep) => (
              <section key={ep.id} id={ep.id} className="docs-section">
                <DocsSectionHeader title={ep.title} icon={ep.icon} />
                <div className="docs-card" style={{ padding: "20px 20px 20px" }}>
                  <p style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.7, color: "#6F6F6F", marginBottom: 14 }}>{ep.description}</p>
                  <code style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#000", background: "#f5f5f5", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "9px 12px", marginBottom: 14, overflowX: "auto" }}>
                    {ep.signature}
                  </code>
                  {ep.params.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 14 }}>
                      {ep.params.map((param) => (
                        <div key={param.name} className="docs-param">
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#000", marginBottom: 3 }}>{param.name}</p>
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{param.type}</p>
                          <p style={{ fontSize: 12, lineHeight: 1.55, color: "#6F6F6F", fontWeight: 300 }}>{param.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <DocsCodePanel language="javascript" code={ep.example} />
                </div>
              </section>
            ))}

            {/* ── Playground ── */}
            <section id="playground" className="docs-section">
              <DocsSectionHeader title="Playground" icon={Gamepad2} />
              <div className="docs-card" style={{ padding: "20px" }}>
                <p style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.7, color: "#6F6F6F", marginBottom: 16, maxWidth: 520 }}>
                  The live playground is available inside your user panel. Run real API calls with your account key and inspect latency plus JSON responses.
                </p>
                <Link href="/dashboard" className="docs-chip docs-chip-primary">
                  Open Playground <ChevronRight size={13} />
                </Link>
              </div>
            </section>

            {/* ── Validation ── */}
            <section id="validation" className="docs-section">
              <DocsSectionHeader title="Input Validation" icon={CheckCircle} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                <DocsInfoPanel title="PNR" items={["Exactly 10 digits", "Numeric input only", "Reject malformed values early"]} />
                <DocsInfoPanel title="Train Number" items={["Exactly 5 digits", "Treat as string to preserve zeros", "No spaces or symbols"]} />
                <DocsInfoPanel title="Date" items={["DD-MM-YYYY format", "Validate real calendar date", "Use same format across APIs"]} />
                <DocsInfoPanel title="Station Code" items={["Uppercase station code", "Examples: NDLS, BCT, HWH", "Trim extra whitespace"]} />
              </div>
            </section>

            {/* ── Status codes ── */}
            <section id="status-codes" className="docs-section">
              <DocsSectionHeader title="Status Codes" icon={BarChart3} />
              <div className="docs-card" style={{ overflowX: "auto" }}>
                <table className="docs-table">
                  <thead>
                    <tr>
                      {["Code", "Full Form", "Description"].map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["CNF", "Confirmed", "Seat or berth is confirmed"],
                      ["WL", "Waiting List", "Seat not confirmed yet"],
                      ["RAC", "Reservation Against Cancellation", "Partial seat allocation"],
                      ["CAN", "Cancelled", "Ticket is cancelled"],
                      ["PQWL", "Pooled Quota WL", "Pooled quota waiting"],
                      ["TQWL", "Tatkal Quota WL", "Tatkal waiting"],
                      ["GNWL", "General WL", "General waiting list"],
                    ].map(([code, full, desc]) => (
                      <tr key={code}>
                        <td><code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: "#f5f5f5", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 5, padding: "2px 7px" }}>{code}</code></td>
                        <td style={{ fontWeight: 500, color: "#000" }}>{full}</td>
                        <td style={{ color: "#6F6F6F", fontWeight: 300 }}>{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Error handling ── */}
            <section id="errors" className="docs-section" style={{ marginBottom: 64 }}>
              <DocsSectionHeader title="Error Handling" icon={AlertTriangle} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 10 }}>
                <DocsResponsePanel tone="success" title="Success Response" code={`{\n  success: true,\n  data: { ... }\n}`} />
                <DocsResponsePanel tone="error" title="Error Response" code={`{\n  success: false,\n  message: "Error message"\n}`} />
              </div>
              <DocsInfoPanel title="Common Error Scenarios" items={[
                "Missing configure(apiKey) call",
                "Invalid or expired API key (401)",
                "Inactive API key (403)",
                "Rate limit exceeded (429)",
                "Invalid train/PNR/date inputs",
                "Temporary upstream timeout or API outage",
              ]} />
            </section>

          </main>
        </div>
      </div>

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)", border: "none", cursor: "pointer" }}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocsSectionHeader({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "#f5f5f5", border: "1px solid rgba(0,0,0,0.07)", color: "#000", flexShrink: 0 }}>
        <Icon size={15} />
      </div>
      <h2 className="docs-section-title">{title}</h2>
    </div>
  );
}

function DocsInfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="docs-info-panel">
      <p style={{ fontSize: 12, fontWeight: 600, color: "#000", marginBottom: 10 }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#6F6F6F", fontWeight: 300, lineHeight: 1.55 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#9ca3af", flexShrink: 0, marginTop: 6 }} aria-hidden />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsResponsePanel({ title, code, tone }: { title: string; code: string; tone: "success" | "error" }) {
  const isSuccess = tone === "success";
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${isSuccess ? "rgba(0,0,0,0.07)" : "rgba(220,38,38,0.12)"}`, background: isSuccess ? "#fafafa" : "#fff8f8", padding: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: isSuccess ? "#000" : "#b91c1c", marginBottom: 10 }}>{title}</p>
      <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7, color: isSuccess ? "#374151" : "#b91c1c" }}>{code}</pre>
    </div>
  );
}

function DocsCodePanel({ language, code }: { language: string; code: string }) {
  return (
    <div className="docs-card docs-code-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderBottom: "1px solid #21262d", background: "#0d1117" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6b7280" }}>{language}</span>
      </div>
      <div style={{ background: "#0d1117", overflowX: "auto" }}>
        <SyntaxHighlighter
          language={language}
          style={nightOwl}
          customStyle={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, background: "transparent", padding: "16px 18px", minWidth: "max-content" }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
