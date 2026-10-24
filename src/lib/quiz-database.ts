import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  PublicationStatus,
  Quiz,
  QuizQuestion,
  PublicQuiz,
  AdminQuizListItem,
  QuizSummary,
  ValidationIssue,
} from "../types/quiz";
import { isQuizPublic } from "./quiz-publishing";
import {
  isDailyChallengeAvailable,
  validateDailyGameChallenge,
} from "./daily-game-challenges";
import type {
  DailyGameChallenge,
  DailyGameStatus,
  DailyGameType,
} from "../types/daily-game-challenge";

interface QuizRow {
  id: string;
  version: number;
  publication_date: string;
  timezone: string;
  status: PublicationStatus;
  title: string;
  description: string;
  topic: Quiz["topic"];
  difficulty: Quiz["difficulty"];
  estimated_duration_minutes: number;
  author: string | null;
  previous_version_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  validation_errors_json: string;
}

interface QuestionRow {
  id: string;
  question_text: string;
  question_type: "single_choice";
  explanation: string;
  hint: string | null;
  correct_option_id: string;
  code_snippet_json: string | null;
  references_json: string | null;
  tags_json: string | null;
}

interface OptionRow {
  id: string;
  option_text: string;
  code: string | null;
  is_correct: number;
}

interface QuizSummaryRow extends QuizRow {
  question_count: number;
  question_ids_json: string;
}

interface DailyGameChallengeRow {
  id: string;
  publication_date: string;
  scheduled_at: string | null;
  timezone: string;
  status: DailyGameStatus;
  game_type: DailyGameType;
  title: string;
  description: string;
  configuration_json: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  created_by: string | null;
}

const QUIZ_COLUMNS = `
  quizzes.id, quizzes.version, quizzes.publication_date, quizzes.timezone, quizzes.status,
  quizzes.title, quizzes.description, quizzes.topic, quizzes.difficulty,
  quizzes.estimated_duration_minutes, quizzes.author, quizzes.previous_version_id,
  quizzes.scheduled_at, quizzes.published_at, quizzes.created_at, quizzes.updated_at,
  quizzes.created_by, quizzes.validation_errors_json
`;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error("Quiz database contains malformed JSON.", { cause: error });
  }
}

function assertSuccess(result: D1Result): void {
  if (!result.success) {
    throw new Error(result.error ?? "D1 query failed.");
  }
}

async function loadQuiz(db: D1Database, row: QuizRow): Promise<Quiz> {
  const questionResult = await db
    .prepare(
      `SELECT id, question_text, question_type, explanation, hint,
              correct_option_id, code_snippet_json, references_json, tags_json
       FROM questions WHERE quiz_id = ? ORDER BY sort_order`,
    )
    .bind(row.id)
    .all<QuestionRow>();
  assertSuccess(questionResult);

  const questions = await Promise.all(
    questionResult.results.map(async (question): Promise<QuizQuestion> => {
      const optionResult = await db
        .prepare(
          `SELECT id, option_text, code, is_correct FROM question_options
           WHERE question_id = ? ORDER BY sort_order`,
        )
        .bind(question.id)
        .all<OptionRow>();
      assertSuccess(optionResult);
      return {
        id: question.id,
        prompt: question.question_text,
        questionType: question.question_type,
        hint: question.hint ?? undefined,
        explanation: question.explanation,
        correctOptionId: question.correct_option_id,
        codeSnippet: parseJson(question.code_snippet_json, undefined),
        references: parseJson(question.references_json, undefined),
        tags: parseJson(question.tags_json, undefined),
        options: optionResult.results.map((option) => ({
          id: option.id,
          text: option.option_text,
          code: option.code ?? undefined,
        })),
      };
    }),
  );

  return {
    id: row.id,
    version: row.version,
    publicationDate: row.publication_date,
    timezone: row.timezone,
    status: row.status,
    title: row.title,
    description: row.description,
    topic: row.topic,
    difficulty: row.difficulty,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    author: row.author ?? undefined,
    previousVersionId: row.previous_version_id ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    validationErrors: parseJson<ValidationIssue[]>(row.validation_errors_json, []),
    questions,
  };
}

async function findQuiz(
  db: D1Database,
  query: string,
  value: string,
  includeHidden: boolean,
): Promise<Quiz | null> {
  const visibility = includeHidden ? "" : " AND status = 'published'";
  const result = await db
    .prepare(`SELECT ${QUIZ_COLUMNS} FROM quizzes WHERE ${query} = ?${visibility} LIMIT 1`)
    .bind(value)
    .first<QuizRow>();
  if (!result || (!includeHidden && !isQuizPublic(result.status))) return null;
  const quiz = await loadQuiz(db, result);
  return {
    ...quiz,
    scheduledAt: undefined,
    createdBy: undefined,
    validationErrors: undefined,
  };
}

