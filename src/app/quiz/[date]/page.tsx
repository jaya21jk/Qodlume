import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizPlayer } from "../../../components/quiz-player";
import { quizRepository } from "../../../lib/quiz-content";

export function generateStaticParams() {
  return quizRepository
    .listPublishedQuizzes()
    .map((quiz) => ({ date: quiz.publicationDate }));
}

export default async function QuizDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const quiz = quizRepository.getQuizByPublicationDate(date);

  if (!quiz) {
    notFound();
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 24px 72px",
      }}
    >
      <Link
        href="/"
        style={{
          color: "#0f172a",
          textDecoration: "none",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 18,
        }}
      >
        ← Back to home
      </Link>

      <header
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(239,246,255,0.9))",
          border: "1px solid rgba(148,163,184,0.3)",
          borderRadius: 28,
          padding: "28px 26px",
          boxShadow: "0 24px 52px rgba(15, 23, 42, 0.08)",
          marginBottom: 26,
        }}
      >
        <p
          style={{
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#2563eb",
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          Daily challenge
        </p>

        <h1
          style={{
            margin: "12px 0 10px",
            fontSize: "clamp(2rem, 4vw, 3.2rem)",
            lineHeight: 1.08,
          }}
        >
          {quiz.title}
        </h1>

        <p
          style={{
            color: "#475569",
            fontSize: 18,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {quiz.description}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 18,
          }}
        >
          {[
            `Date: ${quiz.publicationDate}`,
            `Topic: ${quiz.topic}`,
            `Difficulty: ${quiz.difficulty}`,
            `${quiz.estimatedDurationMinutes} min`,
            `${quiz.questions.length} questions`,
          ].map((meta) => (
            <span
              key={meta}
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.9)",
                borderRadius: 999,
                padding: "8px 12px",
                border: "1px solid rgba(148,163,184,0.28)",
                color: "#334155",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {meta}
            </span>
          ))}
        </div>
      </header>

      <div style={{ marginTop: 8 }}>
        <QuizPlayer quiz={quiz} />
      </div>
    </main>
  );
}
