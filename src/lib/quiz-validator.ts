import {
  DEFAULT_PUBLICATION_TIMEZONE,
  PUBLICATION_STATUSES,
  QUIZ_DIFFICULTIES,
  QUIZ_TOPICS,
  type CodeSnippet,
  type CollectionValidationReport,
  type LearningReference,
  type OverwriteConflictInfo,
  type PublicationStatus,
  type Quiz,
  type QuizDifficulty,
  type QuizOption,
  type QuizQuestion,
  type QuizTopic,
  type ValidationIssue,
  type ValidationReport,
} from '../types/quiz';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function pushIssue(
  issues: ValidationIssue[],
  code: string,
  severity: ValidationIssue['severity'],
  message: string,
  extra?: { fileName?: string; quizId?: string; questionId?: string; field?: string }
): void {
  issues.push({
    code,
    severity,
    message,
    fileName: extra?.fileName,
    quizId: extra?.quizId,
    questionId: extra?.questionId,
    field: extra?.field,
  });
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateCodeSnippet(
  rawSnippet: unknown,
  quizId: string | undefined,
  qRef: string,
  fileName: string | undefined,
  pushError: (issue: ValidationIssue) => void
): CodeSnippet | undefined {
  if (rawSnippet === undefined || rawSnippet === null) return undefined;
  if (!isRecord(rawSnippet)) {
    pushError({
      code: 'MALFORMED_CODE_SNIPPET',
      severity: 'error',
      message: `Question "${qRef}" has a malformed "codeSnippet" object.`,
      fileName,
      quizId,
      questionId: qRef,
      field: 'codeSnippet',
    });
    return undefined;
  }

  const hasLang = isNonEmptyString(rawSnippet.language);
  const hasCode = isNonEmptyString(rawSnippet.code);
  if (!hasLang || !hasCode) {
    pushError({
      code: 'INVALID_CODE_SNIPPET_FIELDS',
      severity: 'error',
      message: `Question "${qRef}" codeSnippet must include non-empty "language" and "code" strings.`,
      fileName,
      quizId,
      questionId: qRef,
      field: 'codeSnippet',
    });
  }

  if (
    rawSnippet.highlightLines !== undefined &&
    (!Array.isArray(rawSnippet.highlightLines) ||
      rawSnippet.highlightLines.some((line) => typeof line !== 'number' || !Number.isInteger(line) || line < 1))
  ) {
    pushError({
      code: 'INVALID_CODE_SNIPPET_HIGHLIGHTS',
      severity: 'error',
      message: `Question "${qRef}" codeSnippet.highlightLines must be an array of positive integers.`,
      fileName,
      quizId,
      questionId: qRef,
      field: 'codeSnippet.highlightLines',
    });
  }

  if (!hasLang || !hasCode) return undefined;
  return {
    language: (rawSnippet.language as string).trim(),
    code: rawSnippet.code as string,
    filename: isNonEmptyString(rawSnippet.filename) ? rawSnippet.filename.trim() : undefined,
    highlightLines: Array.isArray(rawSnippet.highlightLines)
      ? (rawSnippet.highlightLines as number[])
      : undefined,
  };
}

function validateReferences(
  rawReferences: unknown,
  quizId: string | undefined,
  questionId: string | undefined,
  fileName: string | undefined,
  pushError: (issue: ValidationIssue) => void
): LearningReference[] | undefined {
  if (rawReferences === undefined || rawReferences === null) return undefined;
  if (!Array.isArray(rawReferences)) {
    pushError({
      code: 'INVALID_REFERENCES',
      severity: 'error',
      message: `Question "${questionId ?? 'unknown'}" references must be an array of objects.`,
      fileName,
      quizId,
      questionId,
      field: 'references',
    });
    return undefined;
  }

  const refs: LearningReference[] = [];
  for (const ref of rawReferences) {
    if (!isRecord(ref)) {
      pushError({
        code: 'INVALID_REFERENCE_OBJECT',
        severity: 'error',
        message: `Question "${questionId ?? 'unknown'}" has a malformed learning reference entry.`,
        fileName,
        quizId,
        questionId,
        field: 'references',
      });
      continue;
    }

    if (!isNonEmptyString(ref.title) || !isNonEmptyString(ref.url)) {
      pushError({
        code: 'INVALID_REFERENCE_FIELDS',
        severity: 'error',
        message: `Question "${questionId ?? 'unknown'}" references must include non-empty title and url values.`,
        fileName,
        quizId,
        questionId,
        field: 'references',
      });
      continue;
    }

    refs.push({
      title: String(ref.title).trim(),
      url: String(ref.url).trim(),
      type: typeof ref.type === 'string' && ['documentation', 'article', 'video', 'spec'].includes(ref.type)
        ? (ref.type as LearningReference['type'])
        : undefined,
    });
  }

  return refs;
}

function validateQuestionObject(
  rawQuestion: unknown,
  quizId: string | undefined,
  quizFileName: string | undefined,
  seenQuestionIds: Set<string>,
  pushError: (issue: ValidationIssue) => void
): QuizQuestion | undefined {
  if (!isRecord(rawQuestion)) {
    pushError({
      code: 'INVALID_QUESTION_OBJECT',
      severity: 'error',
      message: 'A question entry is not a valid object.',
      fileName: quizFileName,
      quizId,
      questionId: undefined,
      field: 'questions',
    });
    return undefined;
  }

  const questionId = isNonEmptyString(rawQuestion.id) ? rawQuestion.id.trim() : undefined;
  if (!questionId) {
    pushError({
      code: 'MISSING_QUESTION_ID',
      severity: 'error',
      message: 'Each question must include a non-empty "id" field.',
      fileName: quizFileName,
      quizId,
      questionId: undefined,
      field: 'questions.id',
    });
    return undefined;
  }

  if (seenQuestionIds.has(questionId)) {
    pushError({
      code: 'DUPLICATE_QUESTION_ID',
      severity: 'error',
      message: `Question ID "${questionId}" is duplicated within the quiz or across the collection.`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.id',
    });
  } else {
    seenQuestionIds.add(questionId);
  }

  const prompt = isNonEmptyString(rawQuestion.prompt) ? rawQuestion.prompt.trim() : undefined;
  if (!prompt) {
    pushError({
      code: 'MISSING_QUESTION_PROMPT',
      severity: 'error',
      message: `Question "${questionId}" must include a non-empty "prompt".`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.prompt',
    });
  }

  if (!Array.isArray(rawQuestion.options)) {
    pushError({
      code: 'INVALID_OPTIONS',
      severity: 'error',
      message: `Question "${questionId}" must include an "options" array.`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.options',
    });
    return undefined;
  }

  const optionSeen = new Set<string>();
  const options: QuizOption[] = [];
  for (const option of rawQuestion.options) {
    if (!isRecord(option)) {
      pushError({
        code: 'INVALID_OPTION_OBJECT',
        severity: 'error',
        message: `Question "${questionId}" contains a malformed answer option.`,
        fileName: quizFileName,
        quizId,
        questionId,
        field: 'questions.options',
      });
      continue;
    }

    const optionId = isNonEmptyString(option.id) ? option.id.trim() : undefined;
    const optionText = isNonEmptyString(option.text) ? option.text.trim() : undefined;
    if (!optionId || !optionText) {
      pushError({
        code: 'INVALID_OPTION_FIELDS',
        severity: 'error',
        message: `Question "${questionId}" option entries require non-empty "id" and "text" values.`,
        fileName: quizFileName,
        quizId,
        questionId,
        field: 'questions.options',
      });
      continue;
    }

    if (optionSeen.has(optionId)) {
      pushError({
        code: 'DUPLICATE_OPTION_ID',
        severity: 'error',
        message: `Question "${questionId}" contains duplicate option ID "${optionId}".`,
        fileName: quizFileName,
        quizId,
        questionId,
        field: 'questions.options.id',
      });
    }
    optionSeen.add(optionId);

    options.push({
      id: optionId,
      text: optionText,
      code: isNonEmptyString(option.code) ? String(option.code).trim() : undefined,
    });
  }

  const correctOptionId = isNonEmptyString(rawQuestion.correctOptionId)
    ? rawQuestion.correctOptionId.trim()
    : undefined;
  if (!correctOptionId) {
    pushError({
      code: 'MISSING_CORRECT_OPTION_ID',
      severity: 'error',
      message: `Question "${questionId}" must include a valid "correctOptionId".`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.correctOptionId',
    });
  } else if (!optionSeen.has(correctOptionId)) {
    pushError({
      code: 'INVALID_CORRECT_OPTION_ID',
      severity: 'error',
      message: `Question "${questionId}" has correctOptionId "${correctOptionId}", but no matching option exists.`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.correctOptionId',
    });
  }

  const explanation = isNonEmptyString(rawQuestion.explanation) ? rawQuestion.explanation.trim() : undefined;
  if (!explanation) {
    pushError({
      code: 'MISSING_EXPLANATION',
      severity: 'error',
      message: `Question "${questionId}" must include a non-empty "explanation".`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.explanation',
    });
  }

  const references = validateReferences(
    rawQuestion.references,
    quizId,
    questionId,
    quizFileName,
    pushError
  );

  const codeSnippet = validateCodeSnippet(
    rawQuestion.codeSnippet,
    quizId,
    questionId,
    quizFileName,
    pushError
  );

  const questionType = rawQuestion.questionType ?? 'single_choice';
  if (questionType !== 'single_choice') {
    pushError({
      code: 'INVALID_QUESTION_TYPE',
      severity: 'error',
      message: `Question "${questionId}" uses an unsupported questionType.`,
      fileName: quizFileName,
      quizId,
      questionId,
      field: 'questions.questionType',
    });
  }

  if (!prompt || !explanation || !correctOptionId) {
    return undefined;
  }

  return {
    id: questionId,
    prompt,
    questionType: 'single_choice',
    hint: isNonEmptyString(rawQuestion.hint) ? rawQuestion.hint.trim() : undefined,
    codeSnippet,
    options,
    correctOptionId,
    explanation,
    references,
    tags: Array.isArray(rawQuestion.tags)
      ? rawQuestion.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim())
      : undefined,
  };
}

