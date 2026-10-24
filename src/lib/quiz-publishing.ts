import { validateQuizJsonString, validateQuizPublishingLimits } from "./quiz-validator";
import type { PublicationStatus, Quiz, ValidationReport } from "../types/quiz";

export function isQuizPublic(status: PublicationStatus): boolean {
  return status === "published";
}

export function canEditQuiz(status: PublicationStatus): boolean {
  return status === "draft" || status === "validated";
}

export function validateQuizForPublishing(quiz: Quiz): ValidationReport {
  const report = validateQuizJsonString(JSON.stringify({ ...quiz, status: "draft" }));
  if (report.parsedQuiz) {
    report.errors.push(...validateQuizPublishingLimits(report.parsedQuiz));
    report.valid = report.errors.length === 0;
  }
  return report;
}

export interface SeenQuizImportKeys {
  ids: Set<string>;
  publicationDates: Set<string>;
  questionIds: Set<string>;
}

export function findQuizImportBatchConflicts(
  quiz: Quiz,
  seen: SeenQuizImportKeys,
): string[] {
  const errors: string[] = [];
  if (seen.ids.has(quiz.id)) errors.push(`Duplicate quiz ID "${quiz.id}" in this import.`);
  if (seen.publicationDates.has(quiz.publicationDate)) {
    errors.push(`Duplicate publication date "${quiz.publicationDate}" in this import.`);
  }
  const duplicateQuestion = quiz.questions.find((question) =>
    seen.questionIds.has(question.id),
  );
  if (duplicateQuestion) {
    errors.push(`Question ID "${duplicateQuestion.id}" is duplicated within this import.`);
  }
  seen.ids.add(quiz.id);
  seen.publicationDates.add(quiz.publicationDate);
  quiz.questions.forEach((question) => seen.questionIds.add(question.id));
  return errors;
}

export function areQuizContentsEqual(left: Quiz, right: Quiz): boolean {
  const content = (quiz: Quiz) => ({
    id: quiz.id,
    version: quiz.version,
    publicationDate: quiz.publicationDate,
    timezone: quiz.timezone,
    title: quiz.title,
    description: quiz.description,
    topic: quiz.topic,
    difficulty: quiz.difficulty,
    estimatedDurationMinutes: quiz.estimatedDurationMinutes,
    author: quiz.author,
    previousVersionId: quiz.previousVersionId,
    questions: quiz.questions,
  });
  return stableJson(content(left)) === stableJson(content(right));
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function dateTimeLocalToUtc(
  value: string,
  timezone: string,
): { scheduledAt: string } | { error: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { error: "Choose a valid schedule date and time." };

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
  ].map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute);
  const requestedDate = new Date(desiredUtc);
  if (
    requestedDate.getUTCFullYear() !== year ||
    requestedDate.getUTCMonth() !== month - 1 ||
    requestedDate.getUTCDate() !== day ||
    requestedDate.getUTCHours() !== hour ||
    requestedDate.getUTCMinutes() !== minute
  ) {
    return { error: "Choose a valid schedule date and time." };
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    let timestamp = desiredUtc;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = Object.fromEntries(
        formatter
          .formatToParts(new Date(timestamp))
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)]),
      );
      const representedUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );
      const difference = desiredUtc - representedUtc;
      timestamp += difference;
      if (difference === 0) break;
    }

    const resolved = formatter.formatToParts(new Date(timestamp));
    const resolvedParts = Object.fromEntries(
      resolved
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    if (
      resolvedParts.year !== year ||
      resolvedParts.month !== month ||
      resolvedParts.day !== day ||
      resolvedParts.hour !== hour ||
      resolvedParts.minute !== minute
    ) {
      return { error: `That local time does not exist in ${timezone}.` };
    }
    return { scheduledAt: new Date(timestamp).toISOString() };
  } catch {
    return { error: `Quiz timezone "${timezone}" is invalid.` };
  }
}

export function dateTimeUtcToLocal(value: string, timezone: string): string | undefined {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return undefined;
  }
}

export function normalizeScheduledPublicationTime(
  publicationDate: string,
  timezone: string,
  value?: string,
  now = Date.now(),
): { scheduledAt: string } | { error: string } {
  const dateTime = value
    ? validateScheduledPublicationDate(publicationDate, timezone, value)
    : dateTimeLocalToUtc(`${publicationDate}T00:00`, timezone);
  if ("error" in dateTime) return dateTime;

  const scheduledTime = Date.parse(dateTime.scheduledAt);
  if (!Number.isFinite(scheduledTime) || scheduledTime <= now) {
    return { error: "scheduledAt must be a valid future timestamp." };
  }
  try {
    const scheduledDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(scheduledTime));
    if (scheduledDate !== publicationDate) {
      return {
        error: `Scheduled time must fall on ${publicationDate} in ${timezone}.`,
      };
    }
  } catch {
    return { error: `Quiz timezone "${timezone}" is invalid.` };
  }
  return { scheduledAt: new Date(scheduledTime).toISOString() };
}

export function validateScheduledPublicationDate(
  publicationDate: string,
  timezone: string,
  value: string,
): { scheduledAt: string } | { error: string } {
  const timestamp = parseExplicitTimestamp(value);
  if ("error" in timestamp) return timestamp;
  try {
    const scheduledDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp.scheduledAt));
    if (scheduledDate !== publicationDate) {
      return {
        error: `Scheduled time must fall on ${publicationDate} in ${timezone}.`,
      };
    }
  } catch {
    return { error: `Quiz timezone "${timezone}" is invalid.` };
  }
  return timestamp;
}

export function resolveImportPublication(
  mode: "draft" | "schedule",
  publicationDate: string,
  timezone: string,
  scheduledAt?: string,
  now = Date.now(),
): { status: "draft" } | { status: "scheduled"; scheduledAt: string } | { error: string } {
  if (mode === "draft") return { status: "draft" };
  const result = normalizeScheduledPublicationTime(
    publicationDate,
    timezone,
    scheduledAt,
    now,
  );
  return "error" in result
    ? result
    : { status: "scheduled", scheduledAt: result.scheduledAt };
}

function parseExplicitTimestamp(value: string): { scheduledAt: string } | { error: string } {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(
      value,
    );
  if (!match) return { error: "scheduledAt must be a valid ISO timestamp with a UTC offset." };
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    /[+-]14:(?!00)/.test(value)
  ) {
    return { error: "scheduledAt must be a valid ISO timestamp with a UTC offset." };
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return { error: "scheduledAt must be a valid ISO timestamp with a UTC offset." };
  }
  return { scheduledAt: new Date(timestamp).toISOString() };
}
