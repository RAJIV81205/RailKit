import type { Metadata } from "next";
import { getPublicPlanConfig } from "../../lib/constants";
import { buildMetadata, absoluteUrl } from "../../lib/seo";
import PricingClient from "../../components/pricing/PricingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description:
    "Compare RailKit pricing plans for Indian Railways API access. Free, Pro and Enterprise tiers with monthly request limits, seat-availability quota, and priority support.",
  path: "/pricing",
  keywords: [
    "irctc api pricing",
    "irctc connect pricing",
    "indian railways api pricing",
    "railway api pricing",
    "irctc api free tier",
    "irctc api plans",
    "irctc api subscription",
    "irctc pro plan",
    "irctc enterprise plan",
    "indian railways api cost",
    "railway api for developers pricing",
    "irctc api rate limit pricing",
    "irctc api monthly cost",
  ],
});

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Pricing", item: absoluteUrl("/pricing") },
  ],
};

export default async function PricingPage() {
  const config = getPublicPlanConfig();

  const plans = JSON.parse(JSON.stringify(config?.plans || []));
  const offerEndsAt = config?.offerEndsAt ?? null;
  const contactEmail = config?.contactEmail || "lucky81205+railkit@gmail.com";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <PricingClient
        initialPlans={plans}
        initialOfferEndsAt={offerEndsAt}
        initialContactEmail={contactEmail}
      />
    </>
  );
}
