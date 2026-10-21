import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateQuizCollection } from '../src/lib/quiz-validator';

const contentDirectory = join(process.cwd(), 'content', 'quizzes');
const entries = readdirSync(contentDirectory)
  .filter((fileName) => fileName.endsWith('.json'))
  .sort()
  .map((fileName) => ({
    fileName,
    rawContent: JSON.parse(readFileSync(join(contentDirectory, fileName), 'utf8')) as unknown,
  }));
const report = validateQuizCollection(entries);

console.log(`Checked ${report.totalFiles} quiz files at ${report.checkedAt}`);
console.log(`Published: ${report.publishedCount} | Draft: ${report.draftCount} | Validated: ${report.validatedCount} | Scheduled: ${report.scheduledCount} | Archived: ${report.archivedCount}`);

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