function validateQuizObject(
  rawQuiz: unknown,
  fileName: string | undefined,
  pushError: (issue: ValidationIssue) => void
): Quiz | undefined {
  if (!isRecord(rawQuiz)) {
    pushError({
      code: 'INVALID_ROOT_OBJECT',
      severity: 'error',
      message: 'The root JSON value must be a quiz object.',
      fileName,
      quizId: undefined,
      questionId: undefined,
      field: 'root',
    });
    return undefined;
  }

  const quizId = isNonEmptyString(rawQuiz.id) ? rawQuiz.id.trim() : undefined;
  if (!quizId) {
    pushError({
      code: 'MISSING_QUIZ_ID',
      severity: 'error',
      message: 'Quiz content must include a non-empty "id" field.',
      fileName,
      quizId: undefined,
      questionId: undefined,
      field: 'id',
    });
  }

  const publicationDate = isNonEmptyString(rawQuiz.publicationDate)
    ? rawQuiz.publicationDate.trim()
    : undefined;
  if (!publicationDate) {
    pushError({
      code: 'MISSING_PUBLICATION_DATE',
      severity: 'error',
      message: 'Quiz content must include a publicationDate in YYYY-MM-DD format.',
      fileName,
      quizId,
      questionId: undefined,
      field: 'publicationDate',
    });
  } else if (!isValidCalendarDate(publicationDate)) {
    pushError({
      code: 'INVALID_PUBLICATION_DATE',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" has publicationDate "${publicationDate}", which is not a valid calendar date in YYYY-MM-DD format.`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'publicationDate',
    });
  }

  const statusValue = typeof rawQuiz.status === 'string' ? rawQuiz.status.trim().toLowerCase() : undefined;
  const status = statusValue && PUBLICATION_STATUSES.includes(statusValue as PublicationStatus)
    ? (statusValue as PublicationStatus)
    : undefined;
  if (!status) {
    pushError({
      code: 'INVALID_PUBLICATION_STATUS',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" status must be one of: ${PUBLICATION_STATUSES.join(', ')}.`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'status',
    });
  }

  const title = isNonEmptyString(rawQuiz.title) ? rawQuiz.title.trim() : undefined;
  const description = isNonEmptyString(rawQuiz.description) ? rawQuiz.description.trim() : undefined;
  const topicValue = typeof rawQuiz.topic === 'string' ? rawQuiz.topic.trim().toLowerCase() : undefined;
  const topic = topicValue && QUIZ_TOPICS.includes(topicValue as QuizTopic)
    ? (topicValue as QuizTopic)
    : undefined;
  const difficultyValue = typeof rawQuiz.difficulty === 'string' ? rawQuiz.difficulty.trim().toLowerCase() : undefined;
  const difficulty = difficultyValue && QUIZ_DIFFICULTIES.includes(difficultyValue as QuizDifficulty)
    ? (difficultyValue as QuizDifficulty)
    : undefined;

  if (!title) {
    pushError({
      code: 'MISSING_TITLE',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" must include a non-empty "title".`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'title',
    });
  }
  if (!description) {
    pushError({
      code: 'MISSING_DESCRIPTION',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" must include a non-empty "description".`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'description',
    });
  }
  if (!topic) {
    pushError({
      code: 'INVALID_TOPIC',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" topic must be one of: ${QUIZ_TOPICS.join(', ')}.`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'topic',
    });
  }
  if (!difficulty) {
    pushError({
      code: 'INVALID_DIFFICULTY',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" difficulty must be one of: ${QUIZ_DIFFICULTIES.join(', ')}.`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'difficulty',
    });
  }

  const durationValue = rawQuiz.estimatedDurationMinutes;
  const estimatedDurationMinutes = typeof durationValue === 'number' && Number.isInteger(durationValue) && durationValue > 0
    ? durationValue
    : undefined;
  if (!estimatedDurationMinutes) {
    pushError({
      code: 'INVALID_DURATION',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" estimatedDurationMinutes must be a positive integer.`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'estimatedDurationMinutes',
    });
  }

  const timezone = isNonEmptyString(rawQuiz.timezone) ? rawQuiz.timezone.trim() : DEFAULT_PUBLICATION_TIMEZONE;
  if (!isNonEmptyString(rawQuiz.timezone)) {
    pushError({
      code: 'MISSING_TIMEZONE',
      severity: 'warning',
      message: `Quiz "${quizId ?? 'unknown'}" has no timezone; using default "${DEFAULT_PUBLICATION_TIMEZONE}".`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'timezone',
    });
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    pushError({
      code: 'INVALID_TIMEZONE',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" timezone "${timezone}" is not a valid IANA timezone.`,
      fileName,
      quizId,
      field: 'timezone',
    });
  }

  if (!Array.isArray(rawQuiz.questions) || rawQuiz.questions.length === 0) {
    pushError({
      code: 'INVALID_QUESTION_COLLECTION',
      severity: 'error',
      message: `Quiz "${quizId ?? 'unknown'}" must include a non-empty "questions" array.`,
      fileName,
      quizId,
      questionId: undefined,
      field: 'questions',
    });
    return undefined;
  }

  const scheduledAt = isNonEmptyString(rawQuiz.scheduledAt) ? rawQuiz.scheduledAt.trim() : undefined;
  const publishedAt = isNonEmptyString(rawQuiz.publishedAt) ? rawQuiz.publishedAt.trim() : undefined;
  for (const [field, value] of [
    ['scheduledAt', scheduledAt],
    ['publishedAt', publishedAt],
  ] as const) {
    if (value && (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) {
      pushError({
        code: 'INVALID_TIMESTAMP',
        severity: 'error',
        message: `"${field}" must be a valid ISO timestamp with an explicit UTC offset.`,
        fileName,
        quizId,
        field,
      });
    }
  }

  const seenQuestionIds = new Set<string>();
  const questions: QuizQuestion[] = [];
  for (const question of rawQuiz.questions as unknown[]) {
    const validatedQuestion = validateQuestionObject(question, quizId, fileName, seenQuestionIds, pushError);
    if (validatedQuestion) {
      questions.push(validatedQuestion);
    }
  }

  if (!quizId || !title || !description || !status || !topic || !difficulty || !estimatedDurationMinutes || !publicationDate) {
    return undefined;
  }

  return {
    id: quizId,
    version: typeof rawQuiz.version === 'number' && Number.isInteger(rawQuiz.version) && rawQuiz.version >= 1
      ? rawQuiz.version
      : 1,
    publicationDate,
    timezone,
    status,
    scheduledAt,
    publishedAt,
    createdAt: isNonEmptyString(rawQuiz.createdAt) ? rawQuiz.createdAt.trim() : undefined,
    createdBy: isNonEmptyString(rawQuiz.createdBy) ? rawQuiz.createdBy.trim() : undefined,
    title,
    description,
    topic,
    difficulty,
    estimatedDurationMinutes,
    author: isNonEmptyString(rawQuiz.author) ? rawQuiz.author.trim() : undefined,
    updatedAt: isNonEmptyString(rawQuiz.updatedAt) ? rawQuiz.updatedAt.trim() : undefined,
    previousVersionId: isNonEmptyString(rawQuiz.previousVersionId) ? rawQuiz.previousVersionId.trim() : undefined,
    questions,
  };
}

export function validateQuizJsonString(jsonText: string, fileName = 'quiz.json'): ValidationReport {
  const report: ValidationReport = {
    valid: false,
    fileName,
    errors: [],
    warnings: [],
    checkedAt: new Date().toISOString(),
  };

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const pushError = (issue: ValidationIssue): void => {
      report.errors.push(issue);
    };
    const pushWarning = (issue: ValidationIssue): void => {
      report.warnings.push(issue);
    };

    const parsedQuiz = validateQuizObject(parsed, fileName, (issue) => {
      if (issue.severity === 'warning') pushWarning(issue);
      else pushError(issue);
    });

    report.valid = report.errors.length === 0;
    report.parsedQuiz = parsedQuiz;
    report.quizId = parsedQuiz?.id;
    report.publicationDate = parsedQuiz?.publicationDate;
    report.status = parsedQuiz?.status;
    return report;
  } catch (_error) {
    report.errors.push({
      code: 'INVALID_JSON_SYNTAX',
      severity: 'error',
      message: 'JSON syntax is invalid or the file could not be parsed.',
      fileName,
      field: 'root',
    });
    return report;
  }
}

