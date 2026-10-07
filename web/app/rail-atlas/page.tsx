import type { Metadata } from "next";
import { absoluteUrl, buildMetadata, SITE_NAME } from "../../lib/seo";
import { RailAtlas } from "../../components/rail-atlas/RailAtlas";

const pageTitle = "Rail Atlas: Indian Railway Map & Live Train Status";
const description = "Explore Indian railway stations and tracks on an interactive map. Search trains, check upcoming arrivals at a station, and view live train routes and running status.";

export const metadata: Metadata = {
  ...buildMetadata({
    title: pageTitle,
    description,
    path: "/rail-atlas",
    keywords: [
      "Indian railway map",
      "Indian railway stations map",
      "live train status map",
      "Indian train route map",
      "upcoming trains at station",
    ],
  }),
  title: { absolute: `${pageTitle} | ${SITE_NAME}` },
};

const atlasSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${absoluteUrl("/rail-atlas")}#app`,
  name: "Rail Atlas",
  url: absoluteUrl("/rail-atlas"),
  description,
  applicationCategory: "TravelApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  areaServed: "India",
  publisher: { "@id": `${absoluteUrl("/")}#organization` },
  featureList: ["Indian railway station map", "Railway tracks", "Upcoming trains at stations", "Live train routes and running status"],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Rail Atlas", item: absoluteUrl("/rail-atlas") },
  ],
};

export default function RailAtlasPage() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(atlasSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    <RailAtlas />
  </>;
}
