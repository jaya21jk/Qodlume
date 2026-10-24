import { DEFAULT_PUBLICATION_TIMEZONE } from "../types/quiz";
import {
  DAILY_GAME_TYPES,
  type DailyGameChallenge,
  type DailyGameConfiguration,
  type DailyGameStatus,
  type DailyGameType,
  type DailyGameValidationResult,
  type MemoryMatchConfiguration,
  type PublicDailyGameChallenge,
  type ReactionTimeConfiguration,
  type WordGuessConfiguration,
} from "../types/daily-game-challenge";
import { isValidCalendarDate } from "./quiz-validator";

const CHALLENGE_STATUSES: DailyGameStatus[] = [
  "draft",
  "scheduled",
  "published",
  "unpublished",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function parseConfiguration(
  gameType: DailyGameType,
  value: unknown,
  errors: string[],
): DailyGameConfiguration | undefined {
  if (!isRecord(value)) {
    errors.push("configuration must be an object.");
    return undefined;
  }

  if (gameType === "reaction-time") {
    rejectUnknownKeys(
      value,
      ["attempts", "minimumDelayMs", "maximumDelayMs"],
      "reaction-time configuration",
      errors,
    );
    const configuration = value as Partial<ReactionTimeConfiguration>;
    if (
      !Number.isInteger(configuration.attempts) ||
      (configuration.attempts ?? 0) < 1 ||
      (configuration.attempts ?? 0) > 20
    ) {
      errors.push("reaction-time configuration.attempts must be an integer from 1 to 20.");
    }
    if (
      !Number.isInteger(configuration.minimumDelayMs) ||
      (configuration.minimumDelayMs ?? -1) < 300
    ) {
      errors.push("reaction-time configuration.minimumDelayMs must be at least 300.");
    }
    if (
      !Number.isInteger(configuration.maximumDelayMs) ||
      (configuration.maximumDelayMs ?? -1) < (configuration.minimumDelayMs ?? 0) ||
      (configuration.maximumDelayMs ?? 0) > 10000
    ) {
      errors.push("reaction-time configuration.maximumDelayMs must be at least minimumDelayMs and no more than 10000.");
    }
    return configuration as ReactionTimeConfiguration;
  }

  if (gameType === "word-guess") {
    rejectUnknownKeys(
      value,
      ["answer", "validWords", "attempts"],
      "word-guess configuration",
      errors,
    );
    const configuration = value as Partial<WordGuessConfiguration>;
    const answer =
      typeof configuration.answer === "string"
        ? configuration.answer.trim().toUpperCase()
        : "";
    const words = configuration.validWords;
    if (!/^[A-Z]{5}$/.test(answer)) {
      errors.push("word-guess configuration.answer must be exactly five letters.");
    }
    if (
      !Array.isArray(words) ||
      words.length < 1 ||
      words.length > 5000 ||
      words.some((word) => typeof word !== "string" || !/^[A-Za-z]{5}$/.test(word))
    ) {
      errors.push("word-guess configuration.validWords must contain at most 5000 five-letter words.");
    } else if (new Set(words.map((word) => word.toUpperCase())).size !== words.length) {
      errors.push("word-guess configuration.validWords must not contain duplicates.");
    } else if (!words.some((word) => word.toUpperCase() === answer)) {
      errors.push("word-guess configuration.validWords must include the answer.");
    }
    if (
      !Number.isInteger(configuration.attempts) ||
      configuration.attempts !== 6
    ) {
      errors.push("word-guess configuration.attempts must be 6.");
    }
    return {
      answer,
      validWords: Array.isArray(words)
        ? words.map((word) => String(word).toUpperCase())
        : [],
      attempts: configuration.attempts as number,
    };
  }

  rejectUnknownKeys(value, ["pairs", "emojis"], "memory-match configuration", errors);
  const configuration = value as Partial<MemoryMatchConfiguration>;
  if (![6, 8, 12].includes(configuration.pairs as number)) {
    errors.push("memory-match configuration.pairs must be 6, 8, or 12.");
  }
  if (
    !Array.isArray(configuration.emojis) ||
    configuration.emojis.length !== configuration.pairs ||
    configuration.emojis.some((emoji) => typeof emoji !== "string" || emoji.trim().length === 0) ||
    new Set(configuration.emojis).size !== configuration.emojis.length
  ) {
    errors.push("memory-match configuration.emojis must contain one unique non-empty emoji per pair.");
  }
  return configuration as MemoryMatchConfiguration;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: string[],
  field: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push(`${field}.${key} is not supported.`);
  }
}