export async function getQuizByDate(
  db: D1Database,
  publicationDate: string,
): Promise<PublicQuiz | null> {
  const quiz = await findQuiz(db, "publication_date", publicationDate, false);
  if (!quiz) return null;

  const { createdBy: _createdBy, validationErrors: _validationErrors, ...publicQuiz } = quiz;
  return {
    ...publicQuiz,
    questions: quiz.questions.map(({ correctOptionId: _correctOptionId, explanation: _explanation, ...question }) => question),
  };
}

export async function getQuizForGrading(
  db: D1Database,
  publicationDate: string,
): Promise<Quiz | null> {
  return findQuiz(db, "publication_date", publicationDate, false);
}

export async function getAdminQuizById(
  db: D1Database,
  id: string,
): Promise<Quiz | null> {
  return findQuiz(db, "id", id, true);
}

export async function listPublishedQuizzes(db: D1Database): Promise<Quiz[]> {
  const result = await db
    .prepare(
      `SELECT ${QUIZ_COLUMNS} FROM quizzes
       WHERE status = 'published'
       ORDER BY publication_date DESC LIMIT 500`,
    )
    .all<QuizRow>();
  assertSuccess(result);
  return Promise.all(result.results.map((row) => loadQuiz(db, row)));
}

function mapSummary(row: QuizSummaryRow): QuizSummary {
  return {
    id: row.id,
    version: row.version,
    publicationDate: row.publication_date,
    timezone: row.timezone,
    status: row.status,
    title: row.title,
    description: row.description,
    topic: row.topic,
    difficulty: row.difficulty,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    questionCount: row.question_count,
    questionIds: parseJson<string[]>(row.question_ids_json, []),
    updatedAt: row.updated_at,
  };
}

export async function listPublishedQuizSummaries(db: D1Database): Promise<QuizSummary[]> {
  const result = await db
    .prepare(
      `SELECT ${QUIZ_COLUMNS}, COUNT(questions.id) AS question_count,
              json_group_array(questions.id) FILTER (WHERE questions.id IS NOT NULL) AS question_ids_json
       FROM quizzes LEFT JOIN questions ON questions.quiz_id = quizzes.id
       WHERE quizzes.status = 'published'
       GROUP BY quizzes.id
       ORDER BY quizzes.publication_date DESC LIMIT 500`,
    )
    .all<QuizSummaryRow>();
  assertSuccess(result);
  return result.results.map(mapSummary);
}

export async function listAdminQuizzes(db: D1Database): Promise<AdminQuizListItem[]> {
  const result = await db
    .prepare(
      `SELECT ${QUIZ_COLUMNS}, COUNT(questions.id) AS question_count,
              json_group_array(questions.id) FILTER (WHERE questions.id IS NOT NULL) AS question_ids_json
       FROM quizzes LEFT JOIN questions ON questions.quiz_id = quizzes.id
       GROUP BY quizzes.id
       ORDER BY quizzes.updated_at DESC LIMIT 500`,
    )
    .all<QuizSummaryRow>();
  assertSuccess(result);
  return result.results.map((row) => ({
    ...mapSummary(row),
    questionCount: row.question_count,
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    updatedAt: row.updated_at,
    validationErrors: parseJson<ValidationIssue[]>(row.validation_errors_json, []),
  }));
}

export async function saveDraftQuiz(
  db: D1Database,
  quiz: Quiz,
  creator: string,
): Promise<void> {
  await writeDraftQuiz(db, quiz, creator, true);
}

export async function createDraftQuiz(
  db: D1Database,
  quiz: Quiz,
  creator: string,
): Promise<void> {
  await writeDraftQuiz(db, quiz, creator, false);
}

