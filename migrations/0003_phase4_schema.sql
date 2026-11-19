-- 0003_phase4_schema.sql
-- AniWalls Phase 4: Reverse Image Search, Scene Recognition & Smart Search Tables

CREATE TABLE IF NOT EXISTS reverse_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  result_metadata_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rev_search_user ON reverse_search_history(telegram_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS smart_search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  original_query TEXT NOT NULL,
  parsed_filters_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_smart_search_user ON smart_search_history(telegram_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  period_start TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_user_id, provider, period_start)
);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(telegram_user_id, provider, period_start);
