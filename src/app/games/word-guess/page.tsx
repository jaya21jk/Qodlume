"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getKolkataDateKey,
  safeReadStorage,
  safeWriteStorage,
} from "../../../lib/game-client-utils";
import { GameShell } from "../../../components/game-shell";
import { useDailyGameChallenge } from "../../../lib/use-daily-game-challenge";

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const EMPTY_ROW = Array(WORD_LENGTH).fill("");

function getKeyboardLayout() {
  return [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ];
}

export default function WordGuessPage() {
  const { challenge, loading, error } = useDailyGameChallenge("word-guess");
  const progressKey = `qodlume:word-guess:${challenge?.publicationDate ?? getKolkataDateKey()}`;
  const [board, setBoard] = useState<string[][]>(Array.from({ length: MAX_ATTEMPTS }, () => [...EMPTY_ROW]));
  const [feedback, setFeedback] = useState<Array<Array<"correct" | "present" | "absent">>>(
    Array.from({ length: MAX_ATTEMPTS }, () => Array(WORD_LENGTH).fill("absent")),
  );
  const [currentRow, setCurrentRow] = useState(0);
  const [currentColumn, setCurrentColumn] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("Type a five-letter word and press Enter.");
  const [status, setStatus] = useState<Record<string, "correct" | "present" | "absent">>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadedProgressKey, setLoadedProgressKey] = useState("");
  const submittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const progress = safeReadStorage<{
      board: string[][];
      feedback: Array<Array<"correct" | "present" | "absent">>;
      currentRow: number;
      currentColumn: number;
      hasWon: boolean;
      gameOver: boolean;
      message: string;
      status: Record<string, "correct" | "present" | "absent">;
    } | null>(progressKey, null);
    if (
      progress &&
      Array.isArray(progress.board) &&
      progress.board.length === MAX_ATTEMPTS &&
      progress.board.every(
        (row) =>
          Array.isArray(row) &&
          row.length === WORD_LENGTH &&
          row.every((cell) => typeof cell === "string"),
      ) &&
      Array.isArray(progress.feedback) &&
      progress.feedback.length === MAX_ATTEMPTS &&
      progress.feedback.every(
        (row) =>
          Array.isArray(row) &&
          row.length === WORD_LENGTH &&
          row.every((state) =>
            state === "correct" || state === "present" || state === "absent",
          ),
      ) &&
      Number.isInteger(progress.currentRow) &&
      progress.currentRow >= 0 &&
      progress.currentRow < MAX_ATTEMPTS &&
      Number.isInteger(progress.currentColumn) &&
      progress.currentColumn >= 0 &&
      progress.currentColumn <= WORD_LENGTH &&
      typeof progress.hasWon === "boolean" &&
      typeof progress.gameOver === "boolean" &&
      typeof progress.message === "string" &&
      typeof progress.status === "object" &&
      progress.status !== null &&
      !Array.isArray(progress.status)
    ) {
      setBoard(progress.board);
      setFeedback(progress.feedback);
      setCurrentRow(progress.currentRow);
      setCurrentColumn(progress.currentColumn);
      setHasWon(progress.hasWon);
      setGameOver(progress.gameOver);
      setMessage(progress.message);
      setStatus(progress.status);
    } else {
      setBoard(Array.from({ length: MAX_ATTEMPTS }, () => [...EMPTY_ROW]));
      setFeedback(Array.from({ length: MAX_ATTEMPTS }, () => Array(WORD_LENGTH).fill("absent")));
      setCurrentRow(0);
      setCurrentColumn(0);
      setHasWon(false);
      setGameOver(false);
      setMessage("Type a five-letter word and press Enter.");
      setStatus({});
    }
    setLoadedProgressKey(progressKey);
  }, [progressKey]);

  useEffect(() => {
    if (loadedProgressKey !== progressKey) return;
    safeWriteStorage(progressKey, {
      board,
      feedback,
      currentRow,
      currentColumn,
      hasWon,
      gameOver,
      message,
      status,
    });
  }, [
    board,
    currentColumn,
    currentRow,
    feedback,
    gameOver,
    hasWon,
    loadedProgressKey,
    message,
    progressKey,
    status,
  ]);

  const canSubmit = currentColumn === WORD_LENGTH && !gameOver;

  const revealBoard = useCallback(async (guess: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/daily-game-challenges/word-guess/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess }),
      });
      const result = (await response.json()) as {
        feedback?: Array<"correct" | "present" | "absent">;
        won?: boolean;
        error?: string;
      };
      if (!response.ok || !result.feedback) {
        setMessage(result.error ?? "Unable to check this guess. Try again.");
        return;
      }
      const evaluated = result.feedback;
      const nextBoard = board.map((row, rowIndex) =>
        rowIndex === currentRow ? [...guess.split("")] : row,
      );
      const nextFeedback = feedback.map((row, rowIndex) =>
        rowIndex === currentRow ? [...evaluated] : row,
      );
      setBoard(nextBoard);
      setFeedback(nextFeedback);
      const nextStatus = { ...status };
      for (let index = 0; index < evaluated.length; index += 1) {
        const letter = guess[index];
        const current = nextStatus[letter] ?? "absent";
        if (
          evaluated[index] === "correct" ||
          (evaluated[index] === "present" && current !== "correct")
        ) {
          nextStatus[letter] = evaluated[index];
        } else if (
          evaluated[index] === "absent" &&
          current !== "correct" &&
          current !== "present"
        ) {
          nextStatus[letter] = "absent";
        }
      }
      setStatus(nextStatus);

      if (result.won) {
        setHasWon(true);
        setGameOver(true);
        setMessage("Congratulations! You guessed the word!");
        return;
      }

      if (currentRow === MAX_ATTEMPTS - 1) {
        setGameOver(true);
        setMessage("Out of attempts. Come back for the next daily word.");
        return;
      }

      const nextRow = currentRow + 1;
      setCurrentRow(nextRow);
      setCurrentColumn(0);
      setMessage("Keep going — you’ve got this.");
    } catch {
      setMessage("Unable to check this guess. Check your connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [board, currentRow, feedback, status]);

  const handleKeyPress = useCallback((key: string) => {
    if (
      !challenge ||
      challenge.gameType !== "word-guess" ||
      gameOver ||
      submitting ||
      submittingRef.current
    ) return;

    if (key === "ENTER") {
      if (!canSubmit) {
        setMessage("The word must be five letters long.");
        return;
      }

      const guess = board[currentRow].join("");
      if (guess.length !== WORD_LENGTH) {
        setMessage("Complete the row before submitting.");
        return;
      }
      void revealBoard(guess);
      return;
    }

    if (key === "⌫") {
      if (currentColumn === 0) return;
      const nextBoard = [...board];
      nextBoard[currentRow][currentColumn - 1] = "";
      setBoard(nextBoard);
      setCurrentColumn((value) => Math.max(0, value - 1));
      return;
    }

    if (!/^[A-Z]$/i.test(key)) return;
    if (currentColumn >= WORD_LENGTH) return;

    const nextBoard = [...board];
    nextBoard[currentRow][currentColumn] = key.toUpperCase();
    setBoard(nextBoard);
    setCurrentColumn((value) => value + 1);
  }, [board, canSubmit, challenge, currentColumn, currentRow, gameOver, revealBoard, submitting]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void handleKeyPress("ENTER");
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        void handleKeyPress("⌫");
        return;
      }
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        void handleKeyPress(event.key.toUpperCase());
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKeyPress]);

  const boardRows = useMemo(() => board, [board]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const restartGame = useCallback(() => {
    setBoard(Array.from({ length: MAX_ATTEMPTS }, () => [...EMPTY_ROW]));
    setFeedback(Array.from({ length: MAX_ATTEMPTS }, () => Array(WORD_LENGTH).fill("absent")));
    setCurrentRow(0);
    setCurrentColumn(0);
    setHasWon(false);
    setGameOver(false);
    setStatus({});
    setMessage("Type a five-letter word and press Enter.");
  }, []);

  return (
    <GameShell
      title={challenge?.title ?? "Word Guess"}
      subtitle={challenge?.description ?? "Solve today’s five-letter word before your six attempts run out."}
    >
      {loading ? <p aria-live="polite">Loading today&apos;s challenge…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error && !challenge ? (
        <p role="status">No Word Guess challenge is published for today. Please check back later.</p>
      ) : null}
      {!loading && !error && challenge?.gameType === "word-guess" ? (
      <div style={{ display: "grid", gap: 18 }}>
        <div
          aria-live="polite"
          style={{
            background: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(148,163,184,0.28)",
            borderRadius: 18,
            padding: "12px 14px",
            fontWeight: 700,
            color: "#334155",
          }}
        >
          {message}
        </div>

        <p style={{ margin: 0, color: "#475569", textAlign: "center" }}>
          Type letters with your keyboard. Press Enter to check a five-letter guess and Backspace to edit.
        </p>

        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          {boardRows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} style={{ display: "grid", gridTemplateColumns: `repeat(${WORD_LENGTH}, minmax(0, 1fr))`, gap: 8, width: "min(100%, 360px)" }}>
              {row.map((cell, columnIndex) => {
                const state = feedback[rowIndex]?.[columnIndex] ?? "absent";
                const hasLetter = Boolean(cell);
                const isSubmitted =
                  rowIndex < currentRow || (gameOver && rowIndex === currentRow);
                const tone =
                  isSubmitted && state === "correct"
                    ? "#16a34a"
                    : isSubmitted && state === "present"
                      ? "#f59e0b"
                      : isSubmitted
                        ? "#64748b"
                        : "#ffffff";
                return (
                  <div
                    key={`cell-${rowIndex}-${columnIndex}`}
                    aria-label={
                      cell
                        ? `Row ${rowIndex + 1}, Column ${columnIndex + 1}, ${cell}${
                            isSubmitted ? `, ${state === "correct" ? "correct position" : state === "present" ? "in word, different position" : "not in word"}` : ""
                          }`
                        : `Row ${rowIndex + 1}, Column ${columnIndex + 1}, empty`
                    }
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 14,
                      border: isSubmitted
                        ? `1px solid ${tone}`
                        : hasLetter
                          ? "2px solid #64748b"
                          : "1px solid rgba(148,163,184,0.35)",
                      background: tone,
                      color: isSubmitted ? "#ffffff" : "#0f172a",
                      fontWeight: 900,
                      fontSize: "clamp(1.1rem, 4vw, 1.8rem)",
                      textTransform: "uppercase",
                    }}
                  >
                    {cell}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          aria-label="Guess color guide"
          style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", color: "#334155", fontSize: 14 }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, background: "#16a34a" }} />
            Correct letter and position
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, background: "#f59e0b" }} />
            Correct letter, different position
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 4, background: "#64748b" }} />
            Letter not in the word
          </span>
        </div>

        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          <div style={{ display: "grid", gap: 8, width: "min(100%, 420px)" }}>
            {getKeyboardLayout().map((row, rowIndex) => (
              <div key={`keyboard-row-${rowIndex}`} style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                {row.map((key) => {
                  const state = status[key];
                  const filled = key === "ENTER" || key === "⌫";
                  const background = filled
                    ? "#0f172a"
                    : state === "correct"
                      ? "#16a34a"
                      : state === "present"
                        ? "#f59e0b"
                        : state === "absent" ? "#64748b" : "#e2e8f0";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyPress(key)}
                      aria-label={
                        key === "ENTER"
                          ? "Enter guess"
                          : key === "⌫"
                            ? "Delete letter"
                            : state === "correct"
                              ? `${key}, correct position`
                              : state === "present"
                                ? `${key}, in word but different position`
                                : state === "absent"
                                  ? `${key}, not in word`
                                  : key
                      }
                      style={{
                        minWidth: key === "ENTER" || key === "⌫" ? 72 : 32,
                        minHeight: 46,
                        padding: "0 12px",
                        border: "none",
                        borderRadius: 12,
                        background,
                        color: filled || status[key] ? "#ffffff" : "#0f172a",
                        fontWeight: 800,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                      disabled={submitting || gameOver}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              onClick={restartGame}
              style={{
                minHeight: 48,
                padding: "0 20px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.35)",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Replay
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{
                minHeight: 48,
                padding: "0 20px",
                borderRadius: 999,
                border: "none",
                background: "#0f172a",
                color: "#ffffff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Back to games
            </button>
          </div>
        </div>

        <input
          ref={inputRef}
          aria-label="Word Guess keyboard input"
          value=""
          readOnly
          tabIndex={-1}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      </div>
      ) : null}
    </GameShell>
  );
}
