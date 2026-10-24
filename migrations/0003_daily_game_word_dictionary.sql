CREATE TABLE IF NOT EXISTS daily_game_words (
  word TEXT PRIMARY KEY NOT NULL
    CHECK (word = lower(word) AND word NOT GLOB '*[^a-z]*' AND length(word) BETWEEN 1 AND 32),
  word_length INTEGER NOT NULL CHECK (word_length = length(word)),
  is_guess_allowed INTEGER NOT NULL CHECK (is_guess_allowed IN (0, 1)),
  is_answer_eligible INTEGER NOT NULL CHECK (is_answer_eligible IN (0, 1)),
  created_at TEXT NOT NULL,
  CHECK (is_answer_eligible = 0 OR is_guess_allowed = 1)
);

CREATE INDEX IF NOT EXISTS daily_game_words_answer_eligible
  ON daily_game_words(word_length, is_answer_eligible, word);

WITH configured_words AS (
  SELECT
    lower(trim(word_entry.value)) AS word,
    CASE
      WHEN lower(trim(word_entry.value)) = lower(trim(json_extract(challenge.configuration_json, '$.answer')))
      THEN 1
      ELSE 0
    END AS is_answer_eligible
  FROM daily_game_challenges AS challenge,
       json_each(challenge.configuration_json, '$.validWords') AS word_entry
  WHERE challenge.game_type = 'word-guess'
    AND word_entry.type = 'text'

  UNION ALL

  SELECT
    lower(trim(json_extract(configuration_json, '$.answer'))) AS word,
    1 AS is_answer_eligible
  FROM daily_game_challenges
  WHERE game_type = 'word-guess'
)
INSERT INTO daily_game_words (
  word, word_length, is_guess_allowed, is_answer_eligible, created_at
)
SELECT
  word,
  length(word),
  1,
  MAX(is_answer_eligible),
  CURRENT_TIMESTAMP
FROM configured_words
WHERE word GLOB '[a-z]*'
  AND word NOT GLOB '*[^a-z]*'
  AND length(word) BETWEEN 1 AND 32
GROUP BY word
ON CONFLICT(word) DO UPDATE SET
  is_guess_allowed = 1,
  is_answer_eligible = MAX(daily_game_words.is_answer_eligible, excluded.is_answer_eligible);
