import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "90px auto",
        padding: 28,
        textAlign: "center",
        background: "rgba(255,255,255,0.8)",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: 24,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#475569",
          fontWeight: 800,
        }}
      >
        Challenge unavailable
      </p>
      <h1 style={{ margin: "16px 0 10px" }}>Quiz not found</h1>
      <p style={{ color: "#475569", lineHeight: 1.7 }}>
        The requested challenge date is not part of the published archive.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          background: "#0f172a",
          color: "#fff",
          textDecoration: "none",
          padding: "12px 18px",
          borderRadius: 12,
          fontWeight: 700,
        }}
      >
        Return to home
      </Link>
    </main>
  );
}
