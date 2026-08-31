import type { Metadata } from "next";
import Link from "next/link";
import {
	Activity,
	ArrowRight,
	BookOpen,
	Github,
	Mail,
	MessageCircle,
	Send,
} from "lucide-react";
import { buildMetadata, absoluteUrl } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Get in touch with the RailKit team for API support, enterprise onboarding, billing questions, or technical help with the Indian Railways SDK.",
  path: "/contact",
  keywords: [
    "irctc connect contact",
    "irctc api support",
    "indian railways api support",
    "irctc developer support",
    "irctc enterprise onboarding",
    "irctc api help",
    "contact irctc connect team",
    "irctc sdk technical support",
  ],
});

const contactCards = [
	{
		icon: Mail,
		title: "Email",
		description:
			"Best for detailed requests, billing questions, and anything that needs a written trail.",
		primaryLabel: "Email Me",
		primaryHref:
			"mailto:lucky81205+railkit@gmail.com?subject=IRCTC%20Connect%20Contact",
		secondaryLabel: "Open Pricing",
		secondaryHref: "/pricing",
	},
	{
		icon: MessageCircle,
		title: "Signal",
		description:
			"A quick option for direct support and shorter back-and-forth.",
		primaryLabel: "Open Signal",
		primaryHref:
			"https://signal.me/#eu/F8kHmQ5nKhO1ifpDuDcFXpAMg05zBLyi5GXx6MdLmNH9U1plPehLiKIkFp4aVHtw",
		secondaryLabel: "Read Docs",
		secondaryHref: "/docs",
	},
	{
		icon: Send,
		title: "Telegram",
		description:
			"Use Telegram if that is the easiest place for you to reach out.",
		primaryLabel: "Open Telegram",
		primaryHref:
			"https://t.me/rajiv81205",
		secondaryLabel: "GitHub",
		secondaryHref: "https://github.com/RAJIV81205/railkit",
	},
] as const;

const communityLinks = [
	{
		icon: Github,
		label: "GitHub",
		sub: "Code, issues, releases",
		href: "https://github.com/RAJIV81205/railkit",
	},
	{
		icon: BookOpen,
		label: "Developer Docs",
		sub: "Guides and endpoint details",
		href: "/docs",
	},
	{
		icon: Activity,
		label: "Roadmap Feedback",
		sub: "Request features and improvements",
		href: "https://github.com/RAJIV81205/railkit/issues",
	},
	{
		icon: Mail,
		label: "Direct Updates",
		sub: "Announcements and support replies",
		href: "mailto:lucky81205+railkit@gmail.com?subject=IRCTC%20Connect%20Updates",
	},
] as const;

const faqs = [
	{
		q: "Is this the official IRCTC API?",
		a: "No. This is an independent developer-focused API and SDK built on publicly available railway data sources, packaged into a cleaner integration layer.",
	},
	{
		q: "Where does the data come from?",
		a: "The data is collected from free public web resources already available online, then normalized, combined, and structured into a consistent API response.",
	},
	{
		q: "Do you provide onboarding help for production teams?",
		a: "Yes. We can help with key rotation flow, limit strategy, and rollout checklists for server-side integrations.",
	},
	{
		q: "Where should I report urgent API issues?",
		a: "Use the Technical Support card on this page and include your request ID, endpoint, and timestamp so we can triage quickly.",
	},
	{
		q: "Can I request higher usage limits?",
		a: "Yes. Share your expected daily request volume, burst profile, and use case. We will recommend a suitable plan.",
	},
	{
		q: "How do security reports get handled?",
		a: "Security mails are prioritized, acknowledged quickly, and handled with confidential triage and coordinated disclosure.",
	},
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Contact", item: absoluteUrl("/contact") },
  ],
};

