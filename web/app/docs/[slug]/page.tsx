import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocsPage from "../../../components/docs/DocsPage";
import { sections } from "../../../components/docs/docsData";
import { endpointDocs } from "../../../components/docs/endpointDocs";
import { absoluteUrl, buildMetadata } from "../../../lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return sections.map(({ id }) => ({ slug: id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const section = sections.find(({ id }) => id === slug);
  if (!section) return {};

  const endpoint = endpointDocs.find(({ id }) => id === slug);
  const conciseDescriptions: Record<string, string> = {
    "live-tracking-v2": "Track trains with RailKit's V2 WIMT API. See live location, route, delays, coach positions, request parameters, and response examples.",
    "train-history": "Retrieve a completed train journey with station timelines, delays, and coach positions. RailKit REST and Node.js SDK examples.",
  };
  const description = endpoint
    ? conciseDescriptions[slug] ?? `${endpoint.description} Node.js and REST examples.`
    : `Learn ${section.label.toLowerCase()} for the RailKit Indian Railways API and Node.js SDK, with setup steps and examples.`;

  return buildMetadata({
    title: section.label,
    description,
    path: `/docs/${slug}`,
  });
}

export default async function DocsSectionPage({ params }: PageProps) {
  const { slug } = await params;
  const section = sections.find(({ id }) => id === slug);
  if (!section) notFound();

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Documentation", item: absoluteUrl("/docs") },
      { "@type": "ListItem", position: 3, name: section.label, item: absoluteUrl(`/docs/${slug}`) },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <DocsPage activeSlug={slug} />
    </>
  );
}
