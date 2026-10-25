import Link from "next/link";
import { DailyGameChallengeConsole } from "../../../components/daily-game-challenge-console";

export default function AdminDailyGamesPage() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 72px" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/admin" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 700 }}>
          ← Admin dashboard
        </Link>
        <Link href="/games" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 700 }}>
          Public games
        </Link>
        <Link href="/admin/game-management" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 700 }}>
          Manage challenges
        </Link>
      </div>
      <header style={{
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "#fff",
        borderRadius: 28,
        padding: "28px 26px",
        marginBottom: 26,
        boxShadow: "0 20px 44px rgba(15, 23, 42, 0.2)",
      }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, color: "#cbd5e1" }}>
          Content operations
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          Import daily game challenges
        </h1>
        <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.7 }}>
          Import one or many daily game challenges, review validation and schedules, then save drafts, schedule, or publish valid records immediately.
        </p>
      </header>
      <DailyGameChallengeConsole view="import" />
    </main>
  );
}
