import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import {
  ArrowRight,
  CheckCircle2,
  Github,
  Users,
  Twitter,
} from "lucide-react";
// Github is deprecated in newer lucide versions — aliased here for compatibility
import {
  absoluteUrl,
  buildMetadata,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "../lib/seo";
import { CinematicHero } from "../components/CinematicHero";
import { MoochiFollower } from "../components/MoochiFollower";
import { endpointDocs } from "../components/docs/endpointDocs";

export const metadata: Metadata = {
  ...buildMetadata({
    title: undefined,
    description:
      "RailKit is a Node.js SDK and Indian Railways API for PNR status, live train tracking, cancelled trains, train search, station boards, and seat availability.",
    path: "/",
  }),
};

/* ─────────────────────────────────────────────
   Data fetching
───────────────────────────────────────────── */
async function getStats() {
  try {
    const [githubRes, npmRes] = await Promise.all([
      fetch("https://api.github.com/repos/RAJIV81205/railkit", {
        next: { revalidate: 3600 },
      }),
      fetch("https://api.npmjs.org/downloads/point/last-month/railkit", {
        next: { revalidate: 3600 },
      }),
    ]);
    const github = await githubRes.json();
    const npm = await npmRes.json();
    return {
      stars: github.stargazers_count || 0,
      downloads: npm.downloads || 0,
    };
  } catch {
    return { stars: 0, downloads: 0 };
  }
}

type EnterpriseShowcaseUser = { id: string; name: string; maskedEmail: string };

const enterpriseUsersFallback: EnterpriseShowcaseUser[] = [
  { id: "f-1", name: "Nikhil S.", maskedEmail: "nikh.....gma.com" },
  { id: "f-2", name: "Priya R.", maskedEmail: "priy.....out.com" },
  { id: "f-3", name: "Ankit V.", maskedEmail: "anki.....yah.com" },
  { id: "f-4", name: "Ritika M.", maskedEmail: "riti.....gma.com" },
  { id: "f-5", name: "Aarav J.", maskedEmail: "aara.....pro.com" },
  { id: "f-6", name: "Sneha K.", maskedEmail: "sneh.....zoh.com" },
];

function shuffleUsers<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function getEnterpriseShowcaseUsers(): Promise<EnterpriseShowcaseUser[]> {
  try {
    const headerStore = await headers();
    const host =
      headerStore.get("x-forwarded-host") || headerStore.get("host");
    const proto =
      headerStore.get("x-forwarded-proto") ||
      (host?.includes("localhost") ? "http" : "https");
    const base = host ? `${proto}://${host}` : absoluteUrl("/");
    const res = await fetch(`${base}/api/public/enterprise-users`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      success?: boolean;
      users?: EnterpriseShowcaseUser[];
    };
    if (!res.ok || !data?.success || !Array.isArray(data.users)) {
      return shuffleUsers(enterpriseUsersFallback);
    }
    return data.users.length > 0
      ? data.users
      : shuffleUsers(enterpriseUsersFallback);
  } catch {
    return shuffleUsers(enterpriseUsersFallback);
  }
}

/* ─────────────────────────────────────────────
   Static data
───────────────────────────────────────────── */
const endpoints = endpointDocs.map((endpoint) => ({
  id: endpoint.id,
  icon: endpoint.icon,
  title: endpoint.title,
  method: endpoint.signature.slice(0, endpoint.signature.indexOf("(")),
  description: endpoint.description,
}));

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default async function LandingPage() {
  const [stats, enterpriseUsers] = await Promise.all([
    getStats(),
    getEnterpriseShowcaseUsers(),
  ]);

  const heroStats = [
    { label: "API Requests", value: "3M+" },
    { label: "Uptime", value: "99.9%" },
    { label: "Live Train Data", value: "✓" },
    { label: "SDK", value: "v4.1.0" },
  ];

  // Stable @id anchors so schema nodes reference one another (entity consolidation).
  const orgId = `${absoluteUrl("/")}#organization`;
  const websiteId = `${absoluteUrl("/")}#website`;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": orgId,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icon.png"),
    },
    description: SITE_DESCRIPTION,
    founder: {
      "@type": "Person",
      name: "Rajiv Dubey",
      url: "https://github.com/RAJIV81205",
    },
    sameAs: [
      "https://github.com/RAJIV81205/railkit",
      "https://github.com/RAJIV81205",
      "https://www.npmjs.com/package/railkit",
      "https://twitter.com/rajiv81205",
    ],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    publisher: { "@id": orgId },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/docs")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "railkit",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Node.js",
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    softwareVersion: "4.1.0",
    downloadUrl: "https://www.npmjs.com/package/railkit",
    codeRepository: "https://github.com/RAJIV81205/railkit",
    featureList: endpoints.map((endpoint) => endpoint.title),
    author: {
      "@type": "Person",
      name: "Rajiv Dubey",
      url: "https://github.com/RAJIV81205",
    },
    publisher: { "@id": orgId },
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
      { "@type": "Offer", name: "Pro", price: "49", priceCurrency: "INR", url: absoluteUrl("/pricing") },
    ],
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    ],
  };

  // Single source of truth: drives both the visible FAQ section and FAQPage
  // schema. Answers MUST stay identical between the two (Google requirement).
  const faqs = [
    {
      q: "How do I check PNR status with an API?",
      a: "Sign up for a free RailKit API key, then call the getPNRStatus method (or the REST PNR endpoint) with a 10-digit PNR number. You get back the booking status, coach and berth details, boarding point, and chart status as JSON — ready to use in any Node.js, JavaScript, or TypeScript backend.",
    },
    {
      q: "How do I track a train live and get its running status?",
      a: "Use the live train tracking method with a train number to fetch real-time running status: current location, last reported station, delay in minutes, and upcoming stops with expected arrival and departure times. It works for any train on the Indian Railways network.",
    },
    {
      q: "How do I search for trains between two stations?",
      a: "Call the train-between-stations method with a source and destination station code (and optional date). RailKit returns every train on that route with departure and arrival times, running days, train type, and available classes — ideal for building journey-planning features.",
    },
    {
      q: "Is there a free tier and how do I get an API key?",
      a: "Yes. RailKit has a free tier so you can start building right away. Create an account, generate your API key from the dashboard, and start calling railway endpoints in minutes. Paid plans start at ₹49 when you need higher rate limits — see the pricing page for details.",
    },
    {
      q: "Does it support seat availability and fare enquiry?",
      a: "It does. You can check seat and berth availability for a train, class, and date, and run a fare enquiry to get class-wise ticket prices. Both are exposed as simple promise-based methods in the SDK and as REST endpoints.",
    },
    {
      q: "Does RailKit support Node.js and TypeScript?",
      a: "RailKit is a promise-based Node.js SDK with first-class TypeScript types built in. Install it with npm install railkit, import the client, and every method is fully typed with autocomplete for requests and responses.",
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main style={{ background: "#ffffff", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <MoochiFollower />

      {/* ── CINEMATIC HERO ── */}
      <CinematicHero stats={heroStats} />

      {/* ── ENDPOINTS ── */}
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-section-head">
            <p className="lp-eyebrow">What it includes</p>
            <h2 className="lp-h2">
              {endpoints.length} methods.
              <br />
              Every use case.
            </h2>
            <p className="lp-body">
              Each method maps to a clear railway data use case. Your team can
              understand the integration at a glance.
            </p>
          </div>

          <div className="lp-endpoints">
            {endpoints.map((ep) => (
              <Link
                key={ep.id}
                href={`/docs/${ep.id}`}
                prefetch={false}
                className="lp-ep-card"
              >
                <div className="lp-ep-icon" aria-hidden>
                  <ep.icon size={17} />
                </div>
                <div className="lp-ep-title">{ep.title}</div>
                <code className="lp-ep-method">{ep.method}()</code>
                <p className="lp-ep-desc">{ep.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CODE SHOWCASE ── */}
      <section className="lp-section lp-section-tinted">
        <div className="lp-inner">
          <div className="lp-code-grid">
            {/* Left: copy */}
            <div className="lp-code-copy">
              <p className="lp-eyebrow">How developers use it</p>
              <h2 className="lp-h2" style={{ maxWidth: 400 }}>
                Small surface.
                <br />
                Built for backends.
              </h2>
              <p className="lp-body">
                Works in API routes, background jobs, support tools, or mobile
                app backends. One key, one import, {endpoints.length} methods.
              </p>
              <ul className="lp-checklist">
                {[
                  "Predictable response shape",
                  "Works with any server-side framework",
                  "Usage plans and developer dashboard",
                  "TypeScript types included",
                ].map((f) => (
                  <li key={f} className="lp-check-item">
                    <CheckCircle2 size={15} className="lp-check-icon" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: code block */}
            <div className="lp-code-block">
              <div className="lp-code-bar">
                <div className="lp-dots">
                  <span className="lp-dot lp-dot-r" />
                  <span className="lp-dot lp-dot-y" />
                  <span className="lp-dot lp-dot-g" />
                </div>
                <span className="lp-code-fname">journey.ts</span>
                <span style={{ width: 52 }} />
              </div>
              <pre className="lp-pre" aria-label="Code example">
                <code>
                  <span className="lk">import</span>
                  {" { configure,\n         checkPNRStatus, trackTrain }\n"}
                  <span className="lk">from</span>{" "}
                  <span className="ls">&quot;railkit&quot;</span>
                  {"\n\n"}
                  <span className="lc">{"// one-time setup"}</span>
                  {"\n"}
                  <span className="lf">configure</span>
                  {"(process.env."}
                  <span className="le">RAILKIT_API_KEY</span>
                  {")\n\n"}
                  <span className="lk">export async function</span>
                  {" "}
                  <span className="lf">getJourney</span>
                  {"(pnr: "}
                  <span className="lt">string</span>
                  {") {\n  "}
                  <span className="lk">const</span>
                  {" status = "}
                  <span className="lk">await</span>
                  {"\n    "}
                  <span className="lf">checkPNRStatus</span>
                  {"(pnr)\n\n  "}
                  <span className="lk">const</span>
                  {" live = "}
                  <span className="lk">await</span>
                  {"\n    "}
                  <span className="lf">trackTrain</span>
                  {"("}
                  <span className="ls">&quot;12342&quot;</span>
                  {", "}
                  <span className="ls">&quot;06-12-2025&quot;</span>
                  {")\n\n  "}
                  <span className="lk">return</span>
                  {" { status, live }\n}"}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── ENTERPRISE + CTA ── */}
      <section className="lp-section">
        <div className="lp-inner">
          <div className="lp-bottom-grid">
            {/* Enterprise users */}
            <div className="lp-users-card">
              <div className="lp-users-head">
                <Users size={17} style={{ color: "#9ca3af" }} />
                <div>
                  <div className="lp-users-title">Active Enterprise Users</div>
                  <div className="lp-users-sub">
                    Teams currently on paid access
                  </div>
                </div>
              </div>
              <div className="lp-users-grid">
                {enterpriseUsers.slice(0, 6).map((u) => (
                  <div key={u.id} className="lp-user-chip">
                    <div className="lp-user-name">{u.name}</div>
                    <div className="lp-user-email">{u.maskedEmail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA card */}
            <div className="lp-cta-card">
              <div className="lp-cta-glow" aria-hidden />
              <p className="lp-cta-label">Ready to build?</p>
              <h3 className="lp-cta-title">
                Connect your app to Indian Railways.
              </h3>
              <p className="lp-cta-desc">
                Create an account, get your key, and start calling railway
                endpoints from your own backend in minutes.
              </p>
              <Link href="/auth" className="lp-cta-btn-primary">
                Get API key
                <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/RAJIV81205/railkit"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-cta-btn-ghost"
              >
                <Github size={15} />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section lp-section-tinted" aria-labelledby="faq-heading">
        <div className="lp-inner">
          <div className="lp-section-head">
            <p className="lp-eyebrow">Questions, answered</p>
            <h2 className="lp-h2" id="faq-heading">
              Frequently asked
              <br />
              questions.
            </h2>
            <p className="lp-body">
              Everything developers ask before integrating the Indian Railways
              API — PNR status, live tracking, seat availability and more.
            </p>
          </div>

          <div className="lp-faq">
            {faqs.map((item) => (
              <details key={item.q} className="lp-faq-item">
                <summary className="lp-faq-q">
                  <span>{item.q}</span>
                  <span className="lp-faq-icon" aria-hidden>+</span>
                </summary>
                <p className="lp-faq-a">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-inner lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-footer-logo">
              <div className="lp-footer-logo-mark">
                <Image
                  src="/icon.png"
                  alt="RailKit"
                  width={24}
                  height={24}
                  style={{ objectFit: "contain" }}
                />
              </div>
              <span className="lp-footer-logo-name">RailKit</span>
            </div>
            <p className="lp-footer-kicker">Developer platform</p>
            <p className="lp-footer-copy">
              API + SDK for PNR, live tracking, seat availability, and rail
              workflows.
            </p>
            <p className="lp-footer-meta">
              Built by{" "}
              <a
                href="https://github.com/RAJIV81205"
                target="_blank"
                rel="noopener noreferrer"
              >
                Rajiv Dubey
              </a>
              {stats.stars > 0 && (
                <>
                  {" "}
                  · {stats.stars.toLocaleString()} stars ·{" "}
                  {stats.downloads.toLocaleString()} downloads/mo
                </>
              )}
            </p>
          </div>

          <div className="lp-footer-links-wrap">
            <div className="lp-footer-col">
              <div className="lp-footer-title">Pages</div>
              <Link href="/" className="lp-footer-link">
                Home
              </Link>
              <Link href="/docs" className="lp-footer-link">
                Docs
              </Link>
              <Link href="/pricing" className="lp-footer-link">
                Pricing
              </Link>
              <Link href="/contact" className="lp-footer-link">
                Contact
              </Link>
            </div>

            <div className="lp-footer-col">
              <div className="lp-footer-title">Legal</div>
              <Link href="/terms" className="lp-footer-link">
                Terms
              </Link>
              <Link href="/privacy" className="lp-footer-link">
                Privacy
              </Link>
            </div>

            <div className="lp-footer-col">
              <div className="lp-footer-title">Social</div>
              <a
                href="https://github.com/RAJIV81205/railkit"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-footer-link lp-footer-social"
              >
                <Github size={14} />
                GitHub
              </a>
              <a
                href="https://twitter.com/RailKitAPI"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-footer-link lp-footer-social"
              >
                <Twitter size={14} />
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        /* ── Layout ── */
        .lp-section { padding: 80px 40px; }
        .lp-section, .lp-footer {
          content-visibility: auto;
          contain-intrinsic-size: auto 700px;
        }
        .lp-section-tinted {
          background: #fafafa;
          border-top: 1px solid #f3f4f6;
          border-bottom: 1px solid #f3f4f6;
        }
        .lp-inner { max-width: 1160px; margin: 0 auto; min-width: 0; }

        @media (max-width: 768px) { .lp-section { padding: 64px 24px; } }
        @media (max-width: 480px) { .lp-section { padding: 52px 20px; } }

        /* ── Section heading ── */
        .lp-section-head { margin-bottom: 48px; }
        .lp-eyebrow {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 10px;
        }
        .lp-h2 {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: clamp(28px, 4vw, 52px);
          font-weight: 400;
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: #000;
          margin: 0 0 14px;
        }
        .lp-body {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 15px;
          font-weight: 300;
          line-height: 1.7;
          color: #6F6F6F;
          max-width: 480px;
        }

        /* ── Endpoints grid ── */
        .lp-endpoints {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #f3f4f6;
          border: 1px solid #f3f4f6;
          border-radius: 16px;
          overflow: hidden;
        }
        @media (max-width: 860px) { .lp-endpoints { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .lp-endpoints { grid-template-columns: 1fr; border-radius: 12px; } }

        .lp-ep-card {
          display: block;
          background: #fff;
          color: inherit;
          padding: 24px 20px;
          text-decoration: none;
          transition: background 0.2s;
          touch-action: manipulation;
        }
        .lp-ep-card:hover { background: #fafafa; }
        .lp-ep-card:active { background: #f3f4f6; }
        .lp-ep-card:focus-visible {
          position: relative;
          z-index: 1;
          outline: 3px solid rgba(37, 99, 235, 0.35);
          outline-offset: -3px;
        }
        .lp-ep-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px; height: 34px;
          background: #f3f4f6;
          border-radius: 8px;
          color: #374151;
          margin-bottom: 14px;
          transition: background 0.2s, color 0.2s;
          flex-shrink: 0;
        }
        .lp-ep-card:hover .lp-ep-icon { background: #000; color: #fff; }
        .lp-ep-title {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #000;
          margin-bottom: 5px;
        }
        .lp-ep-method {
          font-family: var(--font-code), monospace;
          font-size: 11px;
          color: #6b7280;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 2px 6px;
          display: inline-block;
          margin-bottom: 9px;
        }
        .lp-ep-desc {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #6F6F6F;
          margin: 0;
        }

        /* ── Code showcase ── */
        .lp-code-grid {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 56px;
          align-items: center;
        }
        @media (max-width: 860px) { .lp-code-grid { grid-template-columns: 1fr; gap: 36px; } }

        .lp-checklist {
          list-style: none;
          padding: 0;
          margin: 24px 0 0;
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .lp-check-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          color: #374151;
        }
        .lp-check-icon { color: #000; flex-shrink: 0; }

        /* Code block */
        .lp-code-block {
          background: #0d1117;
          border: 1px solid #21262d;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 56px rgba(0,0,0,0.12);
        }
        .lp-code-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 16px;
          border-bottom: 1px solid #21262d;
          background: #161b22;
        }
        .lp-dots { display: flex; gap: 6px; }
        .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-dot-r { background: #ff5f57; }
        .lp-dot-y { background: #febc2e; }
        .lp-dot-g { background: #28c840; }
        .lp-code-fname {
          font-family: var(--font-code), monospace;
          font-size: 12px;
          color: #6b7280;
        }
        .lp-pre {
          margin: 0;
          padding: 20px;
          font-family: var(--font-code), monospace;
          font-size: 12.5px;
          line-height: 1.85;
          color: #c9d1d9;
          overflow-x: auto;
        }
        @media (max-width: 480px) { .lp-pre { font-size: 11.5px; padding: 16px; } }
        .lp-pre .lk { color: #ff7b72; }
        .lp-pre .lf { color: #d2a8ff; }
        .lp-pre .ls { color: #a5d6ff; }
        .lp-pre .lc { color: #8b949e; }
        .lp-pre .le { color: #6ee7b7; }
        .lp-pre .lt { color: #79c0ff; }

        /* ── Bottom grid ── */
        .lp-bottom-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
          align-items: start;
          /* prevent children from overflowing */
          min-width: 0;
        }
        @media (max-width: 860px) {
          .lp-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Enterprise users card */
        .lp-users-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          /* prevent card from overflowing its grid cell */
          min-width: 0;
          overflow: hidden;
        }
        .lp-users-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }
        .lp-users-title {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #000;
        }
        .lp-users-sub {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 12px;
          color: #9ca3af;
          margin-top: 2px;
        }
        .lp-users-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .lp-user-chip {
          background: #fafafa;
          border: 1px solid #f3f4f6;
          border-radius: 10px;
          padding: 10px 12px;
          transition: border-color 0.15s;
          /* critical: prevent chip from blowing out the grid */
          min-width: 0;
          overflow: hidden;
        }
        .lp-user-chip:hover { border-color: #e5e7eb; }
        .lp-user-name {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: #000;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lp-user-email {
          font-family: var(--font-code), monospace;
          font-size: 10px;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* CTA card */
        .lp-cta-card {
          background: #000;
          border-radius: 16px;
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }
        @media (max-width: 480px) { .lp-cta-card { padding: 24px 20px; } }
        .lp-cta-glow {
          position: absolute;
          top: -80px; right: -80px;
          width: 220px; height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%);
          pointer-events: none;
        }
        .lp-cta-label {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 10px;
        }
        .lp-cta-title {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: clamp(20px, 2.5vw, 28px);
          font-weight: 400;
          color: #fff;
          line-height: 1.15;
          margin: 0 0 12px;
        }
        .lp-cta-desc {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          font-weight: 300;
          line-height: 1.65;
          color: #6b7280;
          margin: 0 0 24px;
        }
        .lp-cta-btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px 20px;
          background: #fff;
          color: #000;
          border-radius: 10px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          margin-bottom: 8px;
          transition: background 0.15s, transform 0.15s;
        }
        .lp-cta-btn-primary:hover { background: #f0f0f0; transform: translateY(-1px); }
        .lp-cta-btn-ghost {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          color: #6b7280;
          border: 1px solid #21262d;
          border-radius: 10px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .lp-cta-btn-ghost:hover { background: #161b22; color: #f9fafb; }

        /* ── FAQ ── */
        .lp-faq {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: #f3f4f6;
          border: 1px solid #f3f4f6;
          border-radius: 16px;
          overflow: hidden;
        }
        @media (max-width: 480px) { .lp-faq { border-radius: 12px; } }
        .lp-faq-item { background: #fff; }
        .lp-faq-q {
          list-style: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 24px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #000;
          transition: background 0.15s;
        }
        .lp-faq-q::-webkit-details-marker { display: none; }
        .lp-faq-q:hover { background: #fafafa; }
        @media (max-width: 480px) { .lp-faq-q { padding: 16px 18px; font-size: 14px; } }
        .lp-faq-icon {
          flex-shrink: 0;
          font-size: 20px;
          font-weight: 300;
          color: #9ca3af;
          transition: transform 0.2s ease;
          line-height: 1;
        }
        .lp-faq-item[open] .lp-faq-icon { transform: rotate(45deg); }
        .lp-faq-a {
          margin: 0;
          padding: 0 24px 22px;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          font-weight: 300;
          line-height: 1.7;
          color: #6F6F6F;
          max-width: 720px;
        }
        @media (max-width: 480px) { .lp-faq-a { padding: 0 18px 18px; } }

        /* ── Footer ── */
        .lp-footer {
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          background:
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.45), transparent 34%),
            linear-gradient(180deg, #f7f1e8 0%, #eee4d6 100%);
          padding: 64px 24px 56px;
          min-height: 50vh;
          display: flex;
          align-items: center;
        }
        .lp-footer-inner {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 28px;
          align-items: start;
          min-height: 220px;
          width: 100%;
        }
        @media (max-width: 860px) {
          .lp-footer-inner {
            grid-template-columns: 1fr;
          }
        }
        .lp-footer-brand {
          min-width: 0;
        }
        .lp-footer-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .lp-footer-logo-mark {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .lp-footer-logo-name {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: 24px;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: #000;
          line-height: 1;
        }
        .lp-footer-kicker {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7c6f62;
          margin: 0 0 12px;
        }
        .lp-footer-copy {
          font-family: var(--font-landing-serif), Georgia, serif;
          font-size: clamp(22px, 2.5vw, 30px);
          line-height: 1.18;
          color: #000;
          margin: 0 0 12px;
          max-width: 520px;
        }
        .lp-footer-meta {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #6f6256;
          margin: 0;
        }
        .lp-footer-meta a {
          color: #4b4036;
          text-decoration: none;
          border-bottom: 1px solid transparent;
        }
        .lp-footer-meta a:hover {
          color: #000;
          border-bottom-color: #000;
        }
        .lp-footer-links-wrap {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          padding-top: 8px;
        }
        @media (max-width: 560px) {
          .lp-footer-links-wrap {
            grid-template-columns: 1fr;
          }
        }
        .lp-footer-col {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }
        .lp-footer-title {
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #7c6f62;
          margin-bottom: 2px;
        }
        .lp-footer-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          font-family: var(--font-landing-sans), system-ui, sans-serif;
          font-size: 14px;
          color: #3d342b;
          text-decoration: none;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .lp-footer-link:hover {
          color: #000;
          transform: translateX(1px);
        }
        .lp-footer-social {
          color: #3d342b;
        }
      `}</style>
    </main>
  );
}
