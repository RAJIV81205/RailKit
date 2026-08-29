export const SITE_NAME = "RailKit";
export const SITE_TITLE =
  "RailKit - Indian Railways API & Node.js SDK for PNR Status, Live Train Tracking & Seat Availability";
export const SITE_DESCRIPTION =
  "RailKit is an independent, developer-first Indian Railways data API and Node.js SDK for PNR status, live train tracking, trains between stations, seat availability, fares, and station boards.";

// Keep metadata focused. Search engines primarily understand the page content,
// title, description, links and structured data rather than large keyword lists.
export const SITE_KEYWORDS = [
  "railkit",
  "indian railways api",
  "railway api",
  "indian railways sdk",
  "pnr status api",
  "live train tracking api",
  "train running status api",
  "train between stations api",
  "seat availability api",
  "train fare api",
  "station board api",
  "node.js railway api",
  "typescript railway sdk",
];

export const SOCIAL_IMAGE_PATH = "/icon.png";
export const OG_LOCALE = "en_IN";
export const TWITTER_CARD = "summary_large_image";
export const TWITTER_HANDLE = "@rajiv81205";
export const TWITTER_SITE = "@rajiv81205";
// Current social image dimensions. Replace with a dedicated 1200×630 image when available.
export const OG_IMAGE_WIDTH = 512;
export const OG_IMAGE_HEIGHT = 512;

export function getSiteUrl(): string {
  const raw = "https://railkit.in";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export type BuildMetadataOptions = {
  title?: string;
  description?: string;
  keywords?: string[];
  path?: string;
  imagePath?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  keywords,
  path = "/",
  imagePath = SOCIAL_IMAGE_PATH,
  type = "website",
  publishedTime,
  modifiedTime,
}: BuildMetadataOptions = {}) {
  const resolvedTitle = title ? `${title} | ${SITE_NAME}` : SITE_TITLE;
  const resolvedKeywords = keywords?.length ? keywords : SITE_KEYWORDS;
  const imageUrl = absoluteUrl(imagePath);
  const isArticle = type === "article";

  return {
    title: resolvedTitle,
    description,
    keywords: resolvedKeywords,
    alternates: {
      canonical: absoluteUrl(path),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large" as const,
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: resolvedTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: OG_LOCALE,
      type: isArticle ? ("article" as const) : ("website" as const),
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
      images: [
        {
          url: imageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: TWITTER_CARD,
      title: resolvedTitle,
      description,
      site: TWITTER_SITE,
      creator: TWITTER_HANDLE,
      images: [imageUrl],
    },
  };
}
