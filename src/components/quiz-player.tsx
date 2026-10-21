"use client";

import { useState } from "react";
import { isQuizGradingResult } from "../lib/quiz-grading";
import type { PublicQuiz, QuizGradingResult } from "../types/quiz";

export function QuizPlayer({ quiz }: { quiz: PublicQuiz }) {
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [gradingResult, setGradingResult] = useState<QuizGradingResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleSelect = (questionId: string, optionId: string) => {
    if (gradingResult || isSubmitting) return;
    setSelectedAnswers((current) => ({ ...current, [questionId]: optionId }));
  };

  const allAnswered = quiz.questions.every(
    (question) => !!selectedAnswers[question.id],
  );

  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = (answeredCount / quiz.questions.length) * 100;

  const handleSubmit = async () => {
    if (!allAnswered || isSubmitting || gradingResult) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const response = await fetch(`/api/quizzes/${encodeURIComponent(quiz.publicationDate)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers }),
      });
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
      ) {
        throw new Error(payload.error);
      }
      if (
        !response.ok ||
        typeof payload !== "object" ||
        payload === null ||
        !("result" in payload) ||
        !isQuizGradingResult(payload.result)
      ) {
        throw new Error("Unable to grade the quiz. Please try again.");
      }
      setGradingResult(payload.result);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Unable to grade the quiz. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.88)",
        border: "1px solid rgba(148,163,184,0.3)",
        borderRadius: 28,
        padding: 28,
        boxShadow: "0 22px 50px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#334155", fontWeight: 700 }}>
            <span
              style={{
                background: "#eff6ff",
                borderRadius: 999,
                padding: "6px 10px",
                marginRight: 8,
              }}
            >
              {quiz.publicationDate}
            </span>
            {quiz.topic} · {quiz.difficulty} · {quiz.estimatedDurationMinutes}{" "}
            minutes
          </p>

          <div
            style={{
              marginTop: 10,
              width: "min(320px, 100%)",
              background: "#e2e8f0",
              borderRadius: 999,
              overflow: "hidden",
              height: 10,
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                height: "100%",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>

        {gradingResult ? (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 800,
            }}
          >
            Score: {gradingResult.score}/{quiz.questions.length}
          </div>
        ) : (
          <div
            style={{
              background: "#f8fafc",
              color: "#334155",
              borderRadius: 999,
              padding: "8px 12px",
              fontWeight: 700,
              border: "1px solid #e2e8f0",
            }}
          >
            {answeredCount}/{quiz.questions.length} answered
          </div>
        )}
      </div>

      <ol style={{ paddingLeft: 20, margin: 0 }}>
        {quiz.questions.map((question, index) => {
          const selected = selectedAnswers[question.id];
          const feedback = gradingResult?.answers.find(
            (answer) => answer.questionId === question.id,
          );
          const correct = feedback?.correct ?? false;
          const wrong = feedback !== undefined && !feedback.correct;

          return (
            <li
              key={question.id}
              style={{
                marginBottom: 30,
                padding: 18,
                borderRadius: 20,
                background: "rgba(248,250,252,0.9)",
                border: "1px solid rgba(148,163,184,0.2)",
              }}
            >
              <h3 style={{ marginBottom: 10, fontSize: "1.2rem" }}>
                Q{index + 1}. {question.prompt}
              </h3>

              {question.codeSnippet && (
                <pre
                  style={{
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: 16,
                    borderRadius: 12,
                    overflow: "auto",
                    margin: "12px 0 14px",
                    lineHeight: 1.5,
                  }}
                >
                  <code>{question.codeSnippet.code}</code>
                </pre>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {question.options.map((option) => {
                  const isSelected = selected === option.id;
                  const isCorrectAnswer =
                    feedback !== undefined && option.id === feedback.correctOptionId;
                  const isWrongSelection =
                    feedback !== undefined &&
                    isSelected &&
                    option.id !== feedback.correctOptionId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(question.id, option.id)}
                      disabled={gradingResult !== null || isSubmitting}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        borderRadius: 12,
                        border: isSelected
                          ? "2px solid #2563eb"
                          : isCorrectAnswer
                            ? "2px solid #16a34a"
                            : isWrongSelection
                              ? "2px solid #ef4444"
                              : "1px solid #cbd5e1",
                        background: isCorrectAnswer
                          ? "#dcfce7"
                          : isWrongSelection
                            ? "#fee2e2"
                            : isSelected
                              ? "#eff6ff"
                              : "#fff",
                        color: "#0f172a",
                        padding: "12px 14px",
                        cursor: "pointer",
                        fontSize: 15,
                        fontWeight: 500,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{option.id}.</span>{" "}
                      {option.text}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    background: correct
                      ? "#dcfce7"
                      : wrong
                        ? "#fee2e2"
                        : "#f8fafc",
                    color: correct ? "#166534" : wrong ? "#991b1b" : "#334155",
                    border: `1px solid ${correct ? "#86efac" : wrong ? "#fca5a5" : "#e2e8f0"}`,
                  }}
                >
                  <strong>
                    {correct ? "Correct." : wrong ? "Incorrect." : "Answer"}
                  </strong>{" "}
                  {feedback.explanation}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {submissionError && (
        <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>
          {submissionError}
        </p>
      )}

      <div
        style={{
          marginTop: 18,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!allAnswered || isSubmitting || gradingResult !== null}
          style={{
            background: allAnswered && !isSubmitting && !gradingResult
              ? "linear-gradient(135deg, #111827, #1e293b)"
              : "#cbd5e1",
            color: allAnswered && !isSubmitting && !gradingResult ? "#fff" : "#64748b",
            border: "none",
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: allAnswered && !isSubmitting && !gradingResult ? "pointer" : "not-allowed",
            boxShadow: allAnswered && !isSubmitting && !gradingResult
              ? "0 12px 24px rgba(15, 23, 42, 0.18)"
              : "none",
          }}
        >
          {isSubmitting ? "Submitting…" : gradingResult ? "Submitted" : "Submit answers"}
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedAnswers({});
            setGradingResult(null);
            setSubmissionError(null);
          }}
          style={{
            background: "transparent",
            color: "#0f172a",
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