async function writeDraftQuiz(
  db: D1Database,
  quiz: Quiz,
  creator: string,
  allowOverwrite: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const safeQuiz: Quiz = { ...quiz, status: "draft", scheduledAt: undefined, publishedAt: undefined };
  const questionJson = JSON.stringify(
    safeQuiz.questions.map((question) => ({
      ...question,
      questionType: question.questionType ?? "single_choice",
    })),
  );
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO quizzes (
          id, version, publication_date, timezone, status, title, description, topic,
          difficulty, estimated_duration_minutes, author, previous_version_id,
          scheduled_at, published_at, created_at, updated_at, created_by
        ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
        ${allowOverwrite ? `ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          publication_date = excluded.publication_date,
          timezone = excluded.timezone,
          status = 'draft',
          title = excluded.title,
          description = excluded.description,
          topic = excluded.topic,
          difficulty = excluded.difficulty,
          estimated_duration_minutes = excluded.estimated_duration_minutes,
          author = excluded.author,
          previous_version_id = excluded.previous_version_id,
          scheduled_at = NULL,
          published_at = NULL,
          validation_errors_json = '[]',
          updated_at = excluded.updated_at` : ""}`,
      )
      .bind(
        safeQuiz.id,
        safeQuiz.version,
        safeQuiz.publicationDate,
        safeQuiz.timezone,
        safeQuiz.title,
        safeQuiz.description,
        safeQuiz.topic,
        safeQuiz.difficulty,
        safeQuiz.estimatedDurationMinutes,
        safeQuiz.author ?? null,
        safeQuiz.previousVersionId ?? null,
        now,
        now,
        creator,
      ),
    db.prepare("DELETE FROM questions WHERE quiz_id = ?").bind(safeQuiz.id),
    db
      .prepare(
        `INSERT INTO questions (
          id, quiz_id, question_text, question_type, sort_order, explanation, hint,
          code_snippet_json, references_json, tags_json, correct_option_id
        )
        SELECT
          json_extract(question.value, '$.id'),
          ?,
          json_extract(question.value, '$.prompt'),
          COALESCE(json_extract(question.value, '$.questionType'), 'single_choice'),
          CAST(question.key AS INTEGER),
          json_extract(question.value, '$.explanation'),
          json_extract(question.value, '$.hint'),
          json(json_extract(question.value, '$.codeSnippet')),
          json(json_extract(question.value, '$.references')),
          json(json_extract(question.value, '$.tags')),
          json_extract(question.value, '$.correctOptionId')
        FROM json_each(?) AS question`,
      )
      .bind(safeQuiz.id, questionJson),
    db
      .prepare(
        `INSERT INTO question_options (
          id, question_id, option_text, sort_order, is_correct, code
        )
        SELECT
          json_extract(option.value, '$.id'),
          json_extract(question.value, '$.id'),
          json_extract(option.value, '$.text'),
          CAST(option.key AS INTEGER),
          CASE WHEN json_extract(option.value, '$.id') =
                    json_extract(question.value, '$.correctOptionId') THEN 1 ELSE 0 END,
          json_extract(option.value, '$.code')
        FROM json_each(?) AS question,
             json_each(question.value, '$.options') AS option`,
      )
      .bind(questionJson),
  ]);
  results.forEach(assertSuccess);
}

export async function setQuizStatus(
  db: D1Database,
  id: string,
  status: PublicationStatus,
  options: { scheduledAt?: string; validationIssues?: ValidationIssue[] } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE quizzes
       SET status = ?,
           scheduled_at = ?,
           published_at = CASE
             WHEN ? = 'published' THEN COALESCE(published_at, ?)
             WHEN ? = 'draft' THEN NULL
             ELSE published_at
           END,
           validation_errors_json = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      status,
      options.scheduledAt ?? null,
      status,
      now,
      status,
      JSON.stringify(options.validationIssues ?? []),
      now,
      id,
    )
    .run();
  assertSuccess(result);
  if (result.meta.changes === 0) throw new Error("Quiz not found.");
}

export async function publishDueQuizzes(
  db: D1Database,
  now = new Date().toISOString(),
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE quizzes
       SET status = 'published', scheduled_at = NULL, published_at = ?, updated_at = ?
       WHERE status = 'scheduled' AND scheduled_at <= ?`,
    )
    .bind(now, now, now)
    .run();
  assertSuccess(result);
  return result.meta.changes;
}

