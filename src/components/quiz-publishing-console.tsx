"use client";

import { useCallback, useEffect, useState } from "react";
import javaSampleQuiz from "../../java-quiz-sample.json";
import { QuizPlayer } from "./quiz-player";
import { validateQuizJsonString } from "../lib/quiz-validator";
import type {
  AdminQuizListItem,
  Quiz,
  PublicationStatus,
  ValidationReport,
} from "../types/quiz";

const NEW_QUIZ: Quiz = {
  id: "",
  version: 1,
  publicationDate: "",
  timezone: "Asia/Kolkata",
  status: "draft",
  title: "",
  description: "",
  topic: "javascript",
  difficulty: "beginner",
  estimatedDurationMinutes: 3,
  author: "Qodlume Editorial",
  questions: [
    {
      id: "",
      prompt: "",
      options: [
        { id: "option-a", text: "" },
        { id: "option-b", text: "" },
      ],
      correctOptionId: "option-a",
      explanation: "",
    },
  ],
};

interface ApiError {
  error?: string;
  validation?: ValidationReport;
}

const statusColors: Record<PublicationStatus, string> = {
  draft: "#64748b",
  validated: "#2563eb",
  scheduled: "#7c3aed",
  published: "#15803d",
  archived: "#b45309",
};

function formatTimestamp(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function QuizPublishingConsole() {
  const [quizzes, setQuizzes] = useState<AdminQuizListItem[]>([]);
  const [editor, setEditor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/quizzes", { cache: "no-store" });
      const result = (await response.json()) as { quizzes?: AdminQuizListItem[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load quizzes.");
      setQuizzes(result.quizzes ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load quizzes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  const validateEditor = (value: string) => {
    const nextReport = validateQuizJsonString(value, "admin-editor.json");
    setReport(nextReport);
    return nextReport;
  };

  const startNew = () => {
    setEditingId(null);
    setEditor(JSON.stringify(NEW_QUIZ, null, 2));
    setReport(null);
    setError("");
  };

  const editQuiz = async (quiz: AdminQuizListItem) => {
    setBusy(`load:${quiz.id}`);
    setError("");
    try {
      const response = await fetch(`/api/admin/quizzes/${encodeURIComponent(quiz.id)}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as { quiz?: Quiz; error?: string };
      if (!response.ok || !result.quiz) {
        throw new Error(result.error ?? "Unable to load quiz for editing.");
      }
      setEditingId(quiz.id);
      setEditor(JSON.stringify({ ...result.quiz, status: "draft" }, null, 2));
      setReport(null);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Unable to load quiz for editing.");
    } finally {
      setBusy("");
    }
  };

  const saveDraft = async () => {
    const validation = validateEditor(editor);
    if (!validation.valid || !validation.parsedQuiz) {
      setError("Fix the validation errors before saving this draft.");
      return;
    }
    const quiz = { ...validation.parsedQuiz, status: "draft" as const };
    const endpoint = editingId
      ? `/api/admin/quizzes/${encodeURIComponent(editingId)}`
      : "/api/admin/quizzes";
    setBusy("save");
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz }),
      });
      const result = (await response.json()) as ApiError & { quiz?: Quiz };
      if (!response.ok) {
        if (result.validation) setReport(result.validation);
        throw new Error(result.error ?? "Unable to save draft.");
      }
      setEditingId(result.quiz?.id ?? quiz.id);
      setEditor(JSON.stringify(result.quiz ?? quiz, null, 2));
      await loadQuizzes();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    } finally {
      setBusy("");
    }
  };

  const runAction = async (quiz: AdminQuizListItem, action: string) => {
    if (
      (action === "archive" || action === "unpublish") &&
      !window.confirm(`Are you sure you want to ${action} "${quiz.title}"?`)
    ) {
      return;
    }
    let scheduledAt: string | undefined;
    if (action === "schedule") {
      if (!scheduleInput) {
        setError("Choose a future publication time first.");
        return;
      }
      scheduledAt = new Date(scheduleInput).toISOString();
    }
    setBusy(`${action}:${quiz.id}`);
    setError("");
    try {
      const response = await fetch(`/api/admin/quizzes/${encodeURIComponent(quiz.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, scheduledAt }),
      });
      const result = (await response.json()) as ApiError;
      if (!response.ok) {
        if (result.validation) {
          setReport(result.validation);
          await loadQuizzes();
        }
        throw new Error(result.error ?? "Unable to update quiz status.");
      }
      await loadQuizzes();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update quiz status.");
    } finally {
      setBusy("");
    }
  };

  const loadFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setEditingId(null);
    setEditor(text);
    validateEditor(text);
    setError("");
  };

  const loadSample = () => {
    setEditingId(null);
    setEditor(JSON.stringify(javaSampleQuiz, null, 2));
    setReport(validateQuizJsonString(JSON.stringify(javaSampleQuiz), "java-quiz-sample.json"));
    setError("");
  };

  const exportEditor = () => {
    const validation = validateEditor(editor);
    if (!validation.parsedQuiz) {
      setError("Only a valid quiz can be exported.");
      return;
    }
    const blob = new Blob([JSON.stringify(validation.parsedQuiz, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${validation.parsedQuiz.publicationDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section style={{ display: "grid", gap: 24 }}>
      <div style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 8px" }}>Quizzes</h2>
            <p style={{ margin: 0, color: "#475569" }}>
              Draft, edit, schedule, publish, archive, and restore content in D1.
            </p>
          </div>
          <button type="button" onClick={startNew} style={primaryButtonStyle}>Create draft</button>
        </header>
        {loading ? <p>Loading quizzes…</p> : null}
        {!loading && quizzes.length === 0 ? <p>No quizzes yet. Create a draft or import a JSON file.</p> : null}
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          {quizzes.map((quiz) => (
            <article key={quiz.id} style={quizCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px" }}>{quiz.title}</h3>
                  <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
                    {quiz.publicationDate} · {quiz.topic} · {quiz.questionCount} questions
                    {quiz.scheduledAt ? ` · Scheduled ${formatTimestamp(quiz.scheduledAt, quiz.timezone)}` : ""}
                    {quiz.publishedAt ? ` · Published ${formatTimestamp(quiz.publishedAt, quiz.timezone)}` : ""}
                  </p>
                </div>
                {quiz.validationErrors.length > 0 && (
                  <ul style={{ color: "#b91c1c", margin: "12px 0 0", paddingLeft: 20 }}>
                    {quiz.validationErrors.map((issue, index) => (
                      <li key={`${issue.code}-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                )}
                <strong style={{ color: statusColors[quiz.status], textTransform: "capitalize" }}>{quiz.status}</strong>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                {(quiz.status === "draft" || quiz.status === "validated") && (
                  <>
                    <button type="button" onClick={() => editQuiz(quiz)} style={buttonStyle}>Edit / preview</button>
                    <button type="button" disabled={busy !== ""} onClick={() => void runAction(quiz, "publish")} style={buttonStyle}>Publish now</button>
                    <button type="button" disabled={busy !== ""} onClick={() => void runAction(quiz, "schedule")} style={buttonStyle}>Schedule</button>
                  </>
                )}
                {(quiz.status === "published" || quiz.status === "scheduled") && (
                  <button type="button" disabled={busy !== ""} onClick={() => void runAction(quiz, "unpublish")} style={buttonStyle}>Unpublish</button>
                )}
                {quiz.status !== "archived" && (
                  <button type="button" disabled={busy !== ""} onClick={() => void runAction(quiz, "archive")} style={buttonStyle}>Archive</button>
                )}
                {quiz.status === "archived" && (
                  <button type="button" disabled={busy !== ""} onClick={() => void runAction(quiz, "restore")} style={buttonStyle}>Restore as draft</button>
                )}
              </div>
              {(quiz.status === "draft" || quiz.status === "validated") && (
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginTop: 12, color: "#475569", fontSize: 14 }}>
                  Schedule time (your local timezone)
                  <input
                    type="datetime-local"
                    value={scheduleInput}
                    onChange={(event) => setScheduleInput(event.target.value)}
                    aria-label={`Schedule ${quiz.title}`}
                  />
                </label>
              )}
            </article>
          ))}
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>{editingId ? "Edit draft" : "Import or create a draft"}</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <label style={buttonStyle}>
            Import quiz JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void loadFile(event.target.files?.[0])}
              style={{ display: "none" }}
            />
          </label>
          <button type="button" onClick={loadSample} style={buttonStyle}>Load Java sample</button>
          <button type="button" onClick={exportEditor} style={buttonStyle}>Download JSON backup</button>
        </div>
        <textarea
          value={editor}
          onChange={(event) => {
            setEditor(event.target.value);
            setReport(null);
          }}
          onBlur={() => editor && validateEditor(editor)}
          aria-label="Quiz JSON editor"
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 380,
            boxSizing: "border-box",
            padding: 16,
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            fontFamily: "Consolas, monospace",
            fontSize: 13,
          }}
        />
        {report && (
          <div aria-live="polite" style={{ marginTop: 12 }}>
            <strong style={{ color: report.valid ? "#15803d" : "#b91c1c" }}>
              {report.valid ? "Validation passed." : `Validation failed (${report.errors.length} errors).`}
            </strong>
            {report.errors.map((issue, index) => (
              <p key={`${issue.code}-${index}`} style={{ margin: "6px 0", color: "#b91c1c" }}>
                {issue.field ? `${issue.field}: ` : ""}{issue.message}
              </p>
            ))}
            {report.warnings.map((issue, index) => (
              <p key={`${issue.code}-${index}`} style={{ margin: "6px 0", color: "#a16207" }}>
                {issue.message}
              </p>
            ))}
          </div>
        )}
        {report?.valid && report.parsedQuiz && (
          <div style={{ marginTop: 20 }}>
            <h3>Quiz preview</h3>
            <QuizPlayer quiz={report.parsedQuiz} />
          </div>
        )}
        {error && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => validateEditor(editor)} style={buttonStyle}>Validate / preview</button>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => void saveDraft()} style={primaryButtonStyle}>
            {busy === "save" ? "Saving…" : "Save as draft"}
          </button>
          {editingId && <button type="button" onClick={startNew} style={buttonStyle}>Cancel edit</button>}
        </div>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          Imported quizzes are always saved as drafts. Publication validates the content again on the server.
          Scheduling is stored in UTC; the selected browser-local time is converted before saving.
        </p>
      </div>
    </section>
  );
}

const panelStyle = {
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(148,163,184,0.3)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 14px 28px rgba(15,23,42,0.05)",
};

const quizCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
};

const buttonStyle = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#fff",
  padding: "9px 12px",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryButtonStyle = {
  ...buttonStyle,
  border: "1px solid #1d4ed8",
  background: "#2563eb",
  color: "#fff",
};
