"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  calculateReactionStats,
  getKolkataDateKey,
  safeReadStorage,
  safeWriteStorage,
} from "../../lib/game-client-utils";
import type { ReactionTimeConfiguration } from "../../types/daily-game-challenge";

export function ReactionTimeGame({
  configuration,
  publicationDate,
}: {
  configuration: ReactionTimeConfiguration;
  publicationDate?: string;
}) {
  const requiredAttempts = configuration.attempts;
  const progressKey = `qodlume:reaction-time:${publicationDate ?? getKolkataDateKey()}`;
  const personalBestKey = "qodlume:reaction-time:personal-best";
  const [phase, setPhase] = useState<"intro" | "waiting" | "ready" | "false-start" | "results">("intro");
  const [attempts, setAttempts] = useState<number[]>([]);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [loadedProgressKey, setLoadedProgressKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("Press start to begin your reaction test.");
  const timeoutRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const beginRound = useCallback(() => {
    clearTimer();
    setStatusMessage("Wait for the signal...");
    setPhase("waiting");
    const delay =
      configuration.minimumDelayMs +
      Math.random() * (configuration.maximumDelayMs - configuration.minimumDelayMs);
    const scheduledAt = window.setTimeout(() => {
      setPhase("ready");
      setStatusMessage("Tap now!");
      startTimeRef.current = performance.now();
      timeoutRef.current = null;
    }, delay);
    timeoutRef.current = scheduledAt;
  }, [clearTimer, configuration.maximumDelayMs, configuration.minimumDelayMs]);

  const handleTap = useCallback(() => {
    if (phase === "intro" || phase === "results") {
      beginRound();
      return;
    }

    if (phase === "waiting") {
      clearTimer();
      setPhase("false-start");
      setStatusMessage("False start — you tapped before the signal. Try again.");
      return;
    }

    if (phase === "ready" && startTimeRef.current !== null) {
      const reactionTime = performance.now() - startTimeRef.current;
      const nextAttempts = [...attempts, reactionTime];
      setAttempts(nextAttempts);
      const oldBest = safeReadStorage<number | null>(personalBestKey, null);
      const nextBest = oldBest === null ? reactionTime : Math.min(oldBest, reactionTime);
      setPersonalBest(nextBest);
      safeWriteStorage(personalBestKey, nextBest);
      if (nextAttempts.length >= requiredAttempts) {
        setPhase("results");
        setStatusMessage("Final score ready.");
      } else {
        setPhase("intro");
        setStatusMessage(`Nice. Attempt ${nextAttempts.length}/${requiredAttempts}. Ready for the next shot?`);
      }
      startTimeRef.current = null;
      clearTimer();
    }
  }, [attempts, beginRound, clearTimer, personalBestKey, phase, requiredAttempts]);

  const stats = useMemo(() => calculateReactionStats(attempts), [attempts]);

  useEffect(() => {
    const savedAttempts = safeReadStorage<unknown>(progressKey, []);
    setAttempts(
      Array.isArray(savedAttempts)
        ? savedAttempts.filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value) && value > 0,
          )
        : [],
    );
    setPhase(
      Array.isArray(savedAttempts) && savedAttempts.length >= requiredAttempts
        ? "results"
        : "intro",
    );
    setLoadedProgressKey(progressKey);
  }, [progressKey, requiredAttempts]);

  useEffect(() => {
    const savedBest = safeReadStorage<unknown>(personalBestKey, null);
    setPersonalBest(
      typeof savedBest === "number" && Number.isFinite(savedBest) && savedBest > 0
        ? savedBest
        : null,
    );
  }, [personalBestKey]);

  useEffect(() => {
    if (loadedProgressKey !== progressKey) return;
    safeWriteStorage(progressKey, attempts);
  }, [attempts, loadedProgressKey, progressKey]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const shareScore = useCallback(async () => {
    const url = window.location.href;
    const text = `Reaction Time Challenge: ${stats.average} ms average, ${stats.best} ms best. ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Qodlume", text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Sharing is optional and should not interrupt gameplay.
    }
  }, [stats.average, stats.best]);

  const showResults = phase === "results";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        aria-live="polite"
        style={{
          minHeight: 120,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: 20,
          borderRadius: 28,
          border: "1px solid rgba(148,163,184,0.35)",
          background:
            phase === "ready"
              ? "linear-gradient(135deg, #dcfce7, #bbf7d0)"
              : phase === "waiting"
                ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                : phase === "false-start"
                  ? "linear-gradient(135deg, #fee2e2, #fecaca)"
                  : "linear-gradient(135deg, #eff6ff, #f8fafc)",
          boxShadow: "0 16px 30px rgba(15, 23, 42, 0.04)",
        }}
      >
        {showResults ? (
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>{stats.average} ms</div>
            <div style={{ color: "#475569" }}>Average reaction time</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "clamp(2.2rem, 12vw, 4rem)", fontWeight: 900, letterSpacing: "-0.08em" }}>
              {phase === "waiting" ? "Wait" : phase === "ready" ? "Tap!" : phase === "false-start" ? "Oops" : "Ready?"}
            </div>
            <div style={{ marginTop: 12, color: "#334155", fontWeight: 600 }}>{statusMessage}</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {!showResults && (
          <button
            type="button"
            onClick={phase === "waiting" || phase === "ready" ? handleTap : beginRound}
            style={{
              minHeight: 52,
              minWidth: 180,
              border: "none",
              borderRadius: 999,
              background: phase === "ready" ? "#16a34a" : "#0f172a",
              color: "#ffffff",
              fontWeight: 800,
              cursor: "pointer",
              padding: "12px 20px",
            }}
          >
            {phase === "waiting" ? "Tap to abort" : phase === "ready" ? "React now" : phase === "false-start" ? "Try again" : "Start round"}
          </button>
        )}

        {showResults && (
          <button
            type="button"
            onClick={() => {
              setAttempts([]);
              setPhase("intro");
              setStatusMessage("Press start to begin your reaction test.");
              startTimeRef.current = null;
            }}
            style={{
              minHeight: 52,
              minWidth: 180,
              border: "none",
              borderRadius: 999,
              background: "#0f172a",
              color: "#ffffff",
              fontWeight: 800,
              cursor: "pointer",
              padding: "12px 20px",
            }}
          >
            Replay
          </button>
        )}

        {showResults && (
          <button
            type="button"
            onClick={shareScore}
            style={{
              minHeight: 52,
              minWidth: 180,
              border: "1px solid rgba(148,163,184,0.35)",
              borderRadius: 999,
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 800,
              cursor: "pointer",
              padding: "12px 20px",
            }}
          >
            Share result
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <div style={{ background: "#f8fafc", borderRadius: 18, padding: 16, border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Attempts
          </div>
          <div style={{ fontWeight: 900, fontSize: 28 }}>{stats.count}/{requiredAttempts}</div>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 18, padding: 16, border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Best
          </div>
          <div style={{ fontWeight: 900, fontSize: 28 }}>{stats.best || "—"} ms</div>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 18, padding: 16, border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Average
          </div>
          <div style={{ fontWeight: 900, fontSize: 28 }}>{stats.average || "—"} ms</div>
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 18, padding: 16, border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ color: "#475569", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            Personal best
          </div>
          <div style={{ fontWeight: 900, fontSize: 28 }}>{personalBest ? `${Math.round(personalBest)} ms` : "—"}</div>
        </div>
      </div>

      <div style={{ color: "#475569", lineHeight: 1.6 }}>
        Focus on the signal, not the color. The goal is only to react when the screen says it is time.
      </div>
    </div>
  );
}
