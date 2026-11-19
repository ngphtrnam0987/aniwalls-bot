-- 0001_initial_schema.sql
-- AniWalls database schema for Cloudflare D1

CREATE TABLE IF NOT EXISTS users (
  telegram_user_id INTEGER PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  language TEXT DEFAULT 'vi',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallpapers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_post_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  cached_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallpapers_provider ON wallpapers(provider, provider_post_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL,
  wallpaper_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, wallpaper_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  filters_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  query TEXT NOT NULL,
  filters_json TEXT,
  current_page INTEGER DEFAULT 1,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_sessions_exp ON search_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  default_resolution TEXT DEFAULT 'all',
  default_orientation TEXT DEFAULT 'all',
  selected_providers TEXT DEFAULT '["wallhaven","konachan","safebooru"]',
  daily_enabled INTEGER DEFAULT 0,
  daily_time TEXT DEFAULT '09:00',
  timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  wallpaper_id TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_delivery ON daily_delivery_logs(user_id, delivery_date);

CREATE TABLE IF NOT EXISTS telegram_file_cache (
  wallpaper_id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  cached_at TEXT DEFAULT CURRENT_TIMESTAMP
);
