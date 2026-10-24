"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateWordGuess,
  getKolkataDateKey,
  safeReadStorage,
  safeWriteStorage,
} from "../../../lib/game-logic";
import { GameShell } from "../../../components/game-shell";
import { useDailyGameChallenge } from "../../../lib/use-daily-game-challenge";
import { DEFAULT_DAILY_GAME_CONFIGURATIONS } from "../../../types/daily-game-challenge";

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
  const wordConfiguration =
    challenge?.gameType === "word-guess"
      ? challenge.configuration
      : DEFAULT_DAILY_GAME_CONFIGURATIONS["word-guess"];
  const answer = wordConfiguration.answer;
  const validWords = useMemo(
    () => new Set(wordConfiguration.validWords.map((word) => word.toUpperCase())),
    [wordConfiguration.validWords],
  );
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
  const [loadedProgressKey, setLoadedProgressKey] = useState("");
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

  const revealBoard = useCallback((guess: string) => {
    const evaluated = evaluateWordGuess(guess, answer);
    const nextBoard = board.map((row, rowIndex) => (rowIndex === currentRow ? [...guess.split("")] : row));
    const nextFeedback = feedback.map((row, rowIndex) => (rowIndex === currentRow ? [...evaluated] : row));
    setBoard(nextBoard);
    setFeedback(nextFeedback);
    const nextStatus = { ...status };
    for (let index = 0; index < evaluated.length; index += 1) {
      const letter = guess[index];
      const current = nextStatus[letter] ?? "absent";
      if (evaluated[index] === "correct" || (evaluated[index] === "present" && current !== "correct")) {
        nextStatus[letter] = evaluated[index];
      } else if (evaluated[index] === "absent" && current !== "correct" && current !== "present") {
        nextStatus[letter] = "absent";
      }
    }
    setStatus(nextStatus);

    if (guess === answer) {
      setHasWon(true);
      setGameOver(true);
      setMessage("You solved it! Great work.");
      return;
    }

    if (currentRow === MAX_ATTEMPTS - 1) {
      setGameOver(true);
      setMessage(`Out of attempts. The word was ${answer}.`);
      return;
    }

    const nextRow = currentRow + 1;
    setCurrentRow(nextRow);
    setCurrentColumn(0);
    setMessage("Keep going — you’ve got this.");
  }, [answer, board, currentRow, feedback, status]);

  const handleKeyPress = useCallback((key: string) => {
    if (gameOver) return;

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
      if (!validWords.has(guess)) {
        setMessage("That word is not in today’s word list.");
        return;
      }

      revealBoard(guess);
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
  }, [board, canSubmit, currentColumn, currentRow, gameOver, revealBoard, validWords]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        handleKeyPress("ENTER");
        return;
      }
      if (event.key === "Backspace") {
        handleKeyPress("⌫");
        return;
      }
      if (/^[a-z]$/i.test(event.key)) {
        handleKeyPress(event.key.toUpperCase());
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
      {!loading && !error ? (
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

        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          {boardRows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} style={{ display: "grid", gridTemplateColumns: `repeat(${WORD_LENGTH}, minmax(0, 1fr))`, gap: 8, width: "min(100%, 360px)" }}>
              {row.map((cell, columnIndex) => {
                const state = feedback[rowIndex]?.[columnIndex] ?? "absent";
                const hasLetter = Boolean(cell);
                const tone = state === "correct" ? "#16a34a" : state === "present" ? "#f59e0b" : hasLetter ? "#0f172a" : "#ffffff";
                return (
                  <div
                    key={`cell-${rowIndex}-${columnIndex}`}
                    aria-label={cell ? `Row ${rowIndex + 1}, Column ${columnIndex + 1}, ${cell}` : `Row ${rowIndex + 1}, Column ${columnIndex + 1}, empty`}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 14,
                      border: state === "correct" ? "1px solid #16a34a" : state === "present" ? "1px solid #f59e0b" : "1px solid rgba(148,163,184,0.35)",
                      background: tone,
                      color: state === "absent" && !hasLetter ? "#0f172a" : "#ffffff",
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

        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          <div style={{ display: "grid", gap: 8, width: "min(100%, 420px)" }}>
            {getKeyboardLayout().map((row, rowIndex) => (
              <div key={`keyboard-row-${rowIndex}`} style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                {row.map((key) => {
                  const state = status[key] ?? "absent";
                  const filled = key === "ENTER" || key === "⌫";
                  const background =
                    state === "correct"
                      ? "#16a34a"
                      : state === "present"
                        ? "#f59e0b"
                        : state === "absent" && !filled
                          ? "#e2e8f0"
                          : "#0f172a";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyPress(key)}
                      style={{
                        minWidth: key === "ENTER" || key === "⌫" ? 72 : 32,
                        minHeight: 46,
                        padding: "0 12px",
                        border: "none",
                        borderRadius: 12,
                        background,
                        color: filled || state !== "absent" ? "#ffffff" : "#0f172a",
                        fontWeight: 800,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
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

        <input ref={inputRef} aria-label="Word guess input" value="" readOnly style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
      </div>
      ) : null}
    </GameShell>
  );
}
