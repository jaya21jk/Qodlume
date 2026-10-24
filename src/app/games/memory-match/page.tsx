"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GameShell } from "../../../components/game-shell";
import {
  getKolkataDateKey,
  safeReadStorage,
  safeWriteStorage,
  shuffleArray,
} from "../../../lib/game-logic";
import { useDailyGameChallenge } from "../../../lib/use-daily-game-challenge";
import { DEFAULT_DAILY_GAME_CONFIGURATIONS } from "../../../types/daily-game-challenge";

const LEVELS = {
  easy: { pairs: 6, label: "Easy" },
  medium: { pairs: 8, label: "Medium" },
  hard: { pairs: 12, label: "Hard" },
} as const;

const EMOJIS = ["🍉", "🍋", "🍇", "🍒", "🍊", "🍓", "🍍", "🥝", "🍏", "🍎", "🍐", "🍑"];

type Difficulty = keyof typeof LEVELS;

type Card = { id: number; value: string; matched: boolean };

export default function MemoryMatchPage() {
  const { challenge, loading, error } = useDailyGameChallenge("memory-match");
  const memoryConfiguration =
    challenge?.gameType === "memory-match"
      ? challenge.configuration
      : DEFAULT_DAILY_GAME_CONFIGURATIONS["memory-match"];
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timer, setTimer] = useState(0);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("Choose two cards to begin.");
  const progressKey = `qodlume:memory-match:${challenge?.publicationDate ?? getKolkataDateKey()}`;
  const [loadedProgressKey, setLoadedProgressKey] = useState("");

  const totalPairs =
    challenge?.gameType === "memory-match"
      ? memoryConfiguration.pairs
      : LEVELS[difficulty].pairs;
  const personalBestKey = `qodlume:memory-match:personal-best:${totalPairs}`;

  const setupGame = useCallback((level: Difficulty) => {
    const pairCount =
      challenge?.gameType === "memory-match"
        ? challenge.configuration.pairs
        : LEVELS[level].pairs;
    const sourceEmojis =
      challenge?.gameType === "memory-match"
        ? challenge.configuration.emojis
        : EMOJIS;
    const pairs = shuffleArray(sourceEmojis.slice(0, pairCount));
    const nextCards: Card[] = shuffleArray(
      pairs.flatMap((emoji, index) => [
        { id: index * 2, value: emoji, matched: false },
        { id: index * 2 + 1, value: emoji, matched: false },
      ]),
    );
    setCards(nextCards);
    setSelected([]);
    setMoves(0);
    setMatches(0);
    setTimer(0);
    setIsBusy(false);
    setStatus("Choose two cards to begin.");
  }, [challenge]);

  useEffect(() => {
    if (loading || error) return;
    const matchingLevel = (Object.keys(LEVELS) as Difficulty[]).find(
      (level) => LEVELS[level].pairs === memoryConfiguration.pairs,
    );
    const initialLevel = matchingLevel ?? "easy";
    if (matchingLevel) setDifficulty(matchingLevel);

    const saved = safeReadStorage<{
      cards: Card[];
      selected: number[];
      moves: number;
      matches: number;
      timer: number;
      status: string;
    } | null>(progressKey, null);
    if (
      saved &&
      Array.isArray(saved.cards) &&
      saved.cards.length === memoryConfiguration.pairs * 2 &&
      saved.cards.every(
        (card) =>
          card !== null &&
          typeof card === "object" &&
          Number.isInteger(card.id) &&
          typeof card.value === "string" &&
          typeof card.matched === "boolean",
      ) &&
      Array.isArray(saved.selected) &&
      saved.selected.length <= 2 &&
      saved.selected.every((id) => Number.isInteger(id)) &&
      Number.isInteger(saved.moves) &&
      saved.moves >= 0 &&
      Number.isInteger(saved.matches) &&
      saved.matches >= 0 &&
      Number.isInteger(saved.timer) &&
      saved.timer >= 0 &&
      typeof saved.status === "string"
    ) {
      setCards(saved.cards);
      setSelected(saved.selected);
      setMoves(saved.moves);
      setMatches(saved.matches);
      setTimer(saved.timer);
      setStatus(saved.status);
      setIsBusy(false);
    } else {
      setupGame(initialLevel);
    }
    setLoadedProgressKey(progressKey);
  }, [challenge?.id, error, loading, memoryConfiguration.pairs, progressKey, setupGame]);

  useEffect(() => {
    if (loadedProgressKey !== progressKey) return;
    safeWriteStorage(progressKey, { cards, selected, moves, matches, timer, status });
  }, [cards, loadedProgressKey, matches, moves, progressKey, selected, status, timer]);

  useEffect(() => {
    if (matches === totalPairs && totalPairs > 0) {
      setStatus(`Board complete in ${moves} moves. Nice work!`);
      return;
    }

    if (cards.length === 0) {
      return;
    }

    const interval = window.setInterval(() => setTimer((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [cards.length, matches, moves, totalPairs]);

  const formattedTimer = useMemo(() => {
    const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
    const seconds = String(timer % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [timer]);

  useEffect(() => {
    const savedBest = safeReadStorage<unknown>(personalBestKey, null);
    setPersonalBest(
      typeof savedBest === "number" && Number.isInteger(savedBest) && savedBest > 0
        ? savedBest
        : null,
    );
  }, [personalBestKey]);

  useEffect(() => {
    if (matches !== totalPairs || moves < 1) return;
    const previousBest = safeReadStorage<number | null>(personalBestKey, null);
    if (previousBest === null || moves < previousBest) {
      safeWriteStorage(personalBestKey, moves);
      setPersonalBest(moves);
    }
  }, [matches, moves, personalBestKey, totalPairs]);

  useEffect(() => {
    if (selected.length !== 2) return;
    setIsBusy(true);
    const [firstId, secondId] = selected;
    const firstCard = cards.find((card) => card.id === firstId);
    const secondCard = cards.find((card) => card.id === secondId);

    if (!firstCard || !secondCard) {
      setIsBusy(false);
      return;
    }

    if (firstCard.value === secondCard.value) {
      setCards((current) =>
        current.map((card) =>
          card.id === firstId || card.id === secondId ? { ...card, matched: true } : card,
        ),
      );
      setMatches((current) => current + 1);
      setStatus("Match! Keep going.");
      setSelected([]);
      setIsBusy(false);
      return;
    }

    setStatus("Not a match. Try again.");
    const timeout = window.setTimeout(() => {
      setSelected([]);
      setIsBusy(false);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [cards, selected]);

  const handleCardClick = useCallback((id: number) => {
    if (isBusy || selected.includes(id)) return;

    const card = cards.find((item) => item.id === id);
    if (!card || card.matched) return;

    const nextSelection = [...selected, id];
    setSelected(nextSelection);
    if (selected.length + 1 === 2) {
      setMoves((current) => current + 1);
    }
  }, [cards, isBusy, selected]);

  const boardComplete = matches === totalPairs;

  return (
    <GameShell
      title={challenge?.title ?? "Memory Match"}
      subtitle={challenge?.description ?? "Flip cards, find the pair, and finish the board in the fewest moves."}
    >
      {loading ? <p aria-live="polite">Loading today&apos;s challenge…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error ? (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(LEVELS) as Difficulty[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  if (challenge?.gameType === "memory-match") return;
                  setDifficulty(level);
                  setupGame(level);
                }}
                disabled={challenge?.gameType === "memory-match"}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "10px 14px",
                  background: difficulty === level ? "#0f172a" : "#e2e8f0",
                  color: difficulty === level ? "#ffffff" : "#0f172a",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {LEVELS[level].label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)" }}>
              <strong>{moves}</strong> moves
            </div>
            <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)" }}>
              <strong>{formattedTimer}</strong>
            </div>
            <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(148,163,184,0.2)" }}>
              <strong>{personalBest ?? "—"}</strong> best
            </div>
          </div>
        </div>

        <div style={{ color: "#334155", fontWeight: 700, background: "rgba(255,255,255,0.7)", borderRadius: 16, padding: "10px 14px", border: "1px solid rgba(148,163,184,0.2)" }}>
          {status}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${totalPairs === 6 ? 3 : 4}, minmax(0, 1fr))`,
            gap: 12,
          }}
        >
          {cards.map((card) => {
            const isVisible = selected.includes(card.id) || card.matched;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card.id)}
                aria-label={isVisible ? `Card showing ${card.value}` : "Hidden card"}
                disabled={card.matched || isBusy}
                style={{
                  aspectRatio: "1 / 1",
                  border: "none",
                  borderRadius: 18,
                  background: isVisible ? "#ffffff" : "linear-gradient(135deg, #0f172a, #1d4ed8)",
                  color: isVisible ? "#0f172a" : "#ffffff",
                  fontSize: "clamp(1.5rem, 5vw, 2.3rem)",
                  fontWeight: 800,
                  cursor: card.matched ? "default" : "pointer",
                  boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
                }}
              >
                {isVisible ? card.value : "?"}
              </button>
            );
          })}
        </div>

        {boardComplete && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => setupGame(difficulty)}
              style={{
                minHeight: 48,
                borderRadius: 999,
                border: "none",
                padding: "0 20px",
                background: "#0f172a",
                color: "#ffffff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Play again
            </button>
          </div>
        )}
      </div>
      ) : null}
    </GameShell>
  );
}
