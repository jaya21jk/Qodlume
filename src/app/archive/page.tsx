import Link from "next/link";
import { getPublishedQuizArchive } from "../../lib/quiz-content";

export default function ArchivePage() {
  const quizzes = getPublishedQuizArchive();

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 24px 72px",
      }}
    >
      <div style={{ marginBottom: 26 }}>
        <Link
          href="/"
          style={{
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Back to home
        </Link>
      </div>

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
        <p
          style={{
            margin: 0,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#2563eb",
            fontSize: 12,
          }}
        >
          Archive
        </p>

        <h1
          style={{
            margin: "12px 0 10px",
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.08,
          }}
        >
          Published challenge library
        </h1>

        <p
          style={{ margin: 0, color: "#475569", fontSize: 18, lineHeight: 1.7 }}
        >
          Explore previous daily challenge drops and revisit the ideas that
          sharpened your engineering judgment.
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
            `${quizzes.length} total quizzes`,
            "Regular releases",
            "Engineering-focused topics",
          ].map((item) => (
            <span
              key={item}
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#eef2ff",
                color: "#312e81",
                borderRadius: 999,
                padding: "8px 12px",
                fontWeight: 700,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </header>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 16,
        }}
      >
        {quizzes.map((quiz) => (
          <li
            key={quiz.id}
            style={{
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(148,163,184,0.32)",
              borderRadius: 22,
              padding: 22,
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.04)",
            }}
          >
            <Link
              href={`/quiz/${quiz.publicationDate}`}
              style={{ textDecoration: "none", color: "#0f172a" }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>
                {quiz.title}
              </h2>
            </Link>
            <p
              style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.6 }}
            >
              {quiz.description}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                color: "#475569",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {[
                quiz.publicationDate,
                quiz.topic,
                quiz.difficulty,
                `${quiz.questions.length} questions`,
              ].map((meta) => (
                <span
                  key={meta}
                  style={{
                    background: "#f8fafc",
                    borderRadius: 999,
                    padding: "6px 10px",
                    border: "1px solid rgba(148,163,184,0.2)",
                  }}
                >
                  {meta}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
