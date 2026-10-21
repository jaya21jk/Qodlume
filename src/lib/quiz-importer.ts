import type {
  OverwriteConflictInfo,
  PublicationStatus,
  Quiz,
  ValidationIssue,
  ValidationReport,
} from '../types/quiz';
import {
  checkOverwriteSafety,
  validateQuizJsonString,
} from './quiz-validator';

export interface ImportInspectionResult {
  fileName: string;
  validationReport: ValidationReport;
  conflictInfo: OverwriteConflictInfo;
  crossQuestionConflicts: ValidationIssue[];
  canProceedWithoutReplacement: boolean;
  canProceedWithExplicitVersionUpgrade: boolean;
  lifecycleState: 'invalid' | 'draft' | 'validated' | 'published';
}

export interface PreparedExportPackage {
  targetFileName: string;
  quizToExport: Quiz;
  jsonContent: string;
  previousPublishedBackup?: {
    backupFileName: string;
    quiz: Quiz;
    jsonContent: string;
  };
  publishingSteps: string[];
}

export function inspectUploadedQuizJson(
  jsonText: string,
  fileName: string,
  existingQuizzes: ReadonlyArray<Quiz>
): ImportInspectionResult {
  const validationReport = validateQuizJsonString(jsonText, fileName);

  if (!validationReport.valid || !validationReport.parsedQuiz) {
    return {
      fileName,
      validationReport,
      conflictInfo: {
        hasConflict: false,
        touchesPublishedQuiz: false,
        requiresExplicitReplacement: false,
        suggestedNextVersion: 1,
      },
      crossQuestionConflicts: [],
      canProceedWithoutReplacement: false,
      canProceedWithExplicitVersionUpgrade: false,
      lifecycleState: 'invalid',
    };
  }

  const candidate = validationReport.parsedQuiz;
  const conflictInfo = checkOverwriteSafety(candidate, existingQuizzes);

  const crossQuestionConflicts: ValidationIssue[] = [];
  const otherQuizzes = existingQuizzes.filter(
    (q) =>
      q.id !== conflictInfo.existingQuiz?.id &&
      q.publicationDate !== conflictInfo.existingQuiz?.publicationDate
  );

  const otherQuestionIds = new Map<string, string>();
  for (const oq of otherQuizzes) {
    for (const q of oq.questions) {
      otherQuestionIds.set(q.id, oq.id);
    }
  }

  for (const q of candidate.questions) {
    const collidingQuizId = otherQuestionIds.get(q.id);
    if (collidingQuizId) {
      const issue: ValidationIssue = {
        code: 'DUPLICATE_QUESTION_ID_ACROSS_COLLECTION',
        severity: 'error',
        message: `Question ID "${q.id}" already exists in another quiz ("${collidingQuizId}"). Question IDs must be globally unique.`,
        fileName,
        quizId: candidate.id,
        questionId: q.id,
        field: 'questions.id',
      };
      crossQuestionConflicts.push(issue);
      validationReport.errors.push(issue);
      validationReport.valid = false;
    }
  }

  if (crossQuestionConflicts.length > 0) {
    return {
      fileName,
      validationReport,
      conflictInfo,
      crossQuestionConflicts,
      canProceedWithoutReplacement: false,
      canProceedWithExplicitVersionUpgrade: false,
      lifecycleState: 'invalid',
    };
  }

  return {
    fileName,
    validationReport,
    conflictInfo,
    crossQuestionConflicts,
    canProceedWithoutReplacement: !conflictInfo.hasConflict,
    canProceedWithExplicitVersionUpgrade: conflictInfo.hasConflict,
    lifecycleState: candidate.status === 'draft' ? 'draft' : 'validated',
  };
}

export function prepareQuizExportPackage(
  inspection: ImportInspectionResult,
  options: {
    targetStatus: PublicationStatus;
    confirmExplicitReplacement?: boolean;
  }
): PreparedExportPackage {
  if (!inspection.validationReport.valid || !inspection.validationReport.parsedQuiz) {
    throw new Error('Cannot prepare export package: quiz failed validation.');
  }

  const candidate = inspection.validationReport.parsedQuiz;
  const { conflictInfo } = inspection;

  if (conflictInfo.hasConflict && !options.confirmExplicitReplacement) {
    throw new Error(
      conflictInfo.message ??
        'Conflict with existing quiz detected. Explicit replacement confirmation is required.'
    );
  }

  let finalVersion = candidate.version;
  let previousVersionId = candidate.previousVersionId;
  let previousPublishedBackup: PreparedExportPackage['previousPublishedBackup'];

  if (conflictInfo.hasConflict && conflictInfo.existingQuiz) {
    const existing = conflictInfo.existingQuiz;
    finalVersion = conflictInfo.suggestedNextVersion;
    previousVersionId = `${existing.id}@v${existing.version}`;
    const backupQuiz: Quiz = { ...existing, status: 'archived' };
    const backupFileName = `${existing.publicationDate}.v${existing.version}.backup.json`;
    previousPublishedBackup = {
      backupFileName,
      quiz: backupQuiz,
      jsonContent: JSON.stringify(backupQuiz, null, 2) + '\n',
    };
  }

  const quizToExport: Quiz = {
    ...candidate,
    version: finalVersion,
    status: options.targetStatus,
    previousVersionId,
    updatedAt: new Date().toISOString(),
  };

  const targetFileName = `${quizToExport.publicationDate}.json`;
  const publishingSteps = [
    `Download "${targetFileName}" using the export button.`,
    ...(previousPublishedBackup
      ? [`Download backup "${previousPublishedBackup.backupFileName}" to retain the prior published version.`]
      : []),
    `Import and publish the quiz from the D1-backed admin workspace at /admin/import.`,
    `Optionally store "${targetFileName}" in content/quizzes/ as a versioned backup.`,
    `Run "npm run validate:quizzes" to validate versioned quiz backups.`,
  ];

  return {
    targetFileName,
    quizToExport,
    jsonContent: JSON.stringify(quizToExport, null, 2) + '\n',
    previousPublishedBackup,
    publishingSteps,
  };
}
