"use client";

import { useEffect, useState } from "react";
import type {
  PublicDailyGameChallenge,
  DailyGameType,
} from "../types/daily-game-challenge";

export function useDailyGameChallenge(gameType: DailyGameType): {
  challenge: PublicDailyGameChallenge | null;
  loading: boolean;
  error: string;
} {
  const [challenge, setChallenge] = useState<PublicDailyGameChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    void fetch(`/api/daily-game-challenges/${gameType}`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          challenge?: PublicDailyGameChallenge | null;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load the daily challenge.");
        }
        if (isCurrent) setChallenge(result.challenge ?? null);
      })
      .catch((fetchError: unknown) => {
        if (isCurrent) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load the daily challenge.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [gameType]);

  return { challenge, loading, error };
}
