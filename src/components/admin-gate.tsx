"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

export function AdminGate({ children }: { children: ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to check admin session.");
        const result = (await response.json()) as { authenticated: boolean };
        if (active) setIsAuthorized(result.authenticated);
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "Unable to check admin session.",
          );
        }
      })
      .finally(() => {
        if (active) setMounted(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to sign in.");
        return;
      }
      setIsAuthorized(true);
      setPassword("");
    } catch {
      setError("Unable to reach the admin sign-in service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) {
        setError("Unable to sign out. Please retry.");
        return;
      }
      setPassword("");
      setError("");
      setIsAuthorized(false);
    } catch {
      setError("Unable to reach the admin sign-out service.");
    }
  };

  if (!mounted) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px",
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(148,163,184,0.24)",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              width: 170,
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
              width: "70%",
              height: 42,
              borderRadius: 12,
              background:
                "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
              backgroundSize: "200% 100%",
              animation: "pulse 1.4s ease-in-out infinite",
              marginBottom: 14,
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
            }}
          />
          <style>{`
            @keyframes pulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px",
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #0f172a, #1e293b)",
            borderRadius: 28,
            boxShadow: "0 24px 52px rgba(15, 23, 42, 0.18)",
            color: "#fff",
            padding: 28,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#cbd5e1",
              letterSpacing: 2,
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: 12,
            }}
          >
            Protected workspace
          </p>
          <h1
            style={{
              margin: "12px 0 10px",
              fontSize: "clamp(2.2rem, 4vw, 3rem)",
            }}
          >
            Admin access required
          </h1>
          <p style={{ margin: 0, color: "#cbd5e1", lineHeight: 1.7 }}>
            This area manages live Qodlume content. Enter the access code to
            continue.
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <label
              htmlFor="admin-password"
              style={{ display: "block", marginBottom: 10, fontWeight: 700 }}
            >
              Access code
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter admin code"
              style={{
                width: "100%",
                border: "1px solid rgba(148,163,184,0.35)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16,
                outline: "none",
              }}
            />

            {error ? (
              <p
                style={{
                  margin: "12px 0 0",
                  color: "#fca5a5",
                  fontWeight: 600,
                }}
              >
                {error}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 18,
              }}
            >
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  border: 0,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  color: "#fff",
                  padding: "12px 18px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {isSubmitting ? "Signing in…" : "Unlock admin"}
              </button>
              <Link
                href="/"
                style={{
                  color: "#dbeafe",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Back to public site
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "24px 20px 0",
        }}
      >
        <nav
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 18,
            padding: "14px 18px",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Link
              href="/admin"
              style={{
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Dashboard
            </Link>
            <Link
              href="/admin/import"
              style={{
                color: "#475569",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Import
            </Link>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                color: "#0f172a",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              View public site
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                border: "1px solid rgba(148,163,184,0.35)",
                borderRadius: 999,
                background: "#fff",
                color: "#0f172a",
                padding: "9px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </nav>
      </div>

      {children}
    </div>
  );
}
