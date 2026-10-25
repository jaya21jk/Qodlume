"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DAILY_GAME_CONFIGURATIONS,
  DAILY_GAME_TYPES,
  type DailyGameChallenge,
  type DailyGameType,
} from "../types/daily-game-challenge";
import {
  dateTimeLocalToUtc,
  dateTimeUtcToLocal,
  resolveImportPublication,
} from "../lib/quiz-publishing";
import { validateDailyGameChallenge } from "../lib/daily-game-challenges";

const GAME_TITLES: Record<DailyGameType, string> = {
  "reaction-time": "Reaction Time Challenge",
  "word-guess": "Word Guess",
  "memory-match": "Memory Match",
};

const fieldLabelStyle = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontWeight: 700,
};

const STATUS_COLORS: Record<DailyGameChallenge["status"], string> = {
  draft: "#64748b",
  scheduled: "#7c3aed",
  published: "#15803d",
  unpublished: "#b45309",
};

type ValidationResult = { valid: boolean; errors: string[] };
type ApiResult = {
  error?: string;
  validation?: ValidationResult;
  challenges?: DailyGameChallenge[];
  challenge?: DailyGameChallenge;
};

function makeNewChallenge<GameType extends DailyGameType>(
  gameType: GameType,
): Extract<DailyGameChallenge, { gameType: GameType }> {
  return {
    id: "",
    publicationDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    timezone: "Asia/Kolkata",
    status: "draft",
    gameType,
    title: GAME_TITLES[gameType],
    description: `Today's ${GAME_TITLES[gameType]} challenge.`,
    configuration: DEFAULT_DAILY_GAME_CONFIGURATIONS[gameType],
  } as Extract<DailyGameChallenge, { gameType: GameType }>;
}

function dateTimeLocalToUtcSafe(value: string, timezone: string): string | undefined {
  const converted = dateTimeLocalToUtc(value, timezone);
  return "error" in converted ? undefined : converted.scheduledAt;
}

