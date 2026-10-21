import Link from "next/link";

const adminMenu = [
  {
    title: "Manage and publish quizzes",
    description:
      "Create drafts, validate imports, schedule releases, and manage live quizzes.",
    href: "/admin/import",
    accent: "#2563eb",
  },
  {
    title: "View public site",
    description:
      "Open the user-facing homepage and challenge experience for final checks.",
    href: "/",
    accent: "#0f172a",
  },
];

export default function AdminPage() {
  const metrics = [
    ["3", "active content tracks"],
    ["98%", "validation pass rate"],
    ["Daily", "content cadence"],
  ];

  return (
    <main
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "40px 24px 72px",
      }}
    >
      <header
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#fff",
          borderRadius: 30,
          padding: "30px 28px",
          boxShadow: "0 24px 52px rgba(15, 23, 42, 0.18)",
          marginBottom: 28,
        }}
      >
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
          Admin workspace
        </p>
        <h1
          style={{
            margin: "12px 0 8px",
            fontSize: "clamp(2.2rem, 4vw, 3.4rem)",
          }}
        >
          Manage the Qodlume content engine
        </h1>
        <p
          style={{
            margin: 0,
            color: "#cbd5e1",
            lineHeight: 1.7,
            maxWidth: 760,
          }}
        >
          This is the operational area for publishing and validating daily
          developer challenges. Public users only see the front-end experience,
          while admin tools handle the content pipeline.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 18,
          marginBottom: 28,
        }}
      >
        {metrics.map(([value, label]) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(148,163,184,0.28)",
              borderRadius: 20,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 800 }}>{value}</div>
            <div style={{ color: "#475569", marginTop: 8 }}>{label}</div>
          </div>
        ))}
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18,
        }}
      >
        {adminMenu.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            style={{
              textDecoration: "none",
              color: "#0f172a",
              background: "rgba(255,255,255,0.82)",
              border: "1px solid rgba(148,163,184,0.28)",
              borderRadius: 22,
              padding: 22,
              boxShadow: "0 14px 28px rgba(15,23,42,0.06)",
              display: "block",
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: item.accent,
                marginBottom: 12,
              }}
            />
            <h2 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
              {item.title}
            </h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
