-- 0002_phase2_schema.sql
-- AniWalls Phase 2 Schema Alignment for D1

CREATE TABLE IF NOT EXISTS users (
  telegram_user_id INTEGER PRIMARY KEY,
  username TEXT,
  language TEXT DEFAULT 'vi',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS favorites;
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  wallpaper_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_user_id, provider, wallpaper_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(telegram_user_id, created_at DESC);

DROP TABLE IF EXISTS search_history;
CREATE TABLE search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  filters_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(telegram_user_id, created_at DESC);

DROP TABLE IF EXISTS user_settings;
CREATE TABLE user_settings (
  telegram_user_id INTEGER PRIMARY KEY,
  preferred_resolution TEXT DEFAULT 'all',
  preferred_orientation TEXT DEFAULT 'all',
  enabled_providers TEXT DEFAULT '["wallhaven"]',
  language TEXT DEFAULT 'vi',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS telegram_file_cache;
CREATE TABLE telegram_file_cache (
  provider TEXT NOT NULL,
  wallpaper_id TEXT NOT NULL,
  telegram_file_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, wallpaper_id)
);

DROP TABLE IF EXISTS search_sessions;
CREATE TABLE search_sessions (
  session_id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  filters_json TEXT,
  current_page INTEGER DEFAULT 1,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_sessions_exp ON search_sessions(expires_at);
