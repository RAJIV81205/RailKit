import type { Metadata } from "next";
import DocsPage from "../DocsPage";
import { buildMetadata, absoluteUrl } from "../../lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Documentation",
    description:
      "RailKit API documentation with endpoint references for PNR status, live tracking, cancelled trains, seat availability, and Node.js SDK integration.",
    path: "/docs",
    keywords: [
      "irctc api documentation",
      "irctc sdk docs",
      "indian railways api reference",
      "irctc api endpoints",
      "irctc api integration guide",
      "irctc rest api tutorial",
      "irctc nodejs sdk example",
      "irctc api authentication",
      "irctc api rate limit",
      "irctc api response format",
      "pnr status api example",
      "live train tracking api example",
      "seat availability api example",
      "cancelled trains api example",
      "irctc api getting started",
    ],
  }),
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Documentation", item: absoluteUrl("/docs") },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <DocsPage />
    </>
  );
}
