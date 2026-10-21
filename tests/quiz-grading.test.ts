import test from "node:test";
import assert from "node:assert/strict";
import { gradeQuizSubmission, isQuizGradingResult } from "../src/lib/quiz-grading";
import type { Quiz } from "../src/types/quiz";

const quiz: Quiz = {
  id: "grading-test",
  version: 1,
  publicationDate: "2026-10-22",
  timezone: "Asia/Kolkata",
  status: "published",
  title: "Grading test",
  description: "A quiz used to test server-side grading.",
  topic: "javascript",
  difficulty: "beginner",
  estimatedDurationMinutes: 3,
  questions: [
    {
      id: "question-1",
      prompt: "Choose A.",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionId: "a",
      explanation: "A is correct.",
    },
    {
      id: "question-2",
      prompt: "Choose D.",
      options: [
        { id: "c", text: "C" },
        { id: "d", text: "D" },
      ],
      correctOptionId: "d",
      explanation: "D is correct.",
    },
  ],
};

test("quiz grading validates complete answers and returns feedback after submission", () => {
  const result = gradeQuizSubmission(quiz, {
    "question-1": "a",
    "question-2": "c",
  });

  assert.deepEqual(result, {
    score: 1,
    answers: [
      {
        questionId: "question-1",
        selectedOptionId: "a",
        correctOptionId: "a",
        explanation: "A is correct.",
        correct: true,
      },
      {
        questionId: "question-2",
        selectedOptionId: "c",
        correctOptionId: "d",
        explanation: "D is correct.",
        correct: false,
      },
    ],
  });
  assert.equal(isQuizGradingResult(result), true);
});

test("quiz grading rejects missing, extra, and invalid answers", () => {
  assert.equal(gradeQuizSubmission(quiz, { "question-1": "a" }), null);
  assert.equal(
    gradeQuizSubmission(quiz, {
      "question-1": "a",
      "question-2": "d",
      extra: "a",
    }),
    null,
  );
  assert.equal(
    gradeQuizSubmission(quiz, {
      "question-1": "not-an-option",
      "question-2": "d",
    }),
    null,
  );
});
