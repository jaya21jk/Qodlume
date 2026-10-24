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

export function normalizeScheduledPublicationTime(
  publicationDate: string,
  timezone: string,
  value: string,
  now = Date.now(),
): { scheduledAt: string } | { error: string } {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return { error: "scheduledAt must include a UTC offset." };
  }
  const scheduledTime = Date.parse(value);
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
