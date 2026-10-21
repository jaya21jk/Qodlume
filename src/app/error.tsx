"use client";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "80px auto",
        padding: 28,
        textAlign: "center",
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: 24,
      }}
    >
      <h1>We couldn&apos;t load Qodlume</h1>
      <p style={{ color: "#475569", lineHeight: 1.7 }}>
        The quiz service is temporarily unavailable. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          border: 0,
          borderRadius: 12,
          background: "#2563eb",
          color: "#fff",
          padding: "12px 18px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </main>
  );
}
