export default function AdminLoading() {
  return (
    <main
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "40px 24px 72px",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          borderRadius: 30,
          padding: "30px 28px",
          boxShadow: "0 24px 52px rgba(15, 23, 42, 0.18)",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 180,
            height: 12,
            borderRadius: 999,
            background: "rgba(203,213,225,0.25)",
            marginBottom: 18,
          }}
        />
        <div
          style={{
            width: "70%",
            height: 42,
            borderRadius: 12,
            background: "rgba(203,213,225,0.2)",
            marginBottom: 14,
          }}
        />
        <div
          style={{
            width: "90%",
            height: 18,
            borderRadius: 10,
            background: "rgba(203,213,225,0.18)",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 18,
        }}
      >
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            style={{
              background: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: 20,
              padding: 22,
              height: 120,
            }}
          />
        ))}
      </div>
    </main>
  );
}
