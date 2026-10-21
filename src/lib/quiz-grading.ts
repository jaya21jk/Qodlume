import type { Quiz, QuizGradingResult } from '../types/quiz';

export function gradeQuizSubmission(quiz: Quiz, answers: unknown): QuizGradingResult | null {
  if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
    return null;
  }

  const submittedAnswers = answers as Record<string, unknown>;
  const questionIds = new Set(quiz.questions.map((question) => question.id));
  const answerIds = Object.keys(submittedAnswers);
  if (
    answerIds.length !== questionIds.size ||
    answerIds.some((questionId) => !questionIds.has(questionId))
  ) {
    return null;
  }

  let score = 0;
  const results: QuizGradingResult['answers'] = [];
  for (const question of quiz.questions) {
    const selectedOptionId = submittedAnswers[question.id];
    if (
      typeof selectedOptionId !== 'string' ||
      !question.options.some((option) => option.id === selectedOptionId)
    ) {
      return null;
    }
    const correct = selectedOptionId === question.correctOptionId;
    if (correct) score += 1;
    results.push({
      questionId: question.id,
      selectedOptionId,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
      correct,
    });
  }

  return { score, answers: results };
}

export function isQuizGradingResult(value: unknown): value is QuizGradingResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('score' in value) ||
    typeof value.score !== 'number' ||
    !Number.isInteger(value.score) ||
    !('answers' in value) ||
    !Array.isArray(value.answers)
  ) {
    return false;
  }

  return value.answers.every(
    (answer) =>
      typeof answer === 'object' &&
      answer !== null &&
      'questionId' in answer &&
      typeof answer.questionId === 'string' &&
      'selectedOptionId' in answer &&
      typeof answer.selectedOptionId === 'string' &&
      'correctOptionId' in answer &&
      typeof answer.correctOptionId === 'string' &&
      'explanation' in answer &&
      typeof answer.explanation === 'string' &&
      'correct' in answer &&
      typeof answer.correct === 'boolean',
  );
}
