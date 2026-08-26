import type { MetadataRoute } from "next";
import { absoluteUrl } from "../lib/seo";
import {
  PRIVACY_POLICY,
  TERMS_AND_CONDITIONS,
} from "../lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const privacyUpdated = new Date(PRIVACY_POLICY.lastUpdated);
  const termsUpdated = new Date(TERMS_AND_CONDITIONS.lastUpdated);

  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/docs"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/pricing"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/contact"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: termsUpdated,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: privacyUpdated,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
