import Link from "next/link";
import type { ReactNode } from "react";

export function GameShell({
  title,
  subtitle,
  children,
  backHref = "/games",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <main
      className="game-shell"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "24px 16px 72px",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <Link
          href={backHref}
          style={{
            textDecoration: "none",
            color: "#0f172a",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(148,163,184,0.35)",
          }}
        >
          ← Back to games
        </Link>
      </div>

      <header
        style={{
          marginBottom: 20,
          background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
          border: "1px solid rgba(148,163,184,0.25)",
          borderRadius: 24,
          padding: "20px 18px",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: "uppercase",
            fontWeight: 800,
            color: "#2563eb",
          }}
        >
          Game challenge
        </p>
        <h1 style={{ margin: "10px 0 6px", fontSize: "clamp(2rem, 5vw, 3rem)" }}>{title}</h1>
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{subtitle}</p>
      </header>

      {children}
    </main>
  );
}
