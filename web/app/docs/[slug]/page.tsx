import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DocsPage from "../../../components/docs/DocsPage";
import { sections } from "../../../components/docs/docsData";
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

  return buildMetadata({
    title: section.label,
    description: `${section.label} documentation for RailKit Indian Railways API and Node.js SDK.`,
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