export function validateQuizPublishingLimits(quiz: Quiz): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (quiz.questions.length > 50) {
    issues.push({
      code: 'QUESTION_LIMIT_EXCEEDED',
      severity: 'error',
      message: 'A quiz can contain at most 50 questions.',
      quizId: quiz.id,
      field: 'questions',
    });
  }
  for (const question of quiz.questions) {
    if (question.options.length > 20) {
      issues.push({
        code: 'OPTION_LIMIT_EXCEEDED',
        severity: 'error',
        message: `Question "${question.id}" can contain at most 20 answer options.`,
        quizId: quiz.id,
        questionId: question.id,
        field: 'questions.options',
      });
    }
  }
  return issues;
}

export function validateQuizCollection(
  entries: ReadonlyArray<{ fileName: string; rawContent: unknown }>
): CollectionValidationReport {
  const fileReports: ValidationReport[] = [];
  const collectionIssues: ValidationIssue[] = [];
  const seenQuizIds = new Map<string, string>();
  const seenDates = new Map<string, string>();
  const seenQuestionIds = new Map<string, string>();

  for (const entry of entries) {
    const raw = entry.rawContent;
    const report = validateQuizJsonString(JSON.stringify(raw), entry.fileName);
    fileReports.push(report);

    if (!report.parsedQuiz) continue;

    const quiz = report.parsedQuiz;
    if (seenQuizIds.has(quiz.id)) {
      const issue: ValidationIssue = {
        code: 'DUPLICATE_QUIZ_ID',
        severity: 'error',
        message: `Quiz ID "${quiz.id}" is duplicated across files: "${seenQuizIds.get(quiz.id)}" and "${entry.fileName}".`,
        fileName: entry.fileName,
        quizId: quiz.id,
        field: 'id',
      };
      report.errors.push(issue);
      report.valid = false;
      collectionIssues.push(issue);
    } else {
      seenQuizIds.set(quiz.id, entry.fileName);
    }

    if (seenDates.has(quiz.publicationDate)) {
      const issue: ValidationIssue = {
        code: 'DUPLICATE_PUBLICATION_DATE',
        severity: 'error',
        message: `Publication date "${quiz.publicationDate}" is duplicated across files: "${seenDates.get(quiz.publicationDate)}" and "${entry.fileName}".`,
        fileName: entry.fileName,
        quizId: quiz.id,
        field: 'publicationDate',
      };
      report.errors.push(issue);
      report.valid = false;
      collectionIssues.push(issue);
    } else {
      seenDates.set(quiz.publicationDate, entry.fileName);
    }

    for (const question of quiz.questions) {
      const existingFile = seenQuestionIds.get(question.id);
      if (existingFile) {
        const issue: ValidationIssue = {
          code: 'DUPLICATE_QUESTION_ID_COLLECTION',
          severity: 'error',
          message: `Question ID "${question.id}" is duplicated across files: "${existingFile}" and "${entry.fileName}".`,
          fileName: entry.fileName,
          quizId: quiz.id,
          questionId: question.id,
          field: 'questions.id',
        };
        report.errors.push(issue);
        report.valid = false;
        collectionIssues.push(issue);
      } else {
        seenQuestionIds.set(question.id, entry.fileName);
      }
    }
  }

  const publishedCount = fileReports.filter((report) => report.parsedQuiz?.status === 'published').length;
  const draftCount = fileReports.filter((report) => report.parsedQuiz?.status === 'draft').length;
  const validatedCount = fileReports.filter((report) => report.parsedQuiz?.status === 'validated').length;
  const scheduledCount = fileReports.filter((report) => report.parsedQuiz?.status === 'scheduled').length;
  const archivedCount = fileReports.filter((report) => report.parsedQuiz?.status === 'archived').length;

  const valid = fileReports.every((report) => report.valid) && collectionIssues.length === 0;

  return {
    valid,
    totalFiles: fileReports.length,
    publishedCount,
    draftCount,
    validatedCount,
    scheduledCount,
    archivedCount,
    fileReports,
    collectionIssues,
    checkedAt: new Date().toISOString(),
  };
}

