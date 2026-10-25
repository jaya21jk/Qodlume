import Link from "next/link";

export function QuizSectionNavigation({
  activePage,
}: {
  activePage: "today" | "previous";
}) {
  const linkStyle = {
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    textDecoration: "none",
    color: "#0f172a",
    background: "#fff",
    border: "1px solid rgba(148,163,184,0.35)",
  };
  const activeStyle = {
    ...linkStyle,
    color: "#fff",
    background: "#2563eb",
    border: "1px solid #2563eb",
  };

  return (
    <nav aria-label="Quiz pages" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
      <Link
        href="/quizzes"
        aria-current={activePage === "today" ? "page" : undefined}
        style={activePage === "today" ? activeStyle : linkStyle}
      >
        Today&apos;s quiz
      </Link>
      <Link
        href="/quizzes/previous"
        aria-current={activePage === "previous" ? "page" : undefined}
        style={activePage === "previous" ? activeStyle : linkStyle}
      >
        Previous quizzes
      </Link>
    </nav>
  );
}
