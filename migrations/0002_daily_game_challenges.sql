CREATE TABLE IF NOT EXISTS daily_game_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  publication_date TEXT NOT NULL,
  scheduled_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'published', 'unpublished')),
  game_type TEXT NOT NULL CHECK (game_type IN ('reaction-time', 'word-guess', 'memory-match')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  configuration_json TEXT NOT NULL CHECK (json_valid(configuration_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  created_by TEXT,
  UNIQUE (game_type, publication_date),
  CHECK (scheduled_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_at) IS NOT NULL),
  CHECK (published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS daily_game_challenges_lookup
  ON daily_game_challenges(game_type, status, publication_date DESC);
CREATE INDEX IF NOT EXISTS daily_game_challenges_scheduled
  ON daily_game_challenges(status, scheduled_at);
