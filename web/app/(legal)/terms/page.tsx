import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { buildMetadata, absoluteUrl, SITE_NAME } from "../../../lib/seo";
import { TERMS_AND_CONDITIONS } from "../../../lib/constants";

export const metadata: Metadata = buildMetadata({
  title: "Terms and Conditions",
  description:
    "Read the RailKit terms of service. Understand the rules, acceptable use, payment terms, and obligations that govern your use of the Indian Railways API, dashboard, and Node.js SDK.",
  path: "/terms",
  type: "article",
  publishedTime: TERMS_AND_CONDITIONS.lastUpdated + "T00:00:00.000Z",
  modifiedTime: TERMS_AND_CONDITIONS.lastUpdated + "T00:00:00.000Z",
  keywords: [
    "railkit terms",
    "irctc api terms of service",
    "irctc terms and conditions",
    "irctc sdk terms",
    "indian railways api acceptable use",
    "irctc api license",
    "irctc rate limits",
    "irctc service agreement",
    "irctc refund policy",
    "irctc api acceptable use policy",
    "irctc data usage terms",
    "irctc api key sharing policy",
    "indian railways api license",
    "irctc subscription terms",
    "irctc developer agreement",
  ],
});

const data = TERMS_AND_CONDITIONS;
const formattedDate = new Date(data.lastUpdated).toLocaleDateString("en-IN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Terms and Conditions", item: absoluteUrl("/terms") },
  ],
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `${SITE_NAME} Terms and Conditions`,
  url: absoluteUrl("/terms"),
  inLanguage: "en-IN",
  datePublished: data.lastUpdated + "T00:00:00.000Z",
  dateModified: data.lastUpdated + "T00:00:00.000Z",
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  },
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black font-[Inter,system-ui,sans-serif]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        />

        {/* Hero */}
        <section className="relative overflow-hidden px-6 pt-[140px] pb-20 sm:px-10 sm:pt-[150px] sm:pb-24">
          <div className="pointer-events-none absolute -top-60 -right-44 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.06),transparent_68%)]" />
          <div className="pointer-events-none absolute -bottom-64 -left-56 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.05),transparent_72%)]" />

          <div className="relative mx-auto max-w-[1160px]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-neutral-400">
              Legal
            </p>
            <h1 className="font-['Instrument_Serif',Georgia,serif] text-[clamp(38px,6.5vw,84px)] leading-[0.98] tracking-[-0.025em] font-normal">
              Terms <em className="not-italic text-neutral-500">&amp; Conditions.</em>
            </h1>
            <p className="mt-5 max-w-[560px] text-[15px] font-light leading-[1.75] text-neutral-500">
              The agreement that governs your use of {SITE_NAME}. Last updated{" "}
              {formattedDate}.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link
                href="/privacy"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-normal text-black transition hover:-translate-y-px hover:bg-neutral-50"
              >
                Read Privacy Policy
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm font-normal text-black transition hover:-translate-y-px hover:bg-neutral-50"
              >
                Contact
              </Link>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="border-y border-neutral-100 bg-neutral-50 px-6 py-20 sm:px-10 sm:py-24">
          <div className="mx-auto max-w-[1160px]">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-[240px_minmax(0,1fr)] md:gap-12">
              {/* TOC */}
              <aside className="md:sticky md:top-[90px] md:self-start">
                <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-neutral-400">
                  On this page
                </p>
                <ul className="flex flex-col gap-2 border-l border-neutral-200">
                  {data.sections.map((section, index) => (
                    <li key={section.heading} className="pl-3.5">
                      <a
                        href={`#section-${index + 1}`}
                        className="block text-[13px] font-normal leading-[1.5] text-neutral-500 transition-colors hover:text-black"
                      >
                        {section.heading}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>

              {/* Sections */}
              <div className="flex min-w-0 flex-col gap-10">
                {data.sections.map((section, index) => {
                  const id = `section-${index + 1}`;
                  return (
                    <article key={section.heading} id={id} className="scroll-mt-[100px]">
                      <h2 className="mb-3.5 flex items-baseline gap-3 font-['Instrument_Serif',Georgia,serif] text-[clamp(24px,3vw,36px)] font-normal leading-[1.1] tracking-[-0.02em] text-black">
                        <span data-nosnippet className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {section.heading}
                      </h2>
                      <div className="max-w-[760px] text-[14.5px] font-light leading-[1.8] text-neutral-600">
                        {section.content && <p className="mb-3.5 last:mb-0">{section.content}</p>}
                        {section.items && (
                          <ul className="flex flex-col gap-2 pl-5">
                            {section.items.map((item, i) => (
                              <li key={i} className="relative pl-1 leading-[1.7]">
                                <span className="absolute -left-5 top-[0.7em] h-1 w-1 rounded-full bg-neutral-400" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  );
                })}

                {/* Contact block */}
                <article className="mt-2 border-t border-neutral-200 pt-7">
                  <h2 className="mb-3.5 flex items-baseline gap-3 font-['Instrument_Serif',Georgia,serif] text-[clamp(24px,3vw,36px)] font-normal leading-[1.1] tracking-[-0.02em] text-black">
                    <span className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400">
                      {String(data.sections.length + 1).padStart(2, "0")}
                    </span>
                    Questions about these Terms?
                  </h2>
                  <div className="max-w-[760px] text-[14.5px] font-light leading-[1.8] text-neutral-600">
                    <p className="mb-3.5 last:mb-0">Reach out and we will get back to you.</p>
                    <p>
                      <a
                        href="mailto:lucky81205+railkit@gmail.com?subject=RailKit%20Terms"
                        className="inline-flex items-center gap-2 border-b border-neutral-300 pb-0.5 text-sm font-medium text-black transition-colors hover:border-black"
                      >
                        <Mail size={14} />
                        lucky81205+railkit@gmail.com
                      </a>
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-7 sm:px-10">
          <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 text-[12.5px] text-neutral-400">
            <p>
              {SITE_NAME} · Terms and Conditions · {formattedDate}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/" className="text-neutral-500 transition-colors hover:text-black">
                Home
              </Link>
              <Link href="/privacy" className="text-neutral-500 transition-colors hover:text-black">
                Privacy
              </Link>
              <Link href="/docs" className="text-neutral-500 transition-colors hover:text-black">
                Docs
              </Link>
              <Link href="/contact" className="text-neutral-500 transition-colors hover:text-black">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </main>
  );
}
