"use client";

import { useMemo, useState } from "react";
import {
  checkOverwriteSafety,
  validateQuizJsonString,
} from "../lib/quiz-validator";
import {
  inspectUploadedQuizJson,
  prepareQuizExportPackage,
} from "../lib/quiz-importer";
import { quizRepository } from "../lib/quiz-content";
import type { PreparedExportPackage } from "../lib/quiz-importer";
import type { Quiz, ValidationReport } from "../types/quiz";

const JAVA_SAMPLE_QUIZ: Quiz = {
  id: "quiz-2026-10-22-java-string-equality",
  version: 1,
  publicationDate: "2026-10-22",
  timezone: "Asia/Kolkata",
  status: "draft",
  title: "Java String Equality: == vs equals()",
  description:
    "Test your understanding of reference equality and value equality when comparing Java strings.",
  topic: "java",
  difficulty: "beginner",
  estimatedDurationMinutes: 3,
  author: "Qodlume Editorial",
  updatedAt: "2026-10-20T00:00:00+05:30",
  questions: [
    {
      id: "q-20261022-java-1",
      prompt: "What does this code print?",
      codeSnippet: {
        language: "java",
        filename: "StringEquality.java",
        code: 'String first = new String("qodlume");\nString second = new String("qodlume");\nSystem.out.println(first == second);\nSystem.out.println(first.equals(second));',
        highlightLines: [3, 4],
      },
      options: [
        { id: "opt-a", text: "true followed by true" },
        { id: "opt-b", text: "false followed by true" },
        { id: "opt-c", text: "true followed by false" },
        { id: "opt-d", text: "false followed by false" },
      ],
      correctOptionId: "opt-b",
      explanation:
        "The == operator compares object references, and the two new expressions create distinct String objects, so it prints false. String.equals() compares character content, which is the same in both objects, so it prints true.",
      references: [
        {
          title: "Java String API",
          url: "https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html#equals(java.lang.Object)",
          type: "documentation",
        },
      ],
      tags: ["java", "strings", "equality"],
    },
  ],
};

