import Link from "next/link";

const games = [
  {
    title: "Reaction Time Challenge",
    description: "Measure how quickly you can react when the signal appears.",
    duration: "2 min",
    difficulty: "Fast",
    href: "/games/reaction-time",
  },
  {
    title: "Word Guess",
    description: "Crack today’s five-letter puzzle with six careful guesses.",
    duration: "3 min",
    difficulty: "Daily",
    href: "/games/word-guess",
  },
  {
    title: "Memory Match",
    description: "Flip cards, match emojis, and beat your best board score.",
    duration: "4 min",
    difficulty: "Varied",
    href: "/games/memory-match",
  },
];

export default function GamesPage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 18px 72px" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 700 }}>
          ← Back home
        </Link>
      </div>

      <header
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #eef2ff 100%)",
          border: "1px solid rgba(148,163,184,0.26)",
          borderRadius: 28,
          padding: "28px 20px",
          marginBottom: 22,
          boxShadow: "0 18px 48px rgba(15,23,42,0.04)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, color: "#2563eb" }}>
          Play
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(2.2rem, 6vw, 3.3rem)", lineHeight: 1.08 }}>
          Quick Games
        </h1>
        <p style={{ margin: 0, color: "#475569", fontSize: "1.05rem", lineHeight: 1.7 }}>
          Little challenges. Big brain energy.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18,
        }}
      >
        {games.map((game) => (
          <article
            key={game.title}
            style={{
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(148,163,184,0.28)",
              borderRadius: 24,
              padding: 20,
              boxShadow: "0 18px 38px rgba(15,23,42,0.04)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 30 }}>🎯</div>
              <span style={{ background: "#eef2ff", color: "#312e81", borderRadius: 999, padding: "7px 10px", fontWeight: 800, fontSize: 12 }}>
                {game.difficulty}
              </span>
            </div>

            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>{game.title}</h2>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{game.description}</p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#334155", fontWeight: 700 }}>
              <span>{game.duration}</span>
              <span>Progress saved locally</span>
            </div>

            <Link
              href={game.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "#ffffff",
                background: "#0f172a",
                borderRadius: 999,
                minHeight: 46,
                fontWeight: 800,
                padding: "12px 16px",
              }}
            >
              Play Now
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
