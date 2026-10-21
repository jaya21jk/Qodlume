import type { MetadataRoute } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSiteUrl } from "../lib/config";
import { getDatabase, listPublishedQuizSummaries } from "../lib/quiz-database";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [quizzes, { env }] = await Promise.all([
    listPublishedQuizSummaries(await getDatabase()),
    getCloudflareContext({ async: true }),
  ]);
  const siteUrl = getSiteUrl(env.SITE_URL);
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/archive`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...quizzes.map((quiz) => ({
      url: `${siteUrl}/quiz/${quiz.publicationDate}`,
      lastModified: quiz.updatedAt ? new Date(quiz.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
