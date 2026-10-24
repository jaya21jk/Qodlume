"use client";

import Link from "next/link";
import { useState } from "react";

export function HomeShowcase({
  quiz,
  topics,
  topicLabels,
}: {
  quiz: { title: string; description: string; publicationDate: string } | null;
  topics: string[];
  topicLabels: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<"quizzes" | "games">("quizzes");

  const statCards = [
    ["12k+", "active learners"],
    ["4.9/5", "average rating"],
    ["3 min", "daily challenge"],
  ];

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 20px 80px",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
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
        </div>

        <nav
          style={{
            display: "flex",
            gap: 10,
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(148,163,184,0.32)",
            borderRadius: 999,
            padding: 6,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("quizzes")}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 999,
              padding: "10px 16px",
              background: activeTab === "quizzes" ? "#0f172a" : "transparent",
              color: activeTab === "quizzes" ? "#ffffff" : "#334155",
              fontWeight: 700,
            }}
          >
            Quizzes
          </button>
          <Link
            href="/games"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              borderRadius: 999,
              padding: "10px 16px",
              background: activeTab === "games" ? "#0f172a" : "transparent",
              color: activeTab === "games" ? "#ffffff" : "#334155",
              fontWeight: 700,
            }}
          >
            Games
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
          padding: "28px 20px",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
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
            gridTemplateColumns: "1fr",
            gap: 22,
            alignItems: "center",
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
                color: "#2563eb",
              }}
            >
              Quick daily workout
            </p>
            <h1
              style={{
                margin: "14px 0 10px",
                fontSize: "clamp(2.2rem, 7vw, 4rem)",
                lineHeight: 1.04,
                letterSpacing: "-0.06em",
              }}
            >
              Give your brain a quick workout.
            </h1>
            <p
              style={{
                margin: "0 0 20px",
                color: "#475569",
                fontSize: "1.05rem",
                lineHeight: 1.7,
              }}
            >
              Play daily quizzes, solve clever puzzles, and challenge your personal best.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <Link
                href={quiz ? `/quiz/${quiz.publicationDate}` : "/archive"}
                style={{
                  textDecoration: "none",
                  color: "#ffffff",
                  background: "#0f172a",
                  borderRadius: 999,
                  padding: "14px 20px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Explore Quizzes
              </Link>
              <Link
                href="/games"
                style={{
                  textDecoration: "none",
                  color: "#0f172a",
                  background: "#ffffff",
                  border: "1px solid rgba(148,163,184,0.4)",
                  borderRadius: 999,
                  padding: "14px 20px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Play Games
              </Link>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(148,163,184,0.25)",
              borderRadius: 24,
              padding: 18,
              display: "grid",
              gap: 10,
            }}
          >
            {statCards.map(([value, label]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "#f8fafc",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: "1.2rem" }}>{value}</span>
                <span style={{ color: "#475569" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        {activeTab === "quizzes" ? (
          <div
            style={{
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(148,163,184,0.28)",
              borderRadius: 26,
              padding: 22,
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.04)",
            }}
          >
            {quiz ? (
              <>
                <p style={{ margin: 0, color: "#2563eb", fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  Today&apos;s challenge
                </p>
                <h2 style={{ margin: "12px 0 8px", fontSize: "clamp(1.8rem, 4vw, 2.5rem)" }}>{quiz.title}</h2>
                <p style={{ margin: "0 0 16px", color: "#475569", lineHeight: 1.7 }}>{quiz.description}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "#eff6ff", borderRadius: 999, padding: "7px 12px", fontWeight: 700 }}>{quiz.publicationDate}</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <Link
                    href={`/quiz/${quiz.publicationDate}`}
                    style={{
                      textDecoration: "none",
                      color: "#ffffff",
                      background: "#2563eb",
                      borderRadius: 999,
                      padding: "12px 18px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                    }}
                  >
                    Start quiz
                  </Link>
                </div>
              </>
            ) : (
              <div>
                <p style={{ margin: 0, color: "#475569" }}>No quiz is available today. Visit the archive for recent challenges.</p>
                <div style={{ marginTop: 14 }}>
                  <Link href="/archive" style={{ textDecoration: "none", color: "#2563eb", fontWeight: 700 }}>
                    Open archive
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
            }}
          >
            {[
              { title: "Reaction Time Challenge", description: "Test your reflexes with 5 fast, fair attempts.", duration: "2 min", href: "/games/reaction-time" },
              { title: "Word Guess", description: "Solve today’s five-letter daily puzzle in six tries.", duration: "3 min", href: "/games/word-guess" },
              { title: "Memory Match", description: "Flip, match, and clear the board as fast as you can.", duration: "4 min", href: "/games/memory-match" },
            ].map((game) => (
              <Link
                key={game.title}
                href={game.href}
                style={{
                  textDecoration: "none",
                  color: "#0f172a",
                  background: "rgba(255,255,255,0.82)",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 24,
                  padding: 18,
                  display: "block",
                  boxShadow: "0 15px 32px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>{game.title}</div>
                <p style={{ margin: "0 0 12px", color: "#475569", lineHeight: 1.6 }}>{game.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#2563eb", fontWeight: 800 }}>{game.duration}</span>
                  <span style={{ fontWeight: 800 }}>Play now</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