export function QuizImporter() {
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [quizPreview, setQuizPreview] = useState<Quiz | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJson, setEditedJson] = useState("");
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [publishPackage, setPublishPackage] =
    useState<PreparedExportPackage | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const publishedQuizzes = useMemo(
    () => quizRepository.listPublishedQuizzes(),
    [],
  );

  const handleJson = (text: string, selectedFileName: string) => {
    const nextReport = validateQuizJsonString(text, selectedFileName);
    setReport(nextReport);

    if (!nextReport.valid || !nextReport.parsedQuiz) {
      setQuizPreview(null);
      setShowPreview(false);
      setIsEditing(false);
      setPublishPackage(null);
      setConfirmReplacement(false);
      setError(
        "The uploaded JSON is invalid. Correct the issues before previewing it.",
      );
      return;
    }

    const candidate = nextReport.parsedQuiz;
    const overlap = checkOverwriteSafety(candidate, publishedQuizzes);
    setQuizPreview(candidate);
    setEditedJson(JSON.stringify(candidate, null, 2));
    setShowPreview(false);
    setIsEditing(false);
    setPublishPackage(null);
    setConfirmReplacement(false);
    setError(
      overlap.hasConflict
        ? `This would overlap with existing content for ${overlap.existingQuiz?.publicationDate ?? "an existing quiz"}. Preview is allowed, but static publishing requires explicit replacement and a redeploy.`
        : "",
    );
  };

  const saveEditedQuiz = () => {
    const nextReport = validateQuizJsonString(
      editedJson,
      fileName || "edited-quiz.json",
    );
    setReport(nextReport);

    if (!nextReport.valid || !nextReport.parsedQuiz) {
      setError("The edited JSON is invalid. Correct the issues before saving.");
      return;
    }

    const candidate = nextReport.parsedQuiz;
    const overlap = checkOverwriteSafety(candidate, publishedQuizzes);
    setQuizPreview(candidate);
    setEditedJson(JSON.stringify(candidate, null, 2));
    setShowPreview(false);
    setIsEditing(false);
    setPublishPackage(null);
    setConfirmReplacement(false);
    setError(
      overlap.hasConflict
        ? `This would overlap with existing content for ${overlap.existingQuiz?.publicationDate ?? "an existing quiz"}. Preview is allowed, but static publishing requires explicit replacement and a redeploy.`
        : "",
    );
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    handleJson(text, file.name);
  };

  const onDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    handleJson(text, file.name);
  };

  const downloadJson = (fileName: string, jsonContent: string) => {
    if (!quizPreview) return;
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const prepareDeploymentExport = () => {
    if (!quizPreview) return;

    const inspection = inspectUploadedQuizJson(
      JSON.stringify(quizPreview),
      fileName || `${quizPreview.publicationDate}.json`,
      publishedQuizzes,
    );
    setReport(inspection.validationReport);

    if (!inspection.validationReport.valid) {
      setError("The quiz must pass validation before it can be published.");
      return;
    }

    if (inspection.conflictInfo.hasConflict && !confirmReplacement) {
      setError(
        "A published quiz already exists for this content. Confirm replacement below to create a backup and continue.",
      );
      return;
    }

    try {
      const prepared = prepareQuizExportPackage(inspection, {
        targetStatus: "published",
        confirmExplicitReplacement: confirmReplacement,
      });
      setPublishPackage(prepared);
      setQuizPreview(prepared.quizToExport);
      setEditedJson(JSON.stringify(prepared.quizToExport, null, 2));
      setError("");
      downloadJson(prepared.targetFileName, prepared.jsonContent);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to prepare the published quiz export.",
      );
    }
  };

  const loadJavaSample = () => {
    const sampleFileName = "java-string-equality-sample.json";
    setFileName(sampleFileName);
    handleJson(JSON.stringify(JAVA_SAMPLE_QUIZ), sampleFileName);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        maxWidth: 960,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <div
        style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 20 }}
      >
        <h2 style={{ marginTop: 0 }}>Owner import studio</h2>
        <p style={{ color: "#374151" }}>
          Upload a local quiz JSON file to validate schema, preview questions,
          and generate a downloadable export for static publishing.
        </p>

        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          style={{
            display: "block",
            border: `2px dashed ${dragActive ? "#2563eb" : "#cbd5e1"}`,
            borderRadius: 12,
            padding: 20,
            textAlign: "center",
            background: dragActive ? "#eff6ff" : "#f8fafc",
            cursor: "pointer",
          }}
        >
          <input
            type="file"
            accept=".json,application/json"
            onChange={onFileSelected}
            style={{ display: "none" }}
          />
          <strong>{fileName || "Choose a JSON file or drag one here"}</strong>
        </label>
        <button
          type="button"
          onClick={loadJavaSample}
          style={{
            marginTop: 12,
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#fff",
            color: "#0f172a",
            padding: "9px 13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Load Java sample
        </button>
      </div>

      {report && (
        <div
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}
        >
          <h3 style={{ marginTop: 0 }}>Validation report</h3>
          <p
            style={{
              color: report.valid ? "#166534" : "#991b1b",
              fontWeight: 600,
            }}
          >
            {report.valid ? "Validated successfully" : "Validation failed"}
          </p>

          {report.errors.length > 0 && (
            <ul>
              {report.errors.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  <strong>{issue.code}</strong>: {issue.message}
                </li>
              ))}
            </ul>
          )}

          {report.warnings.length > 0 && (
            <div>
              <h4>Warnings</h4>
              <ul>
                {report.warnings.map((issue, index) => (
                  <li key={`${issue.code}-warning-${index}`}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            border: "1px solid #fcd34d",
            background: "#fef3c7",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {error}
        </div>
      )}

      {quizPreview && (
        <section
          aria-labelledby="quiz-ready-heading"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: 24,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2
              id="quiz-ready-heading"
              style={{ margin: "0 0 8px", fontSize: 30 }}
            >
              Your quiz is ready!
            </h2>
            <p style={{ margin: 0, color: "#64748b" }}>
              Preview or edit this quiz, then prepare it for deployment.
            </p>
          </div>

          <ol
            aria-label="Quiz import steps completed"
            style={{
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 6,
              margin: "0 0 28px",
              padding: 0,
            }}
          >
            {["Outcomes", "Questions", "Description", "Finalizing"].map(
              (step) => (
                <li key={step} style={{ textAlign: "center", minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 24,
                      height: 24,
                      border: "2px solid #5c9f65",
                      borderRadius: "50%",
                      color: "#43864d",
                      fontWeight: 800,
                      marginBottom: 6,
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      display: "block",
                      color: "#334155",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {step}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      height: 8,
                      marginTop: 10,
                      borderRadius: 999,
                      background: "#63aa68",
                    }}
                  />
                </li>
              ),
            )}
          </ol>

          <div
            style={{
              borderTop: "1px solid #e2e8f0",
              paddingTop: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 19 }}>
                {quizPreview.title}
              </h3>
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5 }}>
                {quizPreview.questions.length} questions · {quizPreview.topic} ·{" "}
                {quizPreview.difficulty}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setShowPreview(true);
                  document
                    .getElementById("quiz-preview")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#0f172a",
                  padding: "11px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Preview quiz
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditedJson(JSON.stringify(quizPreview, null, 2));
                  setIsEditing(true);
                  setShowPreview(false);
                  setPublishPackage(null);
                }}
                style={{
                  border: "none",
                  borderRadius: 8,
                  background: "#4f46e5",
                  color: "#fff",
                  padding: "11px 16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Edit your quiz
              </button>
              {checkOverwriteSafety(quizPreview, publishedQuizzes)
                .hasConflict && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#7c2d12",
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmReplacement}
                    onChange={(event) =>
                      setConfirmReplacement(event.target.checked)
                    }
                  />
                  Confirm replacing the published quiz
                </label>
              )}
              <button
                type="button"
                onClick={prepareDeploymentExport}
                disabled={publishPackage !== null}
                style={{
                  border: "none",
                  borderRadius: 8,
                  background: publishPackage ? "#64748b" : "#15803d",
                  color: "#fff",
                  padding: "11px 16px",
                  fontWeight: 700,
                  cursor: publishPackage ? "default" : "pointer",
                }}
              >
                {publishPackage
                  ? "Export prepared"
                  : "Prepare deployment export"}
              </button>
            </div>
          </div>
        </section>
      )}

      {quizPreview && isEditing && (
        <section
          aria-labelledby="edit-quiz-heading"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: 20,
            background: "#fff",
          }}
        >
          <h3 id="edit-quiz-heading" style={{ margin: "0 0 8px" }}>
            Edit your quiz
          </h3>
          <p style={{ color: "#64748b", margin: "0 0 14px", lineHeight: 1.5 }}>
            Make changes to the quiz JSON. Saving validates the full content
            before updating the preview.
          </p>
          <textarea
            aria-label="Edit quiz JSON"
            value={editedJson}
            onChange={(event) => setEditedJson(event.target.value)}
            spellCheck={false}
            style={{
              display: "block",
              width: "100%",
              minHeight: 360,
              boxSizing: "border-box",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: 14,
              fontFamily: "Consolas, monospace",
              fontSize: 14,
              lineHeight: 1.55,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={saveEditedQuiz}
              style={{
                border: "none",
                borderRadius: 8,
                background: "#0f172a",
                color: "#fff",
                padding: "10px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save and validate
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                background: "#fff",
                color: "#0f172a",
                padding: "10px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {publishPackage && (
        <section
          aria-labelledby="publish-export-heading"
          style={{
            border: "1px solid #bbf7d0",
            borderRadius: 12,
            padding: 20,
            background: "#f0fdf4",
          }}
        >
          <h3 id="publish-export-heading" style={{ margin: "0 0 8px" }}>
            Deployment export prepared
          </h3>
          <p style={{ margin: "0 0 12px", color: "#166534", lineHeight: 1.6 }}>
            The JSON file is downloaded with published status. This static site
            cannot make uploads live directly; complete these repository steps
            to publish the quiz and its topic to visitors.
          </p>
          {publishPackage.previousPublishedBackup && (
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  publishPackage.previousPublishedBackup!.backupFileName,
                  publishPackage.previousPublishedBackup!.jsonContent,
                )
              }
              style={{
                border: "1px solid #86efac",
                borderRadius: 8,
                background: "#fff",
                color: "#166534",
                padding: "9px 13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Download previous version backup
            </button>
          )}
          <ol style={{ marginBottom: 0, paddingLeft: 22, lineHeight: 1.7 }}>
            {publishPackage.publishingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {quizPreview && showPreview && (
        <section
          id="quiz-preview"
          aria-label="Quiz preview"
          style={{
            border: "1px solid #dbeafe",
            borderRadius: 12,
            padding: 20,
            background: "#f8fbff",
          }}
        >
          <h3 style={{ margin: "0 0 6px" }}>{quizPreview.title}</h3>
          <p style={{ margin: "0 0 16px", color: "#475569" }}>
            {quizPreview.description}
          </p>
          <ol>
            {quizPreview.questions.map((question) => (
              <li key={question.id} style={{ marginBottom: 16 }}>
                <strong>{question.prompt}</strong>
                {question.codeSnippet && (
                  <pre
                    style={{
                      overflowX: "auto",
                      borderRadius: 8,
                      background: "#0f172a",
                      color: "#f8fafc",
                      padding: 14,
                    }}
                  >
                    <code>{question.codeSnippet.code}</code>
                  </pre>
                )}
                <ul>
                  {question.options.map((option) => (
                    <li key={option.id}>{option.text}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
