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
