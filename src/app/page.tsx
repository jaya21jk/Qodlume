import Link from "next/link";
import { getCurrentDateInTimezone } from "../lib/config";
import {
  getDatabase,
  getQuizByDate,
  listPublishedQuizSummaries,
} from "../lib/quiz-database";

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

  const statCards = [
    ["12k+", "active learners"],
    ["4.9/5", "average rating"],
    ["3 min", "daily challenge"],
  ];

  const featureCards = [
    {
      title: "Daily technical challenge",
      text: "Short, high-signal prompts that sharpen instincts across real-world engineering decisions.",
    },
    {
      title: "Skill-focused learning",
      text: "Move beyond trivia with JavaScript, TypeScript, React, system design, and debugging patterns.",
    },
    {
      title: "Built for professionals",
      text: "A polished habit that fits into busy schedules and compounds over time without friction.",
    },
  ];

  const steps = [
    "Pick today’s challenge",
    "Answer in under 3 minutes",
    "Review the explanation and improve",
  ];

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px 80px",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#475569",
            }}
          >
            Qodlume
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(2.4rem, 4vw, 4rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.05em",
            }}
          >
            Build sharper engineering instincts.
          </h1>
        </div>

        <nav style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link
            href="/archive"
            style={{
              color: "#0f172a",
              textDecoration: "none",
              fontWeight: 700,
              padding: "10px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(148,163,184,0.4)",
            }}
          >
            Archive
          </Link>
        </nav>
      </header>

      <section
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eef2ff 100%)",
          border: "1px solid rgba(148,163,184,0.35)",
          borderRadius: 32,
          boxShadow: "0 26px 60px rgba(15, 23, 42, 0.08)",
          padding: "32px 28px",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {topics.map((topic) => (
            <span
              key={topic}
              style={{
                background: "#eef2ff",
                color: "#3730a3",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {topicLabels[topic] ?? topic}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 0.7fr",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div>
            {quiz ? (
              <>
                <p
                  style={{
                    color: "#2563eb",
                    fontWeight: 800,
                    letterSpacing: 0.08,
                    textTransform: "uppercase",
                    margin: 0,
                    fontSize: 12,
                  }}
                >
                  Today&apos;s challenge
                </p>
                <h2
                  style={{
                    margin: "16px 0 10px",
                    fontSize: "clamp(2rem, 3vw, 3rem)",
                    lineHeight: 1.1,
                  }}
                >
                  {quiz.title}
                </h2>
                <p
                  style={{
                    margin: "0 0 18px",
                    color: "#475569",
                    fontSize: 18,
                    lineHeight: 1.7,
                  }}
                >
                  {quiz.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    color: "#334155",
                    fontWeight: 600,
                    marginBottom: 22,
                  }}
                >
                  <span
                    style={{
                      background: "#eff6ff",
                      borderRadius: 999,
                      padding: "6px 10px",
                    }}
                  >
                    {quiz.publicationDate}
                  </span>
                  <span
                    style={{
                      background: "#f8fafc",
                      borderRadius: 999,
                      padding: "6px 10px",
                    }}
                  >
                    {quiz.topic}
                  </span>
                  <span
                    style={{
                      background: "#f8fafc",
                      borderRadius: 999,
                      padding: "6px 10px",
                    }}
                  >
                    {quiz.difficulty}
                  </span>
                  <span
                    style={{
                      background: "#f8fafc",
                      borderRadius: 999,
                      padding: "6px 10px",
                    }}
                  >
                    {quiz.questions.length} questions
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link
                    href={`/quiz/${quiz.publicationDate}`}
                    style={{
                      display: "inline-block",
                      background: "linear-gradient(135deg, #0f172a, #1e293b)",
                      color: "#fff",
                      padding: "14px 22px",
                      borderRadius: 12,
                      textDecoration: "none",
                      fontWeight: 700,
                      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.22)",
                    }}
                  >
                    Start challenge →
                  </Link>
                  <Link
                    href="/archive"
                    style={{
                      display: "inline-block",
                      background: "#fff",
                      color: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.4)",
                      padding: "14px 22px",
                      borderRadius: 12,
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Browse archive
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: "10px 0 8px" }}>
                  No published quiz for today
                </h2>
                <p style={{ margin: 0, color: "#475569" }}>
                  Check the archive for previous daily challenges.
                </p>
              </>
            )}
          </div>

          <div
            style={{
              background: "rgba(15,23,42,0.96)",
              color: "#fff",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 18px 40px rgba(15,23,42,0.22)",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#cbd5e1",
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Developer growth, measured
            </p>

            <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
              {statCards.map(([value, label]) => (
                <div
                  key={label}
                  style={{
                    borderBottom: "1px solid rgba(148,163,184,0.22)",
                    paddingBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 30, fontWeight: 800 }}>{value}</div>
                  <div style={{ color: "#cbd5e1", fontSize: 14 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
          }}
        >
          {featureCards.map((feature) => (
            <div
              key={feature.title}
              style={{
                background: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(148,163,184,0.3)",
                borderRadius: 20,
                padding: 22,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>●</div>
              <h3 style={{ margin: "0 0 8px" }}>{feature.title}</h3>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "rgba(255,255,255,0.8)",
          border: "1px solid rgba(148,163,184,0.3)",
          borderRadius: 28,
          padding: "28px 24px",
          marginBottom: 32,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#475569",
          }}
        >
          How it works
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 18,
            marginTop: 20,
          }}
        >
          {steps.map((step, index) => (
            <div
              key={step}
              style={{
                background: "#f8fafc",
                borderRadius: 18,
                padding: 18,
                border: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  background: "#e0e7ff",
                  color: "#312e81",
                  marginBottom: 12,
                }}
              >
                {index + 1}
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17 }}>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.5rem" }}>
            Recent challenge archive
          </h3>
          <Link
            href="/archive"
            style={{
              color: "#1d4ed8",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            View all →
          </Link>
        </div>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 12,
          }}
        >
          {archive.slice(0, 5).map((entry) => (
            <li
              key={entry.id}
              style={{
                background: "rgba(255,255,255,0.78)",
                border: "1px solid rgba(148,163,184,0.3)",
                borderRadius: 18,
                padding: 18,
                boxShadow: "0 10px 22px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Link
                href={`/quiz/${entry.publicationDate}`}
                style={{ color: "#0f172a", textDecoration: "none" }}
              >
                <strong style={{ fontSize: 17 }}>{entry.title}</strong>
              </Link>
              <div style={{ color: "#475569", marginTop: 8, fontSize: 14 }}>
                {entry.publicationDate} · {entry.topic} · {entry.difficulty}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer
        style={{
          marginTop: 40,
          background: "linear-gradient(135deg, #0f172a, #111827)",
          color: "#fff",
          borderRadius: 28,
          padding: "28px 24px",
          boxShadow: "0 22px 48px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontWeight: 800,
                color: "#cbd5e1",
              }}
            >
              Qodlume
            </p>
            <h3 style={{ margin: "12px 0 8px", fontSize: "1.8rem" }}>
              Practice smarter. Ship better.
            </h3>
          </div>

          <Link
            href="/archive"
            style={{
              display: "inline-block",
              background: "#fff",
              color: "#0f172a",
              padding: "12px 18px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Explore challenges
          </Link>
        </div>
      </footer>
    </main>
  );
}
