import { Wallpaper } from '@/shared/types/wallpaper';
import { UserSettings, UserProfile } from '@/shared/types/api';

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  WALLHAVEN_API_KEY?: string;
  SAUCENAO_API_KEY?: string;
  ENVIRONMENT?: string;
  APP_BASE_URL?: string;
  ASSETS?: Fetcher;
}

export class DbClient {
  constructor(private db: D1Database) {}

  async upsertUser(user: {
    telegram_user_id: number;
    username?: string;
    display_name?: string;
    language?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO users (telegram_user_id, username, display_name, language, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?5)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
          username = COALESCE(?2, username),
          display_name = COALESCE(?3, display_name),
          language = COALESCE(?4, language),
          updated_at = ?5
      `)
      .bind(user.telegram_user_id, user.username || null, user.display_name || null, user.language || 'vi', now)
      .run();

    // Ensure user settings row exists
    await this.db
      .prepare(`
        INSERT OR IGNORE INTO user_settings (user_id, default_resolution, default_orientation, selected_providers, daily_enabled, daily_time, timezone, updated_at)
        VALUES (?1, 'all', 'all', '["wallhaven","konachan","safebooru"]', 0, '09:00', 'Asia/Ho_Chi_Minh', ?2)
      `)
      .bind(user.telegram_user_id, now)
      .run();
  }

  async getUser(telegram_user_id: number): Promise<UserProfile | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE telegram_user_id = ?1')
      .bind(telegram_user_id)
      .first<UserProfile>();
    return row || null;
  }

  async getUserSettings(user_id: number): Promise<UserSettings> {
    const row = await this.db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?1')
      .bind(user_id)
      .first<{
        user_id: number;
        default_resolution: string;
        default_orientation: string;
        selected_providers: string;
        daily_enabled: number;
        daily_time: string;
        timezone: string;
        updated_at: string;
      }>();

    if (!row) {
      return {
        user_id,
        default_resolution: 'all',
        default_orientation: 'all',
        selected_providers: ['wallhaven', 'konachan', 'safebooru'],
        daily_enabled: false,
        daily_time: '09:00',
        timezone: 'Asia/Ho_Chi_Minh'
      };
    }

    let providers: any[] = ['wallhaven', 'konachan', 'safebooru'];
    try {
      providers = JSON.parse(row.selected_providers);
    } catch {}

    return {
      user_id: row.user_id,
      default_resolution: row.default_resolution as any,
      default_orientation: row.default_orientation as any,
      selected_providers: providers,
      daily_enabled: Boolean(row.daily_enabled),
      daily_time: row.daily_time || '09:00',
      timezone: row.timezone || 'Asia/Ho_Chi_Minh',
      updated_at: row.updated_at
    };
  }

  async updateUserSettings(user_id: number, settings: Partial<UserSettings>): Promise<void> {
    const current = await this.getUserSettings(user_id);
    const updated = { ...current, ...settings };
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        INSERT INTO user_settings (user_id, default_resolution, default_orientation, selected_providers, daily_enabled, daily_time, timezone, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(user_id) DO UPDATE SET
          default_resolution = ?2,
          default_orientation = ?3,
          selected_providers = ?4,
          daily_enabled = ?5,
          daily_time = ?6,
          timezone = ?7,
          updated_at = ?8
      `)
      .bind(
        user_id,
        updated.default_resolution,
        updated.default_orientation,
        JSON.stringify(updated.selected_providers),
        updated.daily_enabled ? 1 : 0,
        updated.daily_time,
        updated.timezone,
        now
      )
      .run();
  }

