interface WordDictionaryImportEntry {
  word: string;
  isGuessAllowed: boolean;
  isAnswerEligible: boolean;
}

function quoteSql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildWordDictionaryImportSql(
  value: unknown,
  importedAt = new Date().toISOString(),
): string {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Dictionary input must be a non-empty JSON array.");
  }
  if (value.length > 100_000) {
    throw new Error("Dictionary imports are limited to 100000 words per file.");
  }
  if (!Number.isFinite(Date.parse(importedAt))) {
    throw new Error("Import timestamp must be valid.");
  }

  const seen = new Set<string>();
  const entries: WordDictionaryImportEntry[] = value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`Dictionary entry ${index + 1} must be an object.`);
    }
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.word !== "string" ||
      typeof candidate.isGuessAllowed !== "boolean" ||
      typeof candidate.isAnswerEligible !== "boolean"
    ) {
      throw new Error(
        `Dictionary entry ${index + 1} must contain word, isGuessAllowed, and isAnswerEligible.`,
      );
    }

    const word = candidate.word.trim().toLowerCase();
    if (!/^[a-z]{1,32}$/.test(word)) {
      throw new Error(`Dictionary entry ${index + 1} must be 1-32 English letters.`);
    }
    if (seen.has(word)) {
      throw new Error(`Dictionary contains duplicate normalized word "${word}".`);
    }
    if (candidate.isAnswerEligible && !candidate.isGuessAllowed) {
      throw new Error(`Answer-eligible word "${word}" must also be enabled as a guess.`);
    }
    seen.add(word);
    return {
      word,
      isGuessAllowed: candidate.isGuessAllowed,
      isAnswerEligible: candidate.isAnswerEligible,
    };
  });

  const timestamp = quoteSql(new Date(importedAt).toISOString());
  const statements: string[] = [];
  for (let offset = 0; offset < entries.length; offset += 200) {
    const rows = entries.slice(offset, offset + 200).map((entry) =>
      `(${quoteSql(entry.word)}, ${entry.word.length}, ${Number(entry.isGuessAllowed)}, ${Number(entry.isAnswerEligible)}, ${timestamp})`,
    );
    statements.push(
      `INSERT INTO daily_game_words (word, word_length, is_guess_allowed, is_answer_eligible, created_at)\n` +
        `VALUES\n  ${rows.join(",\n  ")}\n` +
        `ON CONFLICT(word) DO UPDATE SET\n` +
        `  word_length = excluded.word_length,\n` +
        `  is_guess_allowed = excluded.is_guess_allowed,\n` +
        `  is_answer_eligible = excluded.is_answer_eligible;`,
    );
  }
  return `${statements.join("\n\n")}\n`;
}
