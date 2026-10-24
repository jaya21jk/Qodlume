"use client";

import { GameShell } from "../../../components/game-shell";
import { ReactionTimeGame } from "../../../components/games/reaction-time-game";
import { useDailyGameChallenge } from "../../../lib/use-daily-game-challenge";
import { DEFAULT_DAILY_GAME_CONFIGURATIONS } from "../../../types/daily-game-challenge";

export default function ReactionTimePage() {
  const { challenge, loading, error } = useDailyGameChallenge("reaction-time");
  const configuration =
    challenge?.gameType === "reaction-time"
      ? challenge.configuration
      : DEFAULT_DAILY_GAME_CONFIGURATIONS["reaction-time"];

  return (
    <GameShell
      title={challenge?.title ?? "Reaction Time Challenge"}
      subtitle={challenge?.description ?? "Wait for the signal, react fast, and finish five fair attempts."}
    >
      {loading ? <p aria-live="polite">Loading today&apos;s challenge…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!loading && !error ? (
        <ReactionTimeGame
          configuration={configuration}
          publicationDate={challenge?.publicationDate}
        />
      ) : null}
    </GameShell>
  );
}
