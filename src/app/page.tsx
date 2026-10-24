import { getCurrentDateInTimezone } from "../lib/config";
import {
  getDatabase,
  getQuizByDate,
  listPublishedQuizSummaries,
} from "../lib/quiz-database";
import { HomeShowcase } from "../components/home-showcase";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDatabase();
  const today = getCurrentDateInTimezone();
  const [quiz, archive] = await Promise.all([
    getQuizByDate(db, today),
    listPublishedQuizSummaries(db),
  ]);

  const topics = Array.from(new Set(archive.map((item) => item.topic)));
  const topicLabels: Record<string, string> = {
    javascript: "JavaScript",
    java: "Java",
    typescript: "TypeScript",
    react: "React",
    nextjs: "Next.js",
    "system-design": "System Design",
    "web-performance": "Web Performance",
  };

  return (
    <HomeShowcase
      quiz={
        quiz
          ? {
              title: quiz.title,
              description: quiz.description,
              publicationDate: quiz.publicationDate,
            }
          : null
      }
      topics={topics}
      topicLabels={topicLabels}
    />
  );
}
