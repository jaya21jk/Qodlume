PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  publication_date TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL CHECK (status IN ('draft', 'validated', 'scheduled', 'published', 'archived')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration_minutes INTEGER NOT NULL CHECK (estimated_duration_minutes > 0),
  author TEXT,
  previous_version_id TEXT,
  scheduled_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  validation_errors_json TEXT NOT NULL DEFAULT '[]',
  CHECK (scheduled_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', scheduled_at) IS NOT NULL),
  CHECK (published_at IS NULL OR strftime('%Y-%m-%dT%H:%M:%fZ', published_at) IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY NOT NULL,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single_choice' CHECK (question_type = 'single_choice'),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  explanation TEXT NOT NULL,
  hint TEXT,
  code_snippet_json TEXT,
  references_json TEXT,
  tags_json TEXT,
  correct_option_id TEXT NOT NULL,
  UNIQUE (quiz_id, sort_order)
);

CREATE TABLE IF NOT EXISTS question_options (
  id TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  code TEXT,
  PRIMARY KEY (question_id, id),
  UNIQUE (question_id, sort_order)
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip_hash TEXT PRIMARY KEY NOT NULL,
  window_started_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
  blocked_until TEXT
);

CREATE INDEX IF NOT EXISTS quizzes_publication_status_date
  ON quizzes(status, publication_date DESC);
CREATE INDEX IF NOT EXISTS quizzes_scheduled_due
  ON quizzes(status, scheduled_at);
CREATE INDEX IF NOT EXISTS quizzes_published_at
  ON quizzes(published_at DESC);
CREATE INDEX IF NOT EXISTS questions_quiz_order
  ON questions(quiz_id, sort_order);
CREATE INDEX IF NOT EXISTS question_options_question_order
  ON question_options(question_id, sort_order);
