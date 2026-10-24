"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_DAILY_GAME_CONFIGURATIONS,
  DAILY_GAME_TYPES,
  type DailyGameChallenge,
  type DailyGameType,
} from "../types/daily-game-challenge";
import { dateTimeLocalToUtc } from "../lib/quiz-publishing";

const GAME_TITLES: Record<DailyGameType, string> = {
  "reaction-time": "Reaction Time Challenge",
  "word-guess": "Word Guess",
  "memory-match": "Memory Match",
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

export function DailyGameChallengeConsole() {
  const [challenges, setChallenges] = useState<DailyGameChallenge[]>([]);
  const [editor, setEditor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedGameType, setSelectedGameType] = useState<DailyGameType>("word-guess");
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const loadChallenges = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadChallenges();
  }, [loadChallenges]);

  const validateEditor = (): DailyGameChallenge | undefined => {
    try {
      const challenge = JSON.parse(editor) as DailyGameChallenge;
      const issues: string[] = [];
      if (!challenge.publicationDate) issues.push("publicationDate is required.");
      if (!challenge.timezone) issues.push("timezone is required.");
      if (!challenge.title?.trim()) issues.push("title is required.");
      if (!challenge.description?.trim()) issues.push("description is required.");
      if (!challenge.gameType || !DAILY_GAME_TYPES.includes(challenge.gameType)) {
        issues.push("gameType must be reaction-time, word-guess, or memory-match.");
      }
      if (!challenge.configuration || typeof challenge.configuration !== "object") {
        issues.push("configuration must be an object.");
      }
      const result = { valid: issues.length === 0, errors: issues };
      setValidation(result);
      return result.valid ? challenge : undefined;
    } catch {
      setValidation({ valid: false, errors: ["Enter a valid JSON object."] });
      return undefined;
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
              scheduledAt: undefined,
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

  const runAction = async (challenge: DailyGameChallenge, action: "publish" | "schedule" | "unpublish") => {
    let scheduledAt: string | undefined;
    if (action === "schedule") {
      const localValue = scheduleInputs[challenge.id];
      if (!localValue) {
        setError(`Choose a schedule time for "${challenge.title}".`);
        return;
      }
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

  const editorChallenge = editor ? validatePreviewJson(editor) : null;

  return (
    <section style={{ display: "grid", gap: 20 }}>
      <div style={panelStyle}>
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
          {challenges.map((challenge) => (
            <article key={challenge.id} style={challengeCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px" }}>{challenge.title}</h3>
                  <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
                    {challenge.publicationDate} · {challenge.timezone} · {GAME_TITLES[challenge.gameType]}
                    {challenge.scheduledAt ? ` · Scheduled ${new Date(challenge.scheduledAt).toLocaleString()}` : ""}
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
                      Schedule
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
                    value={scheduleInputs[challenge.id] ?? ""}
                    onChange={(event) => setScheduleInputs((current) => ({ ...current, [challenge.id]: event.target.value }))}
                    aria-label={`Schedule ${challenge.title}`}
                  />
                </label>
              )}
            </article>
          ))}
        </div>
      </div>

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>{editingId ? "Edit challenge draft" : "Create or edit a challenge"}</h2>
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
            <code>{JSON.stringify(editorChallenge.configuration)}</code>
          </aside>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => validateEditor()} style={buttonStyle}>
            Validate / preview
          </button>
          <button type="button" disabled={!editor || busy !== ""} onClick={() => void saveDraft()} style={primaryButtonStyle}>
            {busy === "save" ? "Saving…" : "Save as draft"}
          </button>
          {editingId && (
            <button type="button" onClick={() => startNew()} style={buttonStyle}>Cancel edit</button>
          )}
        </div>
        <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
          All times use the challenge timezone. New and edited content is saved as a draft; publication validates again on the server.
        </p>
      </div>
    </section>
  );
}

function validatePreviewJson(value: string): DailyGameChallenge | null {
  try {
    const parsed = JSON.parse(value) as DailyGameChallenge;
    return parsed && DAILY_GAME_TYPES.includes(parsed.gameType) ? parsed : null;
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
