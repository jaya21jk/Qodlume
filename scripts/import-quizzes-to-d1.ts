import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Quiz } from "../src/types/quiz";
import { validateQuizCollection } from "../src/lib/quiz-validator";

const mode = process.argv.includes("--remote") ? "--remote" : "--local";
const quizDirectory = resolve("content", "quizzes");
const entries = readdirSync(quizDirectory)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((fileName) => ({
    fileName,
    rawContent: JSON.parse(readFileSync(join(quizDirectory, fileName), "utf8")) as unknown,
  }));

const validation = validateQuizCollection(entries);
if (!validation.valid) {
  throw new Error(
    `Seed content validation failed: ${validation.collectionIssues.map((issue) => issue.message).join("; ")}`,
  );
}

function sql(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

function toUtc(value: string, field: string): string {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`Invalid ${field} timestamp in legacy quiz JSON: ${value}`);
  }
  return new Date(milliseconds).toISOString();
}

const statements: string[] = ["BEGIN TRANSACTION;"];
for (const entry of entries) {
  const quiz = validation.fileReports.find((report) => report.fileName === entry.fileName)?.parsedQuiz as Quiz | undefined;
  if (!quiz) throw new Error(`Validated quiz missing for ${entry.fileName}.`);
  const createdAt = toUtc(
    quiz.createdAt ?? quiz.updatedAt ?? new Date().toISOString(),
    "createdAt",
  );
  const updatedAt = toUtc(quiz.updatedAt ?? createdAt, "updatedAt");
  const publishedAt =
    (quiz.publishedAt ? toUtc(quiz.publishedAt, "publishedAt") : undefined) ??
    (quiz.status === "published" || quiz.status === "archived"
      ? `${quiz.publicationDate}T00:00:00.000Z`
      : null);
  const scheduledAt = quiz.scheduledAt
    ? toUtc(quiz.scheduledAt, "scheduledAt")
    : null;

  statements.push(
    `INSERT INTO quizzes (
      id, version, publication_date, timezone, status, title, description, topic, difficulty,
      estimated_duration_minutes, author, previous_version_id, scheduled_at, published_at,
      created_at, updated_at, created_by, validation_errors_json
    ) VALUES (
      ${sql(quiz.id)}, ${quiz.version}, ${sql(quiz.publicationDate)}, ${sql(quiz.timezone)},
      ${sql(quiz.status)}, ${sql(quiz.title)}, ${sql(quiz.description)}, ${sql(quiz.topic)},
      ${sql(quiz.difficulty)}, ${quiz.estimatedDurationMinutes}, ${sql(quiz.author ?? null)},
      ${sql(quiz.previousVersionId ?? null)}, ${sql(scheduledAt)},
      ${sql(publishedAt)}, ${sql(createdAt)}, ${sql(updatedAt)},
      ${sql(quiz.createdBy ?? quiz.author ?? "legacy-json-import")}, '[]'
    ) ON CONFLICT(id) DO NOTHING;`,
  );
  for (const [questionOrder, question] of quiz.questions.entries()) {
    statements.push(
      `INSERT INTO questions (
        id, quiz_id, question_text, question_type, sort_order, explanation, hint,
        code_snippet_json, references_json, tags_json, correct_option_id
      ) VALUES (
        ${sql(question.id)}, ${sql(quiz.id)}, ${sql(question.prompt)},
        ${sql(question.questionType ?? "single_choice")}, ${questionOrder},
        ${sql(question.explanation)}, ${sql(question.hint ?? null)},
        ${sql(question.codeSnippet ? JSON.stringify(question.codeSnippet) : null)},
        ${sql(question.references ? JSON.stringify(question.references) : null)},
        ${sql(question.tags ? JSON.stringify(question.tags) : null)},
        ${sql(question.correctOptionId)}
      ) ON CONFLICT(id) DO NOTHING;`,
    );
    for (const [optionOrder, option] of question.options.entries()) {
      statements.push(
        `INSERT INTO question_options (
          id, question_id, option_text, sort_order, is_correct, code
        ) VALUES (
          ${sql(option.id)}, ${sql(question.id)}, ${sql(option.text)},
          ${optionOrder}, ${option.id === question.correctOptionId ? 1 : 0},
          ${sql(option.code ?? null)}
        ) ON CONFLICT(question_id, id) DO NOTHING;`,
      );
    }
  }
}
statements.push("COMMIT;");

const tempFile = join(tmpdir(), `qodlume-seed-${Date.now()}.sql`);
const wranglerCli = resolve("node_modules", "wrangler", "bin", "wrangler.js");
writeFileSync(tempFile, statements.join("\n"), "utf8");
try {
  execFileSync(
    process.execPath,
    ["--no-warnings", wranglerCli, "d1", "execute", "qodlume", mode, "--file", tempFile],
    { stdio: "inherit" },
  );
  console.log(`Imported ${validation.totalFiles} validated quizzes into D1 (${mode}).`);
  console.log(
    `Published: ${validation.publishedCount}; draft: ${validation.draftCount}; validated: ${validation.validatedCount}; archived: ${validation.archivedCount}.`,
  );
} finally {
  rmSync(tempFile, { force: true });
}