function formatChallengeTimestamp(value: string, timezone: string): string {
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

export function DailyGameChallengeConsole({
  view,
}: {
  view: "import" | "manage";
}) {
  const [challenges, setChallenges] = useState<DailyGameChallenge[]>([]);
  const [editor, setEditor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGameType, setSelectedGameType] = useState<DailyGameType>("word-guess");
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, string>>({});
  const [selectedForSchedule, setSelectedForSchedule] = useState<string[]>([]);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkPreviewMode, setBulkPreviewMode] = useState<"draft" | "schedule" | "publish" | null>(null);
  const [bulkPreview, setBulkPreview] = useState<Array<{
    index: number;
    valid: boolean;
    title?: string;
    gameType?: string;
    publicationDate?: string;
    status?: "draft" | "scheduled" | "published";
    timezone?: string;
    scheduledAt?: string;
    errors: string[];
  }>>([]);
  const [bulkResult, setBulkResult] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const loadChallenges = useCallback(async () => {
    if (view !== "manage") return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/daily-game-challenges", { cache: "no-store" });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(result.error ?? "Unable to load challenges.");
      setChallenges(result.challenges ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load challenges.");
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  const validateEditor = (): DailyGameChallenge | undefined => {
    try {
      const result = validateDailyGameChallenge(JSON.parse(editor));
      setValidation({ valid: result.valid, errors: result.errors });
      return result.challenge;
    } catch {
      setValidation({ valid: false, errors: ["Enter a valid JSON object."] });
      return undefined;
    }
  };

  const updateEditorField = (field: string, value: unknown) => {
    try {
      const parsed: unknown = JSON.parse(editor);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
      const next: Record<string, unknown> = { ...parsed };
      if (field.startsWith("configuration.")) {
        const configurationValue = next.configuration;
        const configuration: Record<string, unknown> =
          typeof configurationValue === "object" &&
          configurationValue !== null &&
          !Array.isArray(configurationValue)
            ? configurationValue as Record<string, unknown>
            : {};
        next.configuration = {
          ...configuration,
          [field.slice("configuration.".length)]: value,
        };
      } else {
        next[field] = value;
      }
      setEditor(JSON.stringify(next, null, 2));
      setValidation(null);
    } catch {
      setValidation({ valid: false, errors: ["Fix the JSON syntax before using the form fields."] });
    }
  };

  const updateEditorConfiguration = (values: Record<string, unknown>) => {
    try {
      const parsed: unknown = JSON.parse(editor);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
      const parsedRecord = parsed as Record<string, unknown>;
      const configurationValue = parsedRecord.configuration;
      const configuration: Record<string, unknown> =
        typeof configurationValue === "object" &&
        configurationValue !== null &&
        !Array.isArray(configurationValue)
          ? configurationValue as Record<string, unknown>
          : {};
      setEditor(JSON.stringify({
        ...parsedRecord,
        configuration: { ...configuration, ...values },
      }, null, 2));
      setValidation(null);
    } catch {
      setValidation({ valid: false, errors: ["Fix the JSON syntax before using the form fields."] });
    }
  };

  const startNew = (gameType = selectedGameType) => {
    setSelectedGameType(gameType);
    setEditingId(null);
    setEditor(JSON.stringify(makeNewChallenge(gameType), null, 2));
    setValidation(null);
    setError("");
  };

  const editChallenge = async (challenge: DailyGameChallenge) => {
    setBusy(`load:${challenge.id}`);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/daily-game-challenges/${encodeURIComponent(challenge.id)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.challenge) {
        throw new Error(result.error ?? "Unable to load challenge for editing.");
      }
      setEditingId(challenge.id);
      setSelectedGameType(challenge.gameType);
      setEditor(JSON.stringify(result.challenge, null, 2));
      setValidation(null);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Unable to load challenge.");
    } finally {
      setBusy("");
    }
  };

  const saveDraft = async () => {
    const challenge = validateEditor();
    if (!challenge) {
      setError("Fix the challenge content before saving.");
      return;
    }

    setBusy("save");
    setError("");
    try {
      const response = await fetch(
        editingId
          ? `/api/admin/daily-game-challenges/${encodeURIComponent(editingId)}`
          : "/api/admin/daily-game-challenges",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challenge: {
              ...challenge,
              id: editingId ?? "",
              status: "draft",
            },
          }),
        },
      );
      const result = (await response.json()) as ApiResult;
      if (!response.ok || !result.challenge) {
        if (result.validation) setValidation(result.validation);
        throw new Error(result.error ?? "Unable to save draft.");
      }
      setEditingId(result.challenge.id);
      setEditor(JSON.stringify(result.challenge, null, 2));
      await loadChallenges();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft.");
    } finally {
      setBusy("");
    }
  };

  const scheduleEditor = async () => {
    const challenge = validateEditor();
    if (!challenge) {
      setError("Fix the challenge content before scheduling.");
      return;
    }
    const publication = resolveImportPublication(
      "schedule",
      challenge.publicationDate,
      challenge.timezone,
      challenge.scheduledAt,
    );
    if ("error" in publication) {
      setError(publication.error);
      return;
    }
    if (publication.status !== "scheduled") return;

    const endpoint = editingId
      ? `/api/admin/daily-game-challenges/${encodeURIComponent(editingId)}`
      : "/api/admin/daily-game-challenges";
    setBusy("schedule-editor");
    setError("");
    try {
      const saveResponse = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: {
            ...challenge,
            id: editingId ?? "",
            status: "draft",
            scheduledAt: undefined,
          },
        }),
      });
      const saved = (await saveResponse.json()) as ApiResult;
      if (!saveResponse.ok || !saved.challenge) {
        if (saved.validation) setValidation(saved.validation);
        throw new Error(saved.error ?? "Unable to save challenge before scheduling.");
      }

      const scheduleResponse = await fetch(
        `/api/admin/daily-game-challenges/${encodeURIComponent(saved.challenge.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "schedule",
            scheduledAt: publication.scheduledAt,
          }),
        },
      );
      const result = (await scheduleResponse.json()) as ApiResult;
      if (!scheduleResponse.ok || !result.challenge) {
        throw new Error(`Challenge saved as a draft, but scheduling failed: ${result.error ?? "Unable to schedule publication."}`);
      }
      setEditingId(null);
      setEditor(JSON.stringify(result.challenge, null, 2));
      await loadChallenges();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Unable to schedule challenge.");
      await loadChallenges();
    } finally {
      setBusy("");
    }
  };

  const publishEditor = async () => {
    const challenge = validateEditor();
    if (!challenge) {
      setError("Fix the challenge content before publishing.");
      return;
    }
    if (
      !window.confirm(
        `Publish "${challenge.title}" now for ${challenge.publicationDate}?`,
      )
    ) {
      return;
    }

    const endpoint = editingId
      ? `/api/admin/daily-game-challenges/${encodeURIComponent(editingId)}`
      : "/api/admin/daily-game-challenges";
    setBusy("publish-editor");
    setError("");
    try {
      const saveResponse = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: {
            ...challenge,
            id: editingId ?? "",
            status: "draft",
            scheduledAt: undefined,
          },
        }),
      });
      const saved = (await saveResponse.json()) as ApiResult;
      if (!saveResponse.ok || !saved.challenge) {
        if (saved.validation) setValidation(saved.validation);
        throw new Error(saved.error ?? "Unable to save challenge before publishing.");
      }

      const publishResponse = await fetch(
        `/api/admin/daily-game-challenges/${encodeURIComponent(saved.challenge.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        },
      );
      const result = (await publishResponse.json()) as ApiResult;
      if (!publishResponse.ok || !result.challenge) {
        throw new Error(
          `Challenge saved as a draft, but publishing failed: ${result.error ?? "Unable to publish now."}`,
        );
      }
      setEditingId(null);
      setEditor(JSON.stringify(result.challenge, null, 2));
      await loadChallenges();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish challenge.");
      await loadChallenges();
    } finally {
      setBusy("");
    }
  };

  const runAction = async (challenge: DailyGameChallenge, action: "publish" | "schedule" | "unpublish") => {
    let scheduledAt: string | undefined;
    if (action === "schedule") {
      const localValue = scheduleInputs[challenge.id] ??
        (challenge.scheduledAt
          ? dateTimeUtcToLocal(challenge.scheduledAt, challenge.timezone)
          : undefined) ??
        `${challenge.publicationDate}T00:00`;
      if (!localValue.startsWith(`${challenge.publicationDate}T`)) {
        setError(`Schedule time must be on ${challenge.publicationDate} in ${challenge.timezone}.`);
        return;
      }
      scheduledAt = dateTimeLocalToUtcSafe(localValue, challenge.timezone);
      if (!scheduledAt || Date.parse(scheduledAt) <= Date.now()) {
        setError("Choose a valid future schedule time.");
        return;
      }
    }
    if (action === "unpublish" && !window.confirm(`Unpublish "${challenge.title}"?`)) return;

    setBusy(`${action}:${challenge.id}`);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/daily-game-challenges/${encodeURIComponent(challenge.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, scheduledAt }),
        },
      );
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        if (result.validation) setValidation(result.validation);
        throw new Error(result.error ?? "Unable to update challenge status.");
      }
      if (action === "schedule") {
        setScheduleInputs((current) => {
          const next = { ...current };
          delete next[challenge.id];
          return next;
        });
      }
      await loadChallenges();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update challenge status.");
    } finally {
      setBusy("");
    }
  };

  const parseBulkChallenges = (mode: "draft" | "schedule" | "publish" = "draft"): unknown[] | null => {
    try {
      const parsed: unknown = JSON.parse(bulkJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      if (items.length === 0) throw new Error("Provide at least one challenge.");
      if (items.length > 100) throw new Error("Imports are limited to 100 challenges at a time.");

      const seen = new Set<string>();
      const preview = items.map((item, index) => {
        const report = validateDailyGameChallenge(item);
        if (!report.valid || !report.challenge) {
          return { index, valid: false, errors: report.errors };
        }
        const challenge = report.challenge;
        const key = `${challenge.gameType}:${challenge.publicationDate}`;
        const existingChallenge = challenges.find(
          (existing) =>
            existing.gameType === challenge.gameType &&
            existing.publicationDate === challenge.publicationDate,
        );
        const canScheduleExistingDraft =
          mode !== "draft" &&
          (existingChallenge?.status === "draft" ||
            existingChallenge?.status === "unpublished");
        const duplicate =
          seen.has(key) ||
          (Boolean(existingChallenge) && !canScheduleExistingDraft);
        seen.add(key);
        const publication = resolveImportPublication(
          mode,
          challenge.publicationDate,
          challenge.timezone,
          challenge.scheduledAt,
        );
        const errors = [
          ...(duplicate ? ["A challenge for this game and date already exists or is repeated in this batch."] : []),
          ...("error" in publication ? [publication.error] : []),
        ];
        return {
          index,
          valid: errors.length === 0,
          title: challenge.title,
          gameType: challenge.gameType,
          publicationDate: challenge.publicationDate,
          status: "error" in publication ? undefined : publication.status,
          timezone: challenge.timezone,
          scheduledAt: !("error" in publication) && publication.status === "scheduled"
            ? publication.scheduledAt
            : challenge.scheduledAt,
          errors,
        };
      });
      setBulkPreview(preview);
      setBulkPreviewMode(mode);
      setBulkResult([]);
      setError("");
      return items;
    } catch (parseError) {
      setBulkPreview([]);
      setError(parseError instanceof Error ? parseError.message : "Invalid JSON.");
      return null;
    }
  };

  const importBulkChallenges = async (mode: "draft" | "schedule" | "publish") => {
    if (bulkPreviewMode !== mode || bulkPreview.length === 0) {
      parseBulkChallenges(mode);
      return;
    }
    const validCount = bulkPreview.filter((item) => item.valid).length;
    if (validCount === 0) {
      setError("There are no valid challenges to import.");
      return;
    }
    if (!window.confirm(
      `${mode === "draft" ? "Save" : mode === "publish" ? "Publish now" : "Schedule"} ${validCount} valid game challenge${validCount === 1 ? "" : "s"}? Invalid records will be skipped and reported.`,
    )) return;
    let items: unknown[];
    try {
      const parsed: unknown = JSON.parse(bulkJson);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      setError("The import JSON changed. Validate it again before confirming.");
      return;
    }
    setBusy("bulk-import");
    setError("");
    try {
      const response = await fetch("/api/admin/daily-game-challenges/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", mode, challenges: items }),
      });
      const result = (await response.json()) as {
        error?: string;
        results?: Array<{ index: number; status: string; publicationStatus?: string; timezone?: string; scheduledAt?: string; errors?: string[]; publicationDate?: string; gameType?: string }>;
      };
      if (!response.ok || !result.results) {
        throw new Error(result.error ?? "Bulk import failed.");
      }
      setBulkResult(result.results.map((item) =>
        `Item ${item.index + 1}${item.gameType ? ` · ${item.gameType} · ${item.publicationDate}` : ""}: ${item.publicationStatus ?? item.status}${item.scheduledAt ? ` · ${formatChallengeTimestamp(item.scheduledAt, item.timezone ?? "Asia/Kolkata")}` : ""}${item.errors?.length ? ` — ${item.errors.join(" ")}` : ""}`,
      ));
      await loadChallenges();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Bulk import failed.");
    } finally {
      setBusy("");
    }
  };

  const bulkSchedule = async () => {
    const items = selectedForSchedule.map((id) => {
      const challenge = challenges.find((item) => item.id === id);
      const localValue = challenge
        ? scheduleInputs[id] ??
          (challenge.scheduledAt
            ? dateTimeUtcToLocal(challenge.scheduledAt, challenge.timezone)
            : undefined) ??
          `${challenge.publicationDate}T00:00`
        : "";
      if (!challenge || !localValue.startsWith(`${challenge.publicationDate}T`)) {
        return { id, scheduledAt: "", invalid: true };
      }
      const scheduledAt = dateTimeLocalToUtcSafe(localValue, challenge.timezone);
      return { id, scheduledAt: scheduledAt ?? "", invalid: !scheduledAt || Date.parse(scheduledAt) <= Date.now() };
    });
    if (items.length === 0 || items.some((item) => item.invalid)) {
      setError("Select draft challenges and choose a valid future time on each challenge date.");
      return;
    }

    setBusy("bulk-schedule");
    setError("");
    try {
      const response = await fetch("/api/admin/daily-game-challenges/bulk", {
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
      setBulkResult(result.results.map((item) => `${item.id}: ${item.status}${item.error ? ` — ${item.error}` : ""}`));
      setSelectedForSchedule([]);
      await loadChallenges();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Bulk scheduling failed.");
    } finally {
      setBusy("");
    }
  };

  const downloadTemplate = (gameType: DailyGameType) => {
    const template = makeNewChallenge(gameType);
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${gameType}-daily-challenge-template.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const editorChallenge = editor ? validatePreviewJson(editor) : null;
  const editorSchedulePreview = editorChallenge
    ? resolveImportPublication(
        "schedule",
        editorChallenge.publicationDate,
        editorChallenge.timezone,
        editorChallenge.scheduledAt,
      )
    : null;

  return (
    <section style={{ display: "grid", gap: 20 }}>
      {view === "manage" ? (
      <div className="admin-content-panel" style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 8px" }}>Daily game challenges</h2>
            <p style={{ margin: 0, color: "#475569" }}>
              Manage game content in D1. Published challenges are locked against accidental edits.
            </p>
          </div>
          <button type="button" onClick={() => startNew()} style={primaryButtonStyle}>Create challenge</button>
        </header>

        {loading ? <p>Loading challenges…</p> : null}
        {error && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
        {!loading && challenges.length === 0 ? <p>No game challenges yet. Create a draft to get started.</p> : null}

        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={selectedForSchedule.length === 0 || busy !== ""}
              onClick={() => void bulkSchedule()}
              style={buttonStyle}
            >
              Schedule selected ({selectedForSchedule.length})
            </button>
          </div>
          {challenges.map((challenge) => (
            <article key={challenge.id} style={challengeCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  {(challenge.status === "draft" || challenge.status === "unpublished") && (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={selectedForSchedule.includes(challenge.id)}
                        onChange={(event) => setSelectedForSchedule((current) =>
                          event.target.checked
                            ? [...current, challenge.id]
                            : current.filter((id) => id !== challenge.id),
                        )}
                        aria-label={`Select ${challenge.title} for bulk scheduling`}
                      />
                      Select to schedule
                    </label>
                  )}
                  <h3 style={{ margin: "0 0 6px" }}>{challenge.title}</h3>
                  <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
                    {challenge.publicationDate} · {challenge.timezone} · {GAME_TITLES[challenge.gameType]}
                            {challenge.scheduledAt ? ` · ${challenge.status === "draft" || challenge.status === "unpublished" ? "Configured" : "Scheduled"} ${formatChallengeTimestamp(challenge.scheduledAt, challenge.timezone)}` : ""}
                  </p>
                </div>
                <strong style={{ color: STATUS_COLORS[challenge.status], textTransform: "capitalize" }}>
                  {challenge.status}
                </strong>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                <button type="button" disabled={busy !== ""} onClick={() => void editChallenge(challenge)} style={buttonStyle}>
                  Edit / preview
                </button>
                {(challenge.status === "draft" || challenge.status === "unpublished") && (
                  <>
                    <button type="button" disabled={busy !== ""} onClick={() => void runAction(challenge, "publish")} style={buttonStyle}>
                      Publish now
                    </button>
                    <button type="button" disabled={busy !== ""} onClick={() => void runAction(challenge, "schedule")} style={buttonStyle}>
                      Schedule Publication
                    </button>
                  </>
                )}
                {(challenge.status === "published" || challenge.status === "scheduled") && (
                  <button type="button" disabled={busy !== ""} onClick={() => void runAction(challenge, "unpublish")} style={buttonStyle}>
                    Unpublish
                  </button>
                )}
              </div>

              {(challenge.status === "draft" || challenge.status === "unpublished") && (
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginTop: 12, color: "#475569", fontSize: 14, flexWrap: "wrap" }}>
                  Schedule ({challenge.timezone})
                  <input
                    type="datetime-local"
                    value={scheduleInputs[challenge.id] ??
                      (challenge.scheduledAt
                        ? dateTimeUtcToLocal(challenge.scheduledAt, challenge.timezone)
                        : undefined) ??
                      `${challenge.publicationDate}T00:00`}
                    onChange={(event) => setScheduleInputs((current) => ({ ...current, [challenge.id]: event.target.value }))}
                    aria-label={`Schedule ${challenge.title}`}
                  />
                </label>
              )}
            </article>
          ))}
        </div>
      </div>
      ) : null}

      {view === "import" ? (
      <div className="admin-content-panel" style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Import games</h2>
        <p style={{ color: "#475569", lineHeight: 1.6 }}>
          Preview each record before saving it as a draft, scheduling it, or publishing it immediately. Scheduled records without an explicit time use midnight in their timezone. Duplicates are reported rather than replaced.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
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
                  setBulkPreviewMode(null);
                  setBulkResult([]);
                  setError("");
                }
                event.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </label>
          {DAILY_GAME_TYPES.map((gameType) => (
            <button key={gameType} type="button" onClick={() => downloadTemplate(gameType)} style={buttonStyle}>
              Download {GAME_TITLES[gameType]} template
            </button>
          ))}
        </div>
        <textarea
          value={bulkJson}
          onChange={(event) => {
            setBulkJson(event.target.value);
            setBulkPreview([]);
            setBulkPreviewMode(null);
            setBulkResult([]);
          }}
          aria-label="Paste daily game challenge JSON"
          placeholder='{"gameType":"word-guess", ...} or [{...}, {...}]'
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
          <button type="button" disabled={!bulkJson || busy !== ""} onClick={() => void parseBulkChallenges(bulkPreviewMode ?? "draft")} style={buttonStyle}>
            Preview {bulkPreviewMode ?? "draft"} import
          </button>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            Preview mode
            <select
              value={bulkPreviewMode ?? "draft"}
              onChange={(event) => {
                parseBulkChallenges(event.target.value as "draft" | "schedule" | "publish");
              }}
              aria-label="Bulk game preview mode"
            >
              <option value="draft">Save all as Draft</option>
              <option value="schedule">Schedule valid records</option>
              <option value="publish">Publish now</option>
            </select>
          </label>
          <button type="button" disabled={!bulkJson || busy !== ""} onClick={() => void importBulkChallenges("draft")} style={buttonStyle}>
            {busy === "bulk-import" ? "Saving…" : "Save all as Draft"}
          </button>
          <button type="button" disabled={!bulkJson || busy !== ""} onClick={() => void importBulkChallenges("schedule")} style={primaryButtonStyle}>
            {busy === "bulk-import" ? "Scheduling…" : "Schedule valid records"}
          </button>
          <button type="button" disabled={!bulkJson || busy !== ""} onClick={() => void importBulkChallenges("publish")} style={primaryButtonStyle}>
            {busy === "bulk-import" ? "Publishing…" : "Publish valid records now"}
          </button>
        </div>
        {bulkPreview.length > 0 && (
          <ol style={{ display: "grid", gap: 8, paddingLeft: 24 }}>
            {bulkPreview.map((item) => (
              <li key={item.index} style={{ color: item.valid ? "#15803d" : "#b91c1c" }}>
                {item.title ?? `Item ${item.index + 1}`} {item.gameType ? `· ${item.gameType} · ${item.publicationDate}` : ""}
                {item.timezone ? ` · ${item.timezone}` : ""}
                {item.status ? ` · ${item.status}` : ""}
                {item.scheduledAt ? ` · ${formatChallengeTimestamp(item.scheduledAt, item.timezone ?? "Asia/Kolkata")}` : ""}
                {!item.valid ? ` — ${item.errors.join(" ")}` : " — valid"}
              </li>
            ))}
          </ol>
        )}
        {bulkResult.length > 0 && (
          <div aria-live="polite" style={{ marginTop: 12 }}>
            <strong>Import / schedule results</strong>
            {bulkResult.map((item) => <p key={item} style={{ margin: "6px 0", color: "#334155" }}>{item}</p>)}
          </div>
        )}
      </div>
      ) : null}

      {view === "manage" ? (
      <div className="admin-content-panel" style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>{editingId ? "Edit challenge draft" : "Create or import a challenge"}</h2>
        {!editingId && (
          <label style={{ display: "grid", gap: 6, maxWidth: 360, marginBottom: 14 }}>
            Game type
            <select
              value={selectedGameType}
              onChange={(event) => startNew(event.target.value as DailyGameType)}
              style={inputStyle}
            >
              {DAILY_GAME_TYPES.map((gameType) => (
                <option key={gameType} value={gameType}>{GAME_TITLES[gameType]}</option>
              ))}
            </select>
          </label>
        )}

        {editorChallenge && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
            <label style={fieldLabelStyle}>
              Publication date
              <input
                type="date"
                value={editorChallenge.publicationDate}
                onChange={(event) => updateEditorField("publicationDate", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Timezone
              <input
                value={editorChallenge.timezone}
                onChange={(event) => updateEditorField("timezone", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Title
              <input
                value={editorChallenge.title}
                onChange={(event) => updateEditorField("title", event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={fieldLabelStyle}>
              Description
              <input
                value={editorChallenge.description}
                onChange={(event) => updateEditorField("description", event.target.value)}
                style={inputStyle}
              />
            </label>
            {editorChallenge.gameType === "reaction-time" && (
              <>
                <label style={fieldLabelStyle}>
                  Attempts
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editorChallenge.configuration.attempts}
                    onChange={(event) => updateEditorField("configuration.attempts", Number(event.target.value))}
                    style={inputStyle}
                  />
                </label>
                <label style={fieldLabelStyle}>
                  Minimum signal delay (ms)
                  <input
                    type="number"
                    min={300}
                    max={10000}
                    value={editorChallenge.configuration.minimumDelayMs}
                    onChange={(event) => updateEditorField("configuration.minimumDelayMs", Number(event.target.value))}
                    style={inputStyle}
                  />
                </label>
                <label style={fieldLabelStyle}>
                  Maximum signal delay (ms)
                  <input
                    type="number"
                    min={300}
                    max={10000}
                    value={editorChallenge.configuration.maximumDelayMs}
                    onChange={(event) => updateEditorField("configuration.maximumDelayMs", Number(event.target.value))}
                    style={inputStyle}
                  />
                </label>
              </>
            )}
            {editorChallenge.gameType === "word-guess" && (
              <>
                <label style={fieldLabelStyle}>
                  Daily answer (five letters)
                  <input
                    maxLength={5}
                    value={editorChallenge.configuration.answer}
                    onChange={(event) => updateEditorField("configuration.answer", event.target.value.toUpperCase())}
                    style={inputStyle}
                  />
                </label>
                <label style={{ ...fieldLabelStyle, gridColumn: "1 / -1" }}>
                  Accepted words (one five-letter word per line)
                  <textarea
                    value={editorChallenge.configuration.validWords.join("\n")}
                    onChange={(event) => updateEditorField(
                      "configuration.validWords",
                      event.target.value.split(/\r?\n/).map((word) => word.trim().toUpperCase()).filter(Boolean),
                    )}
                    rows={6}
                    style={{ ...inputStyle, fontFamily: "Consolas, monospace" }}
                  />
                </label>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                  The answer is private: public clients submit guesses for server-side checking.
                </p>
              </>
            )}
            {editorChallenge.gameType === "memory-match" && (
              <>
                <label style={fieldLabelStyle}>
                  Pair count
                  <select
                    value={editorChallenge.configuration.pairs}
                    onChange={(event) => {
                      const pairs = Number(event.target.value) as 6 | 8 | 12;
                      const emojis = editorChallenge.configuration.emojis.slice(0, pairs);
                      if (emojis.length < pairs) {
                        emojis.push(
                          ...DEFAULT_DAILY_GAME_CONFIGURATIONS["memory-match"].emojis.slice(
                            emojis.length,
                            pairs,
                          ),
                        );
                      }
                      updateEditorConfiguration({ pairs, emojis });
                    }}
                    style={inputStyle}
                  >
                    <option value={6}>Easy · 6 pairs</option>
                    <option value={8}>Medium · 8 pairs</option>
                    <option value={12}>Hard · 12 pairs</option>
                  </select>
                </label>
                <label style={{ ...fieldLabelStyle, gridColumn: "1 / -1" }}>
                  Emoji pairs (one emoji per line)
                  <textarea
                    value={editorChallenge.configuration.emojis.join("\n")}
                    onChange={(event) => updateEditorField(
                      "configuration.emojis",
                      event.target.value.split(/\r?\n/).map((emoji) => emoji.trim()).filter(Boolean),
                    )}
                    rows={4}
                    style={{ ...inputStyle, fontFamily: "Consolas, monospace" }}
                  />
                </label>
              </>
            )}
          </div>
        )}

        <textarea
          value={editor}
          onChange={(event) => {
            setEditor(event.target.value);
            setValidation(null);
          }}
          aria-label="Daily game challenge JSON editor"
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: 340,
            boxSizing: "border-box",
            padding: 16,
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            fontFamily: "Consolas, monospace",
            fontSize: 13,
          }}
        />

        {validation && (
          <div aria-live="polite" style={{ marginTop: 12 }}>
            <strong style={{ color: validation.valid ? "#15803d" : "#b91c1c" }}>
              {validation.valid ? "Required fields are present; the server performs full game validation." : "Please fix the following:"}
            </strong>
            {validation.errors.map((issue) => <p key={issue} style={{ margin: "6px 0", color: "#b91c1c" }}>{issue}</p>)}
          </div>
        )}

        {editorChallenge && (
          <aside style={{ marginTop: 16, border: "1px solid #cbd5e1", borderRadius: 14, padding: 16, background: "#f8fafc" }}>
            <strong>Preview · {GAME_TITLES[editorChallenge.gameType]}</strong>
            <h3 style={{ margin: "8px 0 4px" }}>{editorChallenge.title}</h3>
            <p style={{ margin: "0 0 8px", color: "#475569" }}>{editorChallenge.description}</p>
            <p style={{ color: "#475569" }}>
              Save as Draft: <strong>draft</strong> (will not auto-publish). Schedule Publication:{" "}
              {editorSchedulePreview && "error" in editorSchedulePreview
                ? editorSchedulePreview.error
                : editorSchedulePreview?.status === "scheduled"
                  ? `${formatChallengeTimestamp(editorSchedulePreview.scheduledAt, editorChallenge.timezone)} · UTC ${editorSchedulePreview.scheduledAt}`
                  : "not resolved"}
            </p>
            <code>{JSON.stringify(editorChallenge.configuration)}</code>
          </aside>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => validateEditor()} style={buttonStyle}>
            Validate / preview
          </button>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => void saveDraft()} style={buttonStyle}>
            {busy === "save" ? "Saving…" : "Save as Draft"}
          </button>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => void scheduleEditor()} style={primaryButtonStyle}>
            {busy === "schedule-editor" ? "Scheduling…" : "Schedule Publication"}
          </button>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => void publishEditor()} style={primaryButtonStyle}>
            {busy === "publish-editor" ? "Publishing…" : "Publish now"}
          </button>
          {editingId && (
            <button type="button" onClick={() => startNew()} style={buttonStyle}>Cancel edit</button>
          )}
        </div>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          All times use the challenge timezone. Save as Draft never auto-publishes. Schedule Publication uses an imported explicit scheduledAt value when present, otherwise midnight on the publication date. Publish now makes this specific challenge live immediately and validates again on the server.
        </p>
      </div>
      ) : null}
    </section>
  );
}

function validatePreviewJson(value: string): DailyGameChallenge | null {
  try {
    const validation = validateDailyGameChallenge(JSON.parse(value));
    return validation.challenge ?? null;
  } catch {
    return null;
  }
}

const panelStyle = {
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(148,163,184,0.3)",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 14px 28px rgba(15,23,42,0.05)",
};

const challengeCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
};

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#fff",
  color: "#0f172a",
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
