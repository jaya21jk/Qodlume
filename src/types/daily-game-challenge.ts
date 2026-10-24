export const DAILY_GAME_TYPES = [
  "reaction-time",
  "word-guess",
  "memory-match",
] as const;

export type DailyGameType = (typeof DAILY_GAME_TYPES)[number];
export type DailyGameStatus = "draft" | "scheduled" | "published" | "unpublished";

export interface ReactionTimeConfiguration {
  attempts: number;
  minimumDelayMs: number;
  maximumDelayMs: number;
}

export interface WordGuessConfiguration {
  answer: string;
  validWords: string[];
  attempts: number;
}

export interface MemoryMatchConfiguration {
  pairs: 6 | 8 | 12;
  emojis: string[];
}

export type DailyGameConfiguration =
  | ReactionTimeConfiguration
  | WordGuessConfiguration
  | MemoryMatchConfiguration;

export interface DailyGameConfigurationByType {
  "reaction-time": ReactionTimeConfiguration;
  "word-guess": WordGuessConfiguration;
  "memory-match": MemoryMatchConfiguration;
}

interface DailyGameChallengeBase {
  id: string;
  publicationDate: string;
  scheduledAt?: string;
  timezone: string;
  status: DailyGameStatus;
  title: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export type DailyGameChallenge = {
  [GameType in DailyGameType]: DailyGameChallengeBase & {
    gameType: GameType;
    configuration: DailyGameConfigurationByType[GameType];
  };
}[DailyGameType];

export type PublicDailyGameChallenge = {
  [GameType in DailyGameType]: Omit<
    Extract<DailyGameChallenge, { gameType: GameType }>,
    "configuration"
  > & {
    configuration: GameType extends "word-guess"
      ? Pick<WordGuessConfiguration, "attempts">
      : DailyGameConfigurationByType[GameType];
  };
}[DailyGameType];

export interface DailyGameValidationResult {
  valid: boolean;
  errors: string[];
  challenge?: DailyGameChallenge;
}

export const DEFAULT_DAILY_GAME_CONFIGURATIONS: DailyGameConfigurationByType = {
  "reaction-time": {
    attempts: 5,
    minimumDelayMs: 1200,
    maximumDelayMs: 3400,
  },
  "word-guess": {
    answer: "",
    validWords: [],
    attempts: 6,
  },
  "memory-match": {
    pairs: 6,
    emojis: ["🍉", "🍋", "🍇", "🍒", "🍊", "🍓", "🍍", "🥝", "🍏", "🍎", "🍐", "🍑"],
  },
};
