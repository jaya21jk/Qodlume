export type GuessFeedback = "correct" | "present" | "absent";

export function evaluateWordGuess(guess: string, answer: string): GuessFeedback[] {
  const normalizedGuess = guess.toUpperCase();
  const normalizedAnswer = answer.toUpperCase();
  const result: GuessFeedback[] = Array(normalizedGuess.length).fill("absent");
  const remainingCounts = new Map<string, number>();

  for (let index = 0; index < normalizedAnswer.length; index += 1) {
    const letter = normalizedAnswer[index];
    remainingCounts.set(letter, (remainingCounts.get(letter) ?? 0) + 1);
  }

  for (let index = 0; index < normalizedGuess.length; index += 1) {
    if (normalizedGuess[index] === normalizedAnswer[index]) {
      result[index] = "correct";
      remainingCounts.set(normalizedGuess[index], (remainingCounts.get(normalizedGuess[index]) ?? 0) - 1);
    }
  }

  for (let index = 0; index < normalizedGuess.length; index += 1) {
    if (result[index] === "correct") {
      continue;
    }

    const letter = normalizedGuess[index];
    const remaining = remainingCounts.get(letter) ?? 0;
    if (remaining > 0) {
      result[index] = "present";
      remainingCounts.set(letter, remaining - 1);
    }
  }

  return result;
}

export function calculateReactionStats(values: number[]): { average: number; best: number; count: number } {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (validValues.length === 0) {
    return { average: 0, best: 0, count: 0 };
  }

  const average = Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
  const best = Math.min(...validValues);

  return { average, best, count: validValues.length };
}

export function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function getShareResultText(gameName: string, scoreText: string, url?: string): string {
  const gameUrl = url ? ` ${url}` : "";
  return `${gameName}: ${scoreText}${gameUrl}`;
}

export function safeReadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeWriteStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can fail in private browsing mode or when quota is exceeded.
  }
}
