"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
      typeof progress.message === "string"
    ) {
      setBoard(progress.board);
      setFeedback(progress.feedback);
      setCurrentRow(progress.currentRow);
      setCurrentColumn(progress.currentColumn);
      setHasWon(progress.hasWon);
      setGameOver(progress.gameOver);
      setMessage(progress.message);
    } else {
      setBoard(Array.from({ length: MAX_ATTEMPTS }, () => [...EMPTY_ROW]));
      setFeedback(Array.from({ length: MAX_ATTEMPTS }, () => Array(WORD_LENGTH).fill("absent")));
      setCurrentRow(0);
      setCurrentColumn(0);
      setHasWon(false);
      setGameOver(false);
      setMessage("Type a five-letter word and press Enter.");
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
  ]);

  const canSubmit = currentColumn === WORD_LENGTH && !gameOver;
  const currentGuess = board[currentRow]?.join("") ?? "";

  const updateCurrentGuess = (value: string) => {
    if (gameOver || submitting) return;
    const guess = value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, WORD_LENGTH);
    setBoard((current) =>
      current.map((row, rowIndex) =>
        rowIndex === currentRow
          ? [...guess, ...Array(WORD_LENGTH - guess.length).fill("")]
          : row,
      ),
    );
    setCurrentColumn(guess.length);
    setMessage(
      guess.length === WORD_LENGTH
        ? "Ready to check your guess."
        : "Type a five-letter word and press Enter.",
    );
  };

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
  }, [board, currentRow, feedback]);

  const restartGame = useCallback(() => {
    setBoard(Array.from({ length: MAX_ATTEMPTS }, () => [...EMPTY_ROW]));
    setFeedback(Array.from({ length: MAX_ATTEMPTS }, () => Array(WORD_LENGTH).fill("absent")));
    setCurrentRow(0);
    setCurrentColumn(0);
    setHasWon(false);
    setGameOver(false);
    setMessage("Type a five-letter word and press Enter.");
    inputRef.current?.focus();
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
      <div className="word-guess-game">
        {hasWon ? (
          <section className="word-win-celebration" role="status" aria-live="polite">
            <span className="win-confetti confetti-one" aria-hidden="true">✦</span>
            <span className="win-confetti confetti-two" aria-hidden="true">◆</span>
            <span className="win-confetti confetti-three" aria-hidden="true">✦</span>
            <span className="win-confetti confetti-four" aria-hidden="true">●</span>
            <p className="win-overline">Daily word solved</p>
            <div className="win-emblem" aria-hidden="true">🥳</div>
            <h2>Congratulations!</h2>
            <p className="win-message">You guessed the word!</p>
            <div className="win-word" aria-label={`Solved word: ${board[currentRow].join("")}`}>
              {board[currentRow].map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
            </div>
            <p className="win-attempts">
              Solved in {currentRow + 1} {currentRow === 0 ? "guess" : "guesses"}
            </p>
          </section>
        ) : null}

        <div
          className="word-guess-message"
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

        <form
          className="word-guess-board-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              setMessage("Enter all five letters before checking your guess.");
              inputRef.current?.focus();
              return;
            }
            void revealBoard(currentGuess);
          }}
        >
        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          {board.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className={rowIndex === currentRow && !gameOver ? "word-guess-active-row" : undefined}
              style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${WORD_LENGTH}, minmax(0, 1fr))`, gap: 8, width: "min(100%, 360px)" }}
            >
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
                      fontSize: "clamp(1rem, 5vw, 1.8rem)",
                      textTransform: "uppercase",
                    }}
                  >
                    {cell}
                  </div>
                );
              })}
              {rowIndex === currentRow && !gameOver ? (
                <input
                  ref={inputRef}
                  className="word-guess-board-input"
                  type="text"
                  value={currentGuess}
                  onChange={(event) => updateCurrentGuess(event.target.value)}
                  maxLength={WORD_LENGTH}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  enterKeyHint="go"
                  disabled={submitting || !challenge}
                  aria-label="Type your five-letter guess in the highlighted row"
                  aria-describedby="word-guess-input-help"
                />
              ) : null}
            </div>
          ))}
        </div>
        {!gameOver ? (
          <>
            <p id="word-guess-input-help" className="word-guess-board-help">
              Tap the highlighted row to type. Press Enter or use the button to submit.
            </p>
            <button
              className="word-guess-submit"
              type="submit"
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Checking…" : "Submit guess"}
            </button>
          </>
        ) : null}
        </form>

        <div className="word-guess-color-guide" aria-label="Guess color guide">
          <span><i className="guide-correct" />Correct letter and position</span>
          <span><i className="guide-present" />Correct letter, different position</span>
          <span><i className="guide-absent" />Letter not in the word</span>
        </div>

        <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
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

      </div>
      ) : null}
    </GameShell>
  );
}