export function checkOverwriteSafety(
  candidate: Quiz,
  existingQuizzes: ReadonlyArray<Quiz>
): OverwriteConflictInfo {
  const duplicateIdMatch = existingQuizzes.find((existing) => existing.id === candidate.id);
  const duplicateDateMatch = existingQuizzes.find((existing) => existing.publicationDate === candidate.publicationDate);

  const hasConflict = Boolean(duplicateIdMatch || duplicateDateMatch);
  const conflictType = duplicateIdMatch && duplicateDateMatch ? 'both' : duplicateIdMatch ? 'duplicate_id' : duplicateDateMatch ? 'duplicate_date' : undefined;
  const existingQuiz = duplicateIdMatch ?? duplicateDateMatch;
  const touchesPublishedQuiz =
    candidate.status === 'published' ||
    Boolean(existingQuiz && existingQuiz.status === 'published');
  const requiresExplicitReplacement = Boolean(existingQuiz && touchesPublishedQuiz);

  return {
    hasConflict,
    conflictType,
    existingQuiz,
    touchesPublishedQuiz,
    requiresExplicitReplacement,
    suggestedNextVersion: (existingQuiz?.version ?? 0) + 1,
    message: existingQuiz
      ? `Quiz "${candidate.id}" conflicts with an existing quiz on ${existingQuiz.publicationDate}. Published content requires explicit replacement confirmation.`
      : undefined,
  };
}
