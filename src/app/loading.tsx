export default function Loading() {
  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px 80px",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(148,163,184,0.24)",
          borderRadius: 28,
          padding: 28,
          boxShadow: "0 18px 42px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            width: 180,
            height: 14,
            borderRadius: 999,
            background:
              "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "pulse 1.4s ease-in-out infinite",
            marginBottom: 18,
          }}
        />
        <div
          style={{
            width: "60%",
            height: 42,
            borderRadius: 12,
            background:
              "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "pulse 1.4s ease-in-out infinite",
            marginBottom: 16,
          }}
        />
        <div
          style={{
            width: "100%",
            height: 18,
            borderRadius: 10,
            background:
              "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "pulse 1.4s ease-in-out infinite",
            marginBottom: 12,
          }}
        />
        <div
          style={{
            width: "80%",
            height: 18,
            borderRadius: 10,
            background:
              "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </main>
  );
}