export default function ContactPage() {
	return (
		<main className="cp-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
			<section className="cp-hero cp-section">
				<span aria-hidden="true" className="pointer-events-none absolute -top-48 right-[-170px] size-[560px] animate-[pricing-drift_16s_ease-in-out_infinite_alternate] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.06),transparent_68%)] motion-reduce:animate-none" />
				<span aria-hidden="true" className="pointer-events-none absolute -bottom-64 left-[-220px] size-[520px] animate-[pricing-drift_20s_ease-in-out_infinite_alternate_reverse] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.05),transparent_72%)] motion-reduce:animate-none" />
				<div className="cp-inner">
					<p className="cp-eyebrow">Contact</p>
					<h1 className="cp-h1 animate-pricing-rise opacity-0 motion-reduce:animate-none motion-reduce:opacity-100">
						Let&apos;s keep your railway
						<br />
						stack <em>moving.</em>
					</h1>
					<p className="cp-hero-body animate-pricing-rise opacity-0 [animation-delay:120ms] motion-reduce:animate-none motion-reduce:opacity-100">
						Choose the path that fits your need, from technical help to
						enterprise onboarding. No long form. Just direct channels.
					</p>
					<div className="cp-hero-cta animate-pricing-rise opacity-0 [animation-delay:220ms] motion-reduce:animate-none motion-reduce:opacity-100">
						<Link href="mailto:lucky81205+railkit@gmail.com" className="cp-btn-primary">
							Email the Team
							<ArrowRight size={15} />
						</Link>
						<Link
							href="https://signal.me/#eu/F8kHmQ5nKhO1ifpDuDcFXpAMg05zBLyi5GXx6MdLmNH9U1plPehLiKIkFp4aVHtw"
							className="cp-btn-ghost"
							target="_blank"
							rel="noopener noreferrer"
						>
							Signal
						</Link>
						<Link href="/docs" className="cp-btn-ghost">
							Integration Docs
						</Link>
					</div>
				</div>
			</section>

			<section className="cp-section">
				<div className="cp-inner">
					<div className="cp-head animate-pricing-rise opacity-0 [animation-delay:100ms] motion-reduce:animate-none motion-reduce:opacity-100">
						<p className="cp-eyebrow">Channels</p>
						<h2 className="cp-h2">Three ways to reach us</h2>
					</div>

					<div className="cp-cards-grid">
								{contactCards.map((card, i) => (
							<article key={card.title} className="cp-card animate-pricing-rise opacity-0 motion-reduce:animate-none motion-reduce:opacity-100" style={{ animationDelay: `${180 + i * 90}ms` }}>
								<div className="cp-card-icon" aria-hidden>
									<card.icon size={18} />
								</div>
								<h3 className="cp-card-title">{card.title}</h3>
								<p className="cp-card-desc">{card.description}</p>
								<div className="cp-card-actions">
									<Link
										href={card.primaryHref}
										className="cp-card-btn-primary"
										target={card.primaryHref.startsWith("http") ? "_blank" : undefined}
										rel={card.primaryHref.startsWith("http") ? "noopener noreferrer" : undefined}
									>
										{card.primaryLabel}
									</Link>
									<Link
										href={card.secondaryHref}
										className="cp-card-btn-ghost"
										target={card.secondaryHref.startsWith("http") ? "_blank" : undefined}
										rel={card.secondaryHref.startsWith("http") ? "noopener noreferrer" : undefined}
									>
										{card.secondaryLabel}
									</Link>
								</div>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="cp-section cp-section-tinted">
				<div className="cp-inner">
					<div className="cp-head animate-pricing-rise opacity-0 [animation-delay:100ms] motion-reduce:animate-none motion-reduce:opacity-100">
						<p className="cp-eyebrow">Community</p>
						<h2 className="cp-h2">Build with the public ecosystem</h2>
					</div>

					<div className="cp-community-grid">
						{communityLinks.map((item) => (
							<Link
								key={item.label}
								href={item.href}
								className="cp-community-item group animate-pricing-rise opacity-0 transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:animate-none motion-reduce:opacity-100"
								style={{ animationDelay: `${180 + communityLinks.indexOf(item) * 75}ms` }}
								target={item.href.startsWith("http") ? "_blank" : undefined}
								rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
							>
								<span className="cp-community-icon" aria-hidden>
									<item.icon size={16} />
								</span>
								<span className="cp-community-copy">
									<span className="cp-community-label">{item.label}</span>
									<span className="cp-community-sub">{item.sub}</span>
								</span>
								<ArrowRight size={14} className="cp-community-arrow transition-transform duration-200 group-hover:translate-x-1 group-hover:text-black motion-reduce:transition-none" aria-hidden />
							</Link>
						))}
					</div>
				</div>
			</section>

			<section className="cp-section">
				<div className="cp-inner">
					<div className="cp-reliability">
						<div className="cp-reliability-copy animate-pricing-rise opacity-0 [animation-delay:100ms] motion-reduce:animate-none motion-reduce:opacity-100">
							<p className="cp-eyebrow">Status & Reliability</p>
							<h2 className="cp-h2">Built for stable production traffic</h2>
							<p className="cp-body">
								RailKit is monitored continuously with usage-aware limits,
								fallback handling, and request-level observability to keep
								critical journeys resilient.
							</p>
							<a
								href="mailto:lucky81205+railkit@gmail.com?subject=IRCTC%20Connect%20Reliability%20Questions"
								className="cp-inline-link"
							>
								Ask about reliability practices
								<ArrowRight size={14} />
							</a>
						</div>

						<div className="cp-metrics-card animate-pricing-rise opacity-0 [animation-delay:220ms] motion-reduce:animate-none motion-reduce:opacity-100">
							<div className="cp-metric-row animate-pricing-rise [animation-delay:360ms] motion-reduce:animate-none">
								<span className="cp-metric-label">Observed Uptime</span>
								<span className="cp-metric-value">99.9%</span>
							</div>
							<div className="cp-metric-row animate-pricing-rise [animation-delay:430ms] motion-reduce:animate-none">
								<span className="cp-metric-label">Monitoring</span>
								<span className="cp-metric-value">24x7</span>
							</div>
							<div className="cp-metric-row animate-pricing-rise [animation-delay:500ms] motion-reduce:animate-none">
								<span className="cp-metric-label">SDK Version</span>
								<span className="cp-metric-value">v3.0.4</span>
							</div>
							<div className="cp-metric-row animate-pricing-rise [animation-delay:570ms] motion-reduce:animate-none">
								<span className="cp-metric-label">Incident Updates</span>
								<span className="cp-metric-value">Email First</span>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="cp-section cp-section-faq">
				<div className="cp-inner">
					<div className="cp-head animate-pricing-rise opacity-0 [animation-delay:100ms] motion-reduce:animate-none motion-reduce:opacity-100">
						<p className="cp-eyebrow">FAQ</p>
						<h2 className="cp-h2">Quick answers before you reach out</h2>
					</div>

					<div className="cp-faq-list">
						{faqs.map((item) => (
							<details key={item.q} className="cp-faq-item animate-pricing-rise opacity-0 transition-[border-color,box-shadow] duration-200 open:border-[#d1d5db] open:shadow-[0_10px_26px_rgba(0,0,0,0.04)] motion-reduce:animate-none motion-reduce:opacity-100" style={{ animationDelay: `${180 + faqs.indexOf(item) * 70}ms` }}>
								<summary>{item.q}</summary>
								<p>{item.a}</p>
							</details>
						))}
					</div>
				</div>
			</section>

			<footer className="cp-footer animate-pricing-rise opacity-0 [animation-delay:700ms] motion-reduce:animate-none motion-reduce:opacity-100">
				<div className="cp-inner cp-footer-inner">
					<p>
						RailKit · API for PNR status, train tracking, availability,
						and station intelligence.
					</p>
					<div className="cp-footer-links">
						<Link href="/">Home</Link>
						<Link href="/pricing">Pricing</Link>
						<Link href="/docs">Docs</Link>
						<a
							href="https://github.com/RAJIV81205/railkit"
							target="_blank"
							rel="noopener noreferrer"
						>
							GitHub
						</a>
					</div>
				</div>
			</footer>

			<style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&display=swap');

				.cp-root {
					background: #ffffff;
					min-height: 100vh;
					color: #000;
				}

				.cp-section {
					padding: 86px 40px;
				}

				.cp-section-tinted {
					background: #fafafa;
					border-top: 1px solid #f3f4f6;
					border-bottom: 1px solid #f3f4f6;
				}

				.cp-section-faq {
					padding-top: 76px;
					padding-bottom: 96px;
				}

				.cp-inner {
					max-width: 1160px;
					margin: 0 auto;
					min-width: 0;
				}

				.cp-hero {
					padding-top: 140px;
					position: relative;
					overflow: hidden;
				}

				.cp-hero::before {
					content: "";
					position: absolute;
					width: 560px;
					height: 560px;
					border-radius: 50%;
					top: -250px;
					right: -170px;
					background: radial-gradient(circle, rgba(0, 0, 0, 0.06), transparent 68%);
					pointer-events: none;
				}

				.cp-hero::after {
					content: "";
					position: absolute;
					left: -220px;
					bottom: -260px;
					width: 520px;
					height: 520px;
					border-radius: 50%;
					background: radial-gradient(circle, rgba(0, 0, 0, 0.05), transparent 72%);
					pointer-events: none;
				}

				.cp-head {
					margin-bottom: 34px;
				}
				.cp-eyebrow {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 11px;
					font-weight: 600;
					letter-spacing: 0.11em;
					text-transform: uppercase;
					color: #9ca3af;
					margin-bottom: 10px;
				}

				.cp-h1 {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: clamp(38px, 6.5vw, 84px);
					line-height: 0.98;
					letter-spacing: -0.025em;
					font-weight: 400;
					margin: 0;
					position: relative;
					z-index: 2;
				}

				.cp-h1 em {
					color: #6f6f6f;
					font-style: italic;
				}

				.cp-h2 {
					font-family: 'Instrument Serif', Georgia, serif;
					font-size: clamp(28px, 3.8vw, 52px);
					line-height: 1.05;
					letter-spacing: -0.02em;
					font-weight: 400;
					margin: 0;
					color: #000;
				}

				.cp-hero-body,
				.cp-body {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 15px;
					font-weight: 300;
					line-height: 1.75;
					color: #6f6f6f;
					max-width: 560px;
				}

				.cp-hero-body {
					margin: 20px 0 0;
				}

				.cp-hero-cta {
					margin-top: 30px;
					display: flex;
					gap: 10px;
					flex-wrap: wrap;
				}

				.cp-btn-primary,
				.cp-btn-ghost {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					gap: 8px;
					border-radius: 999px;
					text-decoration: none;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 14px;
					transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
					white-space: nowrap;
				}

				.cp-btn-primary {
					background: #000;
					color: #fff;
					padding: 13px 28px;
					border: 1px solid #000;
				}

				.cp-btn-primary:hover {
					background: #111;
					transform: translateY(-1px);
				}

				.cp-btn-ghost {
					background: #fff;
					color: #000;
					padding: 13px 24px;
					border: 1px solid #e5e7eb;
				}

				.cp-btn-ghost:hover {
					background: #fafafa;
					transform: translateY(-1px);
				}

				.cp-cards-grid {
					display: grid;
					grid-template-columns: repeat(3, minmax(0, 1fr));
					gap: 14px;
				}

				.cp-card {
					background: linear-gradient(160deg, #ffffff 0%, #fcfcfc 100%);
					border: 1px solid #eceff1;
					border-radius: 18px;
					padding: 24px;
					min-width: 0;
					display: flex;
					flex-direction: column;
					transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
				}

				.cp-card:hover {
					transform: translateY(-2px);
					border-color: #dfe4e8;
					box-shadow: 0 16px 36px rgba(0, 0, 0, 0.06);
				}

				.cp-card-icon {
					width: 38px;
					height: 38px;
					border-radius: 10px;
					display: flex;
					align-items: center;
					justify-content: center;
					color: #1f2937;
					background: #f3f4f6;
					margin-bottom: 14px;
					flex-shrink: 0;
				}

				.cp-card-title {
					margin: 0;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 16px;
					font-weight: 600;
					letter-spacing: -0.01em;
					color: #000;
				}

				.cp-card-desc {
					margin: 10px 0 0;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 13.5px;
					line-height: 1.7;
					font-weight: 300;
					color: #6f6f6f;
				}

				.cp-card-actions {
					margin-top: 18px;
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
				}

				.cp-card-btn-primary,
				.cp-card-btn-ghost {
					border-radius: 10px;
					padding: 10px 12px;
					text-decoration: none;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 12.5px;
					font-weight: 500;
					transition: background 0.15s ease, color 0.15s ease;
				}

				.cp-card-btn-primary {
					background: #000;
					color: #fff;
					border: 1px solid #000;
				}

				.cp-card-btn-primary:hover {
					background: #151515;
				}

				.cp-card-btn-ghost {
					color: #4b5563;
					background: #fff;
					border: 1px solid #e5e7eb;
				}

				.cp-card-btn-ghost:hover {
					color: #111827;
					background: #f9fafb;
				}

				.cp-community-grid {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 10px;
				}

				.cp-community-item {
					display: flex;
					align-items: center;
					gap: 12px;
					border-radius: 14px;
					border: 1px solid #e5e7eb;
					background: #fff;
					padding: 14px 15px;
					text-decoration: none;
					transition: border-color 0.15s ease, transform 0.15s ease;
					min-width: 0;
				}

				.cp-community-item:hover {
					border-color: #d1d5db;
					transform: translateY(-1px);
				}

				.cp-community-icon {
					width: 34px;
					height: 34px;
					border-radius: 9px;
					background: #f4f4f5;
					color: #374151;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					flex-shrink: 0;
				}

				.cp-community-copy {
					display: flex;
					flex-direction: column;
					min-width: 0;
					flex: 1;
				}

				.cp-community-label {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 13.5px;
					font-weight: 600;
					color: #000;
				}

				.cp-community-sub {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 12px;
					font-weight: 300;
					color: #6f6f6f;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.cp-community-arrow {
					color: #9ca3af;
					flex-shrink: 0;
				}

				.cp-reliability {
					display: grid;
					grid-template-columns: 1.1fr 0.9fr;
					gap: 16px;
					align-items: stretch;
				}

				.cp-inline-link {
					margin-top: 18px;
					display: inline-flex;
					align-items: center;
					gap: 8px;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 13.5px;
					font-weight: 500;
					color: #000;
					text-decoration: none;
				}

				.cp-inline-link:hover {
					color: #374151;
				}

				.cp-metrics-card {
					background: #0f1115;
					border: 1px solid #1f2937;
					border-radius: 18px;
					padding: 20px;
					display: grid;
					gap: 10px;
					align-content: center;
				}

				.cp-metric-row {
					display: flex;
					align-items: center;
					justify-content: space-between;
					border: 1px solid #22252b;
					background: #14171d;
					border-radius: 10px;
					padding: 10px 12px;
					gap: 8px;
				}

				.cp-metric-label {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 12.5px;
					color: #9ca3af;
				}

				.cp-metric-value {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 12.5px;
					font-weight: 600;
					color: #f9fafb;
				}

				.cp-faq-list {
					display: grid;
					gap: 10px;
				}

				.cp-faq-item {
					border: 1px solid #e5e7eb;
					border-radius: 14px;
					background: #fff;
					padding: 14px 16px;
					transition: border-color 0.15s ease;
				}

				.cp-faq-item:hover {
					border-color: #d1d5db;
				}

				.cp-faq-item summary {
					list-style: none;
					cursor: pointer;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 14px;
					font-weight: 500;
					color: #000;
				}

				.cp-faq-item summary::-webkit-details-marker {
					display: none;
				}

				.cp-faq-item p {
					margin: 10px 0 2px;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 13px;
					line-height: 1.7;
					font-weight: 300;
					color: #6f6f6f;
					max-width: 820px;
				}

				.cp-footer {
					border-top: 1px solid #f3f4f6;
					padding: 24px 40px 34px;
				}

				.cp-footer-inner {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
					flex-wrap: wrap;
				}

				.cp-footer p {
					margin: 0;
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 12.5px;
					color: #9ca3af;
				}

				.cp-footer-links {
					display: flex;
					align-items: center;
					gap: 12px;
					flex-wrap: wrap;
				}

				.cp-footer-links a {
					font-family: 'Inter', system-ui, sans-serif;
					font-size: 12.5px;
					color: #6f6f6f;
					text-decoration: none;
					transition: color 0.15s ease;
				}

				.cp-footer-links a:hover {
					color: #000;
				}


				@media (max-width: 980px) {
					.cp-cards-grid {
						grid-template-columns: 1fr;
					}

					.cp-reliability {
						grid-template-columns: 1fr;
					}
				}

				@media (max-width: 760px) {
					.cp-section {
						padding: 64px 24px;
					}

					.cp-hero {
						padding-top: 126px;
					}

					.cp-community-grid {
						grid-template-columns: 1fr;
					}

					.cp-footer {
						padding: 22px 24px 30px;
					}
				}

				@media (max-width: 480px) {
					.cp-section {
						padding: 52px 20px;
					}

					.cp-hero {
						padding-top: 118px;
					}

					.cp-h1 {
						font-size: clamp(34px, 12vw, 52px);
					}

					.cp-card,
					.cp-metrics-card {
						padding: 18px;
					}
				}
			`}</style>
		</main>
	);
}