function mapDailyGameChallenge(row: DailyGameChallengeRow): DailyGameChallenge {
  const parsed = validateDailyGameChallenge({
    id: row.id,
    publicationDate: row.publication_date,
    scheduledAt: row.scheduled_at ?? undefined,
    timezone: row.timezone,
    status: row.status,
    gameType: row.game_type,
    title: row.title,
    description: row.description,
    configuration: parseJson(row.configuration_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
  });
  if (!parsed.valid || !parsed.challenge) {
    throw new Error(`Daily game challenge "${row.id}" contains invalid content: ${parsed.errors.join(" ")}`);
  }
  return parsed.challenge;
}

export async function listAdminDailyGameChallenges(
  db: D1Database,
): Promise<DailyGameChallenge[]> {
  const result = await db
    .prepare(
      `SELECT id, publication_date, scheduled_at, timezone, status, game_type,
              title, description, configuration_json, created_at, updated_at, published_at, created_by
       FROM daily_game_challenges
       ORDER BY publication_date DESC, game_type LIMIT 500`,
    )
    .all<DailyGameChallengeRow>();
  assertSuccess(result);
  return result.results.map(mapDailyGameChallenge);
}

export async function getAdminDailyGameChallenge(
  db: D1Database,
  id: string,
): Promise<DailyGameChallenge | null> {
  const result = await db
    .prepare(
      `SELECT id, publication_date, scheduled_at, timezone, status, game_type,
              title, description, configuration_json, created_at, updated_at, published_at, created_by
       FROM daily_game_challenges WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<DailyGameChallengeRow>();
  return result ? mapDailyGameChallenge(result) : null;
}

export async function getCurrentDailyGameChallenge(
  db: D1Database,
  gameType: DailyGameType,
  now = new Date(),
): Promise<DailyGameChallenge | null> {
  const result = await db
    .prepare(
      `SELECT id, publication_date, scheduled_at, timezone, status, game_type,
              title, description, configuration_json, created_at, updated_at, published_at, created_by
       FROM daily_game_challenges
       WHERE game_type = ? AND status IN ('published', 'scheduled')
       ORDER BY publication_date DESC LIMIT 100`,
    )
    .bind(gameType)
    .all<DailyGameChallengeRow>();
  assertSuccess(result);

  for (const row of result.results) {
    const challenge = mapDailyGameChallenge(row);
    if (isDailyChallengeAvailable(challenge, now)) {
      return challenge;
    }
  }
  return null;
}

export async function createDailyGameChallengeDraft(
  db: D1Database,
  challenge: DailyGameChallenge,
  creator: string,
): Promise<DailyGameChallenge> {
  const now = new Date().toISOString();
  const id = `${challenge.gameType}-${challenge.publicationDate}`;
  const result = await db
    .prepare(
      `INSERT INTO daily_game_challenges (
        id, publication_date, scheduled_at, timezone, status, game_type, title,
        description, configuration_json, created_at, updated_at, published_at, created_by
      ) VALUES (?, ?, NULL, ?, 'draft', ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .bind(
      id,
      challenge.publicationDate,
      challenge.timezone,
      challenge.gameType,
      challenge.title,
      challenge.description,
      JSON.stringify(challenge.configuration),
      now,
      now,
      creator,
    )
    .run();
  assertSuccess(result);
  const saved = await getAdminDailyGameChallenge(db, id);
  if (!saved) throw new Error("Created daily game challenge could not be read back.");
  return saved;
}

export async function updateDailyGameChallengeDraft(
  db: D1Database,
  challenge: DailyGameChallenge,
): Promise<DailyGameChallenge> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE daily_game_challenges
       SET timezone = ?, title = ?, description = ?, configuration_json = ?,
           scheduled_at = NULL, status = 'draft', updated_at = ?
       WHERE id = ? AND status IN ('draft', 'unpublished')`,
    )
    .bind(
      challenge.timezone,
      challenge.title,
      challenge.description,
      JSON.stringify(challenge.configuration),
      now,
      challenge.id,
    )
    .run();
  assertSuccess(result);
  if (result.meta.changes === 0) {
    const existing = await getAdminDailyGameChallenge(db, challenge.id);
    if (!existing) throw new Error("Daily game challenge not found.");
    throw new Error("Only draft or unpublished daily game challenges can be edited.");
  }
  const saved = await getAdminDailyGameChallenge(db, challenge.id);
  if (!saved) throw new Error("Updated daily game challenge could not be read back.");
  return saved;
}

export async function setDailyGameChallengeStatus(
  db: D1Database,
  id: string,
  status: DailyGameStatus,
  scheduledAt?: string,
): Promise<DailyGameChallenge> {
  const now = new Date().toISOString();
  const allowedSourceStatuses =
    status === "published" || status === "scheduled"
      ? "('draft', 'unpublished')"
      : status === "unpublished"
        ? "('published', 'scheduled')"
        : "('draft', 'unpublished', 'scheduled', 'published')";
  const result = await db
    .prepare(
      `UPDATE daily_game_challenges
       SET status = ?, scheduled_at = ?,
           published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
           updated_at = ?
       WHERE id = ? AND status IN ${allowedSourceStatuses}`,
    )
    .bind(
      status,
      status === "scheduled" ? scheduledAt ?? null : null,
      status,
      now,
      now,
      id,
    )
    .run();
  assertSuccess(result);
  if (result.meta.changes === 0) {
    const existing = await getAdminDailyGameChallenge(db, id);
    if (!existing) throw new Error("Daily game challenge not found.");
    throw new Error(`Cannot change a ${existing.status} challenge to ${status}.`);
  }
  const updated = await getAdminDailyGameChallenge(db, id);
  if (!updated) throw new Error("Updated daily game challenge could not be read back.");
  return updated;
}

export async function publishDueDailyGameChallenges(
  db: D1Database,
  now = new Date().toISOString(),
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE daily_game_challenges
       SET status = 'published', scheduled_at = NULL,
           published_at = COALESCE(published_at, ?), updated_at = ?
       WHERE status = 'scheduled' AND scheduled_at <= ?`,
    )
    .bind(now, now, now)
    .run();
  assertSuccess(result);
  return result.meta.changes;
}
export async function getDatabase(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) throw new Error("Cloudflare D1 binding 'DB' is not configured.");
  return env.DB;
}