  async cacheWallpaper(wallpaper: Wallpaper): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO wallpapers (id, provider, provider_post_id, metadata_json, cached_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(id) DO UPDATE SET
          metadata_json = ?4,
          cached_at = ?5
      `)
      .bind(wallpaper.id, wallpaper.provider, wallpaper.providerPostId, JSON.stringify(wallpaper), now)
      .run();
  }

  async getCachedWallpaper(id: string): Promise<Wallpaper | null> {
    const row = await this.db
      .prepare('SELECT metadata_json FROM wallpapers WHERE id = ?1')
      .bind(id)
      .first<{ metadata_json: string }>();

    if (!row) return null;
    try {
      return JSON.parse(row.metadata_json);
    } catch {
      return null;
    }
  }

  async addFavorite(user_id: number, wallpaper: Wallpaper): Promise<void> {
    await this.cacheWallpaper(wallpaper);
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT OR IGNORE INTO favorites (user_id, wallpaper_id, created_at)
        VALUES (?1, ?2, ?3)
      `)
      .bind(user_id, wallpaper.id, now)
      .run();
  }

  async removeFavorite(user_id: number, wallpaper_id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM favorites WHERE user_id = ?1 AND wallpaper_id = ?2')
      .bind(user_id, wallpaper_id)
      .run();
  }

  async isFavorite(user_id: number, wallpaper_id: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM favorites WHERE user_id = ?1 AND wallpaper_id = ?2')
      .bind(user_id, wallpaper_id)
      .first();
    return Boolean(row);
  }

  async getFavorites(user_id: number, page = 1, limit = 20): Promise<{ wallpapers: Wallpaper[]; total: number }> {
    const offset = (page - 1) * limit;

    const countRow = await this.db
      .prepare('SELECT COUNT(*) as count FROM favorites WHERE user_id = ?1')
      .bind(user_id)
      .first<{ count: number }>();
    const total = countRow?.count ?? 0;

    const rows = await this.db
      .prepare(`
        SELECT w.metadata_json
        FROM favorites f
        JOIN wallpapers w ON f.wallpaper_id = w.id
        WHERE f.user_id = ?1
        ORDER BY f.created_at DESC
        LIMIT ?2 OFFSET ?3
      `)
      .bind(user_id, limit, offset)
      .all<{ metadata_json: string }>();

    const wallpapers: Wallpaper[] = [];
    if (rows.results) {
      for (const r of rows.results) {
        try {
          wallpapers.push(JSON.parse(r.metadata_json));
        } catch {}
      }
    }

    return { wallpapers, total };
  }

  async addSearchHistory(user_id: number, query: string, filters_json?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO search_history (user_id, query, filters_json, created_at)
        VALUES (?1, ?2, ?3, ?4)
      `)
      .bind(user_id, query, filters_json || null, now)
      .run();
  }

  async getSearchHistory(user_id: number, limit = 10): Promise<Array<{ id: number; query: string; created_at: string }>> {
    const rows = await this.db
      .prepare(`
        SELECT id, query, created_at
        FROM search_history
        WHERE user_id = ?1
        ORDER BY created_at DESC
        LIMIT ?2
      `)
      .bind(user_id, limit)
      .all<{ id: number; query: string; created_at: string }>();

    return rows.results || [];
  }

  async clearSearchHistory(user_id: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM search_history WHERE user_id = ?1')
      .bind(user_id)
      .run();
  }

  async saveSearchSession(
    sessionId: string,
    userId: number,
    query: string,
    filtersJson: string,
    currentPage: number,
    ttlSeconds = 86400
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    await this.db
      .prepare(`
        INSERT INTO search_sessions (session_id, user_id, query, filters_json, current_page, expires_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(session_id) DO UPDATE SET
          query = ?3,
          filters_json = ?4,
          current_page = ?5,
          expires_at = ?6
      `)
      .bind(sessionId, userId, query, filtersJson, currentPage, expiresAt)
      .run();
  }

  async getSearchSession(sessionId: string): Promise<{
    session_id: string;
    user_id: number;
    query: string;
    filters_json: string;
    current_page: number;
  } | null> {
    const now = Math.floor(Date.now() / 1000);
    const row = await this.db
      .prepare('SELECT * FROM search_sessions WHERE session_id = ?1 AND expires_at > ?2')
      .bind(sessionId, now)
      .first<{
        session_id: string;
        user_id: number;
        query: string;
        filters_json: string;
        current_page: number;
      }>();
    return row || null;
  }

  async getCachedTelegramFile(wallpaperId: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT file_id FROM telegram_file_cache WHERE wallpaper_id = ?1')
      .bind(wallpaperId)
      .first<{ file_id: string }>();
    return row?.file_id || null;
  }

  async setCachedTelegramFile(wallpaperId: string, fileId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO telegram_file_cache (wallpaper_id, file_id, cached_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(wallpaper_id) DO UPDATE SET
          file_id = ?2,
          cached_at = ?3
      `)
      .bind(wallpaperId, fileId, now)
      .run();
  }

  async getDailySubscribers(): Promise<Array<{ user_id: number; daily_time: string; timezone: string }>> {
    const rows = await this.db
      .prepare('SELECT user_id, daily_time, timezone FROM user_settings WHERE daily_enabled = 1')
      .all<{ user_id: number; daily_time: string; timezone: string }>();
    return rows.results || [];
  }

  async hasReceivedDailyToday(userId: number, deliveryDate: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 FROM daily_delivery_logs WHERE user_id = ?1 AND delivery_date = ?2')
      .bind(userId, deliveryDate)
      .first();
    return Boolean(row);
  }

  async logDailyDelivery(userId: number, wallpaperId: string, deliveryDate: string, status = 'sent'): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO daily_delivery_logs (user_id, wallpaper_id, delivery_date, status, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
      `)
      .bind(userId, wallpaperId, deliveryDate, status, now)
      .run();
  }
}
