"use client";

import { useCallback, useEffect, useState } from "react";
import javaSampleQuiz from "../../java-quiz-sample.json";
import { QuizPlayer } from "./quiz-player";
import { validateQuizJsonString } from "../lib/quiz-validator";
import { dateTimeLocalToUtc } from "../lib/quiz-publishing";
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
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, string>>({});
  const [selectedForSchedule, setSelectedForSchedule] = useState<string[]>([]);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkPreview, setBulkPreview] = useState<Array<{
    index: number;
    valid: boolean;
    id?: string;
    title?: string;
    publicationDate?: string;
    errors: string[];
  }>>([]);
  const [bulkResults, setBulkResults] = useState<string[]>([]);
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
      const scheduleInput = scheduleInputs[quiz.id];
      if (!scheduleInput) {
        setError(`Choose a schedule time for "${quiz.title}" first.`);
        return;
      }
      if (!scheduleInput.startsWith(`${quiz.publicationDate}T`)) {
        setError(
          `Choose a time on ${quiz.publicationDate} in ${quiz.timezone}; scheduled quizzes must publish on their quiz date.`,
        );
        return;
      }
      const converted = dateTimeLocalToUtc(scheduleInput, quiz.timezone);
      if ("error" in converted) {
        setError(converted.error);
        return;
      }
      if (Date.parse(converted.scheduledAt) <= Date.now()) {
        setError("Choose a future publication time.");
        return;
      }
      scheduledAt = converted.scheduledAt;
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
      if (action === "schedule") {
        setScheduleInputs((current) => {
          const next = { ...current };
          delete next[quiz.id];
          return next;
        });
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

  const parseBulkQuizzes = (): unknown[] | null => {
    try {
      const parsed: unknown = JSON.parse(bulkJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      if (items.length === 0) throw new Error("Provide at least one quiz.");
      if (items.length > 100) throw new Error("Imports are limited to 100 quizzes at a time.");

      const seenIds = new Set<string>();
      const seenDates = new Set<string>();
      const seenQuestionIds = new Set<string>();
      const preview = items.map((item, index) => {
        const result = validateQuizJsonString(JSON.stringify(item), `bulk-item-${index + 1}.json`);
        if (!result.valid || !result.parsedQuiz) {
          return {
            index,
            valid: false,
            errors: result.errors.map((issue) => `${issue.field ? `${issue.field}: ` : ""}${issue.message}`),
          };
        }

        const quiz = result.parsedQuiz;
        const errors: string[] = [];
        if (seenIds.has(quiz.id) || quizzes.some((existing) => existing.id === quiz.id)) {
          errors.push(`Duplicate quiz ID "${quiz.id}".`);
        }
        if (
          seenDates.has(quiz.publicationDate) ||
          quizzes.some((existing) => existing.publicationDate === quiz.publicationDate)
        ) {
          errors.push(`Publication date "${quiz.publicationDate}" already exists.`);
        }
        const questionConflict = quiz.questions.find((question) =>
          seenQuestionIds.has(question.id),
        );
        if (questionConflict) errors.push(`Question ID "${questionConflict.id}" is duplicated in this batch.`);
        quiz.questions.forEach((question) => seenQuestionIds.add(question.id));
        seenIds.add(quiz.id);
        seenDates.add(quiz.publicationDate);
        return {
          index,
          valid: errors.length === 0,
          id: quiz.id,
          title: quiz.title,
          publicationDate: quiz.publicationDate,
          errors,
        };
      });
      setBulkPreview(preview);
      setBulkResults([]);
      setError("");
      return items;
    } catch (parseError) {
      setBulkPreview([]);
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON.");
      return null;
    }
  };

  const importBulkQuizzes = async () => {
    const items = parseBulkQuizzes();
    if (!items) return;
    setBusy("bulk-import");
    setError("");
    try {
      const response = await fetch("/api/admin/quizzes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", quizzes: items }),
      });
      const result = await response.json() as {
        error?: string;
        results?: Array<{ index: number; id?: string; publicationDate?: string; status: string; errors?: string[] }>;
      };
      if (!response.ok || !result.results) throw new Error(result.error ?? "Bulk import failed.");
      setBulkResults(result.results.map((item) =>
        `Item ${item.index + 1}${item.id ? ` · ${item.id} · ${item.publicationDate}` : ""}: ${item.status}${item.errors?.length ? ` — ${item.errors.join(" ")}` : ""}`,
      ));
      await loadQuizzes();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Bulk import failed.");
    } finally {
      setBusy("");
    }
  };

  const bulkScheduleQuizzes = async () => {
    const items = selectedForSchedule.map((id) => {
      const quiz = quizzes.find((entry) => entry.id === id);
      const localValue = scheduleInputs[id];
      if (!quiz || !localValue || !localValue.startsWith(`${quiz.publicationDate}T`)) {
        return { id, scheduledAt: "", invalid: true };
      }
      const converted = dateTimeLocalToUtc(localValue, quiz.timezone);
      if ("error" in converted || Date.parse(converted.scheduledAt) <= Date.now()) {
        return { id, scheduledAt: "", invalid: true };
      }
      return { id, scheduledAt: converted.scheduledAt, invalid: false };
    });
    if (items.length === 0 || items.some((item) => item.invalid)) {
      setError("Select draft quizzes and choose a future schedule time on each quiz date.");
      return;
    }
    setBusy("bulk-schedule");
    setError("");
    try {
      const response = await fetch("/api/admin/quizzes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          items: items.map(({ id, scheduledAt }) => ({ id, scheduledAt })),
        }),
      });
      const result = await response.json() as {
        error?: string;
        results?: Array<{ id: string; status: string; error?: string }>;
      };
      if (!response.ok || !result.results) throw new Error(result.error ?? "Bulk scheduling failed.");
      setBulkResults(result.results.map((item) => `${item.id}: ${item.status}${item.error ? ` — ${item.error}` : ""}`));
      setSelectedForSchedule([]);
      await loadQuizzes();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Bulk scheduling failed.");
    } finally {
      setBusy("");
    }
  };

  const downloadQuizTemplate = () => {
    const blob = new Blob([JSON.stringify(javaSampleQuiz, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "qodlume-quiz-template.json";
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
        {error && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
        {!loading && quizzes.length === 0 ? <p>No quizzes yet. Create a draft or import a JSON file.</p> : null}
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <button
            type="button"
            disabled={selectedForSchedule.length === 0 || busy !== ""}
            onClick={() => void bulkScheduleQuizzes()}
            style={buttonStyle}
          >
            Schedule selected ({selectedForSchedule.length})
          </button>
          {quizzes.map((quiz) => (
            <article key={quiz.id} style={quizCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  {(quiz.status === "draft" || quiz.status === "validated") && (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={selectedForSchedule.includes(quiz.id)}
                        onChange={(event) => setSelectedForSchedule((current) =>
                          event.target.checked
                            ? [...current, quiz.id]
                            : current.filter((id) => id !== quiz.id),
                        )}
                        aria-label={`Select ${quiz.title} for bulk scheduling`}
                      />
                      Select to schedule
                    </label>
                  )}
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
                  Schedule time ({quiz.timezone})
                  <input
                    type="datetime-local"
                    value={scheduleInputs[quiz.id] ?? ""}
                    onChange={(event) => {
                      setScheduleInputs((current) => ({
                        ...current,
                        [quiz.id]: event.target.value,
                      }));
                      setError("");
                    }}
                    aria-label={`Schedule ${quiz.title}`}
                  />
                </label>
              )}
            </article>
          ))}
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Bulk quiz import</h2>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          Paste one quiz or a JSON array, or select a JSON file. Valid entries are saved as drafts; existing IDs or publication dates are never replaced.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={buttonStyle}>
            Choose JSON file
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setBulkJson(await file.text());
                  setBulkPreview([]);
                  setBulkResults([]);
                }
                event.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          <button type="button" onClick={downloadQuizTemplate} style={buttonStyle}>Download quiz template</button>
        </div>
        <textarea
          value={bulkJson}
          onChange={(event) => {
            setBulkJson(event.target.value);
            setBulkPreview([]);
            setBulkResults([]);
          }}
          aria-label="Paste quiz JSON for bulk import"
          placeholder='{"id":"quiz-id", ...} or [{...}, {...}]'
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 220,
            boxSizing: "border-box",
            padding: 16,
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            fontFamily: "Consolas, monospace",
            fontSize: 13,
          }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" disabled={!bulkJson || busy !== ""} onClick={() => void parseBulkQuizzes()} style={buttonStyle}>
            Validate / preview
          </button>
          <button type="button" disabled={!bulkJson || busy !== ""} onClick={() => void importBulkQuizzes()} style={primaryButtonStyle}>
            {busy === "bulk-import" ? "Importing…" : "Import drafts"}
          </button>
        </div>
        {bulkPreview.length > 0 && (
          <ol style={{ display: "grid", gap: 8, paddingLeft: 24 }}>
            {bulkPreview.map((item) => (
              <li key={item.index} style={{ color: item.valid ? "#15803d" : "#b91c1c" }}>
                {item.title ?? `Item ${item.index + 1}`} {item.id ? `· ${item.id} · ${item.publicationDate}` : ""}
                {item.valid ? " — valid" : ` — ${item.errors.join(" ")}`}
              </li>
            ))}
          </ol>
        )}
        {bulkResults.length > 0 && (
          <div aria-live="polite" style={{ marginTop: 12 }}>
            <strong>Bulk operation results</strong>
            {bulkResults.map((item) => <p key={item} style={{ margin: "6px 0", color: "#334155" }}>{item}</p>)}
          </div>
        )}
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
          Choose a time on the quiz’s publication date in its displayed timezone. Scheduling is stored in UTC.
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
