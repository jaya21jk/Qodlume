import Link from "next/link";
import { QuizSectionNavigation } from "../../components/quiz-section-navigation";
import { getCurrentDateInTimezone } from "../../lib/config";
import { getDatabase, getQuizByDate } from "../../lib/quiz-database";

export const dynamic = "force-dynamic";

export default async function TodayQuizPage() {
  const today = getCurrentDateInTimezone();
  const quiz = await getQuizByDate(await getDatabase(), today);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 72px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 700 }}>
          ← Back to home
        </Link>
      </div>
      <QuizSectionNavigation activePage="today" />
      <header
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid rgba(148,163,184,0.3)",
          borderRadius: 30,
          padding: "28px 26px",
          boxShadow: "0 22px 52px rgba(15, 23, 42, 0.06)",
          marginBottom: 26,
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#2563eb", fontSize: 12 }}>
          Fresh for curious minds
        </p>
        <h1 style={{ margin: "12px 0 10px", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.08 }}>
          Today&apos;s quiz
        </h1>
        <p style={{ margin: 0, color: "#475569", fontSize: 18, lineHeight: 1.7 }}>
          Take today&apos;s challenge, then browse previous quizzes whenever you like.
        </p>
      </header>

      {quiz ? (
        <article
          style={{
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(148,163,184,0.32)",
            borderRadius: 22,
            padding: 24,
            boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)",
          }}
        >
          <span style={{ color: "#475569", fontSize: 14, fontWeight: 700 }}>{quiz.publicationDate}</span>
          <h2 style={{ margin: "10px 0", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>{quiz.title}</h2>
          <p style={{ margin: "0 0 20px", color: "#475569", lineHeight: 1.7 }}>{quiz.description}</p>
          <Link
            href={`/quiz/${quiz.publicationDate}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "12px 18px",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Start today&apos;s quiz <span aria-hidden="true">→</span>
          </Link>
        </article>
      ) : (
        <section style={{ textAlign: "center", padding: "36px 20px", background: "rgba(255,255,255,0.75)", borderRadius: 22 }}>
          <h2 style={{ marginTop: 0 }}>No quiz is available today</h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>Browse previous challenges or check back later for today&apos;s quiz.</p>
          <Link href="/quizzes/previous" style={{ color: "#2563eb", fontWeight: 700 }}>
            Browse previous quizzes
          </Link>
        </section>
      )}
    </main>
  );
}