export function validateDailyGameChallenge(
  value: unknown,
): DailyGameValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["challenge must be an object."] };
  }
  rejectUnknownKeys(
    value,
    [
      "id",
      "publicationDate",
      "scheduledAt",
      "timezone",
      "status",
      "gameType",
      "title",
      "description",
      "configuration",
      "createdAt",
      "updatedAt",
      "publishedAt",
    ],
    "challenge",
    errors,
  );

  const gameType = value.gameType;
  if (
    typeof gameType !== "string" ||
    !DAILY_GAME_TYPES.includes(gameType as DailyGameType)
  ) {
    errors.push("gameType must be reaction-time, word-guess, or memory-match.");
  }
  const typedGameType = gameType as DailyGameType;

  if (typeof value.publicationDate !== "string" || !isValidCalendarDate(value.publicationDate)) {
    errors.push("publicationDate must be a valid YYYY-MM-DD date.");
  }
  const timezone =
    typeof value.timezone === "string" && value.timezone.trim()
      ? value.timezone
      : DEFAULT_PUBLICATION_TIMEZONE;
  if (!isValidTimezone(timezone)) {
    errors.push(`timezone "${timezone}" is invalid.`);
  }
  if (
    typeof value.status !== "string" ||
    !CHALLENGE_STATUSES.includes(value.status as DailyGameStatus)
  ) {
    errors.push("status must be draft, scheduled, published, or unpublished.");
  }
  if (typeof value.title !== "string" || !value.title.trim()) {
    errors.push("title is required.");
  }
  if (typeof value.description !== "string" || !value.description.trim()) {
    errors.push("description is required.");
  }

  let scheduledAt: string | undefined;
  if (value.scheduledAt !== undefined && value.scheduledAt !== null && value.scheduledAt !== "") {
    if (
      typeof value.scheduledAt !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(value.scheduledAt) ||
      !Number.isFinite(Date.parse(value.scheduledAt))
    ) {
      errors.push("scheduledAt must be an ISO timestamp with a UTC offset.");
    } else {
      scheduledAt = new Date(value.scheduledAt).toISOString();
    }
  }
  if (value.status === "scheduled" && !scheduledAt) {
    errors.push("scheduledAt is required when status is scheduled.");
  }

  let configuration: DailyGameConfiguration | undefined;
  if (DAILY_GAME_TYPES.includes(typedGameType)) {
    configuration = parseConfiguration(typedGameType, value.configuration, errors);
  }

  if (errors.length > 0 || !configuration) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors,
    challenge: {
      id: typeof value.id === "string" ? value.id : "",
      publicationDate: value.publicationDate as string,
      scheduledAt,
      timezone,
      status: value.status as DailyGameStatus,
      gameType: typedGameType,
      title: (value.title as string).trim(),
      description: (value.description as string).trim(),
      configuration,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
      publishedAt: typeof value.publishedAt === "string" ? value.publishedAt : undefined,
    } as DailyGameChallenge,
  };
}

export function validateDailySchedule(
  publicationDate: string,
  timezone: string,
  scheduledAt: string,
  now: Date = new Date(),
): { scheduledAt: string } | { error: string } {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(scheduledAt)) {
    return { error: "scheduledAt must include a UTC offset." };
  }
  const timestamp = Date.parse(scheduledAt);
  if (!Number.isFinite(timestamp) || timestamp <= now.getTime()) {
    return { error: "scheduledAt must be a valid future timestamp." };
  }
  try {
    if (getDateInTimezone(new Date(timestamp), timezone) !== publicationDate) {
      return { error: `Scheduled time must fall on ${publicationDate} in ${timezone}.` };
    }
  } catch {
    return { error: `Timezone "${timezone}" is invalid.` };
  }
  return { scheduledAt: new Date(timestamp).toISOString() };
}

export function isDailyChallengeAvailable(
  challenge: Pick<
    DailyGameChallenge,
    "publicationDate" | "scheduledAt" | "timezone" | "status"
  >,
  now: Date,
): boolean {
  if (getDateInTimezone(now, challenge.timezone) !== challenge.publicationDate) {
    return false;
  }
  return (
    challenge.status === "published" ||
    (challenge.status === "scheduled" &&
      Boolean(challenge.scheduledAt) &&
      Date.parse(challenge.scheduledAt ?? "") <= now.getTime())
  );
}

export function toPublicDailyGameChallenge(
  challenge: DailyGameChallenge | null,
): PublicDailyGameChallenge | null {
  if (!challenge) return null;
  if (challenge.gameType === "word-guess") {
    return {
      ...challenge,
      configuration: { attempts: challenge.configuration.attempts },
    };
  }
  return challenge;
}
