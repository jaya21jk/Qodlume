import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://qodlume.example.com/",
      lastModified: new Date("2026-10-20T00:00:00.000Z"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://qodlume.example.com/archive",
      lastModified: new Date("2026-10-20T00:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
