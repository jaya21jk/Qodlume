import { QUIZ_MANIFEST_ENTRIES } from '../src/data/quiz-manifest';
import { validateQuizCollection } from '../src/lib/quiz-validator';

const report = validateQuizCollection(QUIZ_MANIFEST_ENTRIES);

console.log(`Checked ${report.totalFiles} quiz files at ${report.checkedAt}`);
console.log(`Published: ${report.publishedCount} | Draft: ${report.draftCount} | Validated: ${report.validatedCount} | Archived: ${report.archivedCount}`);

if (!report.valid) {
  for (const issue of report.collectionIssues) {
    console.error(`- ${issue.fileName ?? 'unknown'} :: ${issue.code}: ${issue.message}`);
  }

  for (const fileReport of report.fileReports) {
    if (!fileReport.valid) {
      for (const issue of fileReport.errors) {
        console.error(`- ${fileReport.fileName ?? 'unknown'} :: ${issue.code}: ${issue.message}`);
      }
    }
  }

  console.error('Quiz validation failed. Fix invalid published content before shipping.');
  process.exit(1);
}

console.log('Quiz validation succeeded.');
