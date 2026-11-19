import { Wallpaper } from '@/shared/types/wallpaper';
import { UserSettings, UserProfile, SearchHistoryRecord } from '@/shared/types/api';

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  WALLHAVEN_API_KEY?: string;
  SAUCENAO_API_KEY?: string;
  ENVIRONMENT?: string;
  APP_BASE_URL?: string;
  ASSETS?: Fetcher;
  AI?: {
    run(model: string, input: any): Promise<any>;
  };
}

export class DbClient {
  constructor(private db: D1Database) {}

  // ==========================================
  // USERS
  // ==========================================

  async upsertUser(user: {
    telegram_user_id: number;
    username?: string;
    language?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO users (telegram_user_id, username, language, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?4)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
          username = COALESCE(?2, username),
          language = COALESCE(?3, language),
          updated_at = ?4
      `)
      .bind(user.telegram_user_id, user.username || null, user.language || 'vi', now)
      .run();

    // Ensure user settings row exists
    await this.db
      .prepare(`
        INSERT OR IGNORE INTO user_settings (telegram_user_id, preferred_resolution, preferred_orientation, enabled_providers, language, updated_at)
        VALUES (?1, 'all', 'all', '["wallhaven"]', ?2, ?3)
      `)
      .bind(user.telegram_user_id, user.language || 'vi', now)
      .run();
  }

  async getUser(telegram_user_id: number): Promise<UserProfile | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE telegram_user_id = ?1')
      .bind(telegram_user_id)
      .first<UserProfile>();
    return row || null;
  }

  // ==========================================
  // USER SETTINGS
  // ==========================================

  async getUserSettings(telegram_user_id: number): Promise<UserSettings> {
    const row = await this.db
      .prepare('SELECT * FROM user_settings WHERE telegram_user_id = ?1')
      .bind(telegram_user_id)
      .first<{
        telegram_user_id: number;
        preferred_resolution: string;
        preferred_orientation: string;
        enabled_providers: string;
        language: string;
        updated_at: string;
      }>();

    if (!row) {
      const allDefault = ['wallhaven', 'konachan', 'safebooru', 'yandere', 'danbooru', 'tbib', 'nekos_best'];
      return {
        telegram_user_id,
        preferred_resolution: 'all',
        preferred_orientation: 'all',
        enabled_providers: allDefault as any,
        language: 'vi',
        user_id: telegram_user_id,
        default_resolution: 'all',
        default_orientation: 'all',
        selected_providers: allDefault as any,
        daily_enabled: false,
        daily_time: '09:00',
        timezone: 'Asia/Ho_Chi_Minh'
      };
    }

    let providers: any[] = ['wallhaven'];
    try {
      providers = JSON.parse(row.enabled_providers);
    } catch {}

    const prefRes = (row.preferred_resolution as any) || 'all';
    const prefOri = (row.preferred_orientation as any) || 'all';

    return {
      telegram_user_id: row.telegram_user_id,
      preferred_resolution: prefRes,
      preferred_orientation: prefOri,
      enabled_providers: providers,
      language: row.language || 'vi',
      updated_at: row.updated_at,
      user_id: row.telegram_user_id,
      default_resolution: prefRes,
      default_orientation: prefOri,
      selected_providers: providers,
      daily_enabled: false,
      daily_time: '09:00',
      timezone: 'Asia/Ho_Chi_Minh'
    };
  }

  async updateUserSettings(telegram_user_id: number, settings: Partial<UserSettings>): Promise<void> {
    const current = await this.getUserSettings(telegram_user_id);
    const updated = { ...current, ...settings };
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        INSERT INTO user_settings (telegram_user_id, preferred_resolution, preferred_orientation, enabled_providers, language, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
          preferred_resolution = ?2,
          preferred_orientation = ?3,
          enabled_providers = ?4,
          language = ?5,
          updated_at = ?6
      `)
      .bind(
        telegram_user_id,
        updated.preferred_resolution,
        updated.preferred_orientation,
        JSON.stringify(updated.enabled_providers),
        updated.language,
        now
      )
      .run();
  }

  // ==========================================
  // FAVORITES (IDEMPOTENT & USER ISOLATED)
  // ==========================================

  async addFavorite(telegram_user_id: number, wallpaper: Wallpaper): Promise<boolean> {
    const now = new Date().toISOString();
    const id = `fav_${telegram_user_id}_${wallpaper.provider}_${wallpaper.providerPostId}`;

    await this.db
      .prepare(`
        INSERT INTO favorites (id, telegram_user_id, provider, wallpaper_id, metadata_json, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(telegram_user_id, provider, wallpaper_id) DO UPDATE SET
          metadata_json = excluded.metadata_json,
          created_at = excluded.created_at
      `)
      .bind(
        id,
        telegram_user_id,
        wallpaper.provider,
        wallpaper.providerPostId,
        JSON.stringify(wallpaper),
        now
      )
      .run();

    return true;
  }

  async removeFavorite(telegram_user_id: number, provider: string, wallpaper_id: string): Promise<boolean> {
    const res = await this.db
      .prepare(`
        DELETE FROM favorites
        WHERE telegram_user_id = ?1 AND provider = ?2 AND wallpaper_id = ?3
      `)
      .bind(telegram_user_id, provider, wallpaper_id)
      .run();

    return (res.meta?.changes ?? 0) > 0;
  }

  async isFavorite(telegram_user_id: number, provider: string, wallpaper_id: string): Promise<boolean> {
    const row = await this.db
      .prepare(`
        SELECT 1 FROM favorites
        WHERE telegram_user_id = ?1 AND provider = ?2 AND wallpaper_id = ?3
      `)
      .bind(telegram_user_id, provider, wallpaper_id)
      .first();

    return Boolean(row);
  }

  async getFavorites(
    telegram_user_id: number,
    page = 1,
    limit = 10
  ): Promise<{ wallpapers: Wallpaper[]; total: number }> {
    const offset = Math.max(0, (page - 1) * limit);

    const countRow = await this.db
      .prepare('SELECT COUNT(*) as count FROM favorites WHERE telegram_user_id = ?1')
      .bind(telegram_user_id)
      .first<{ count: number }>();
    const total = countRow?.count ?? 0;

    const rows = await this.db
      .prepare(`
        SELECT metadata_json
        FROM favorites
        WHERE telegram_user_id = ?1
        ORDER BY created_at DESC
        LIMIT ?2 OFFSET ?3
      `)
      .bind(telegram_user_id, limit, offset)
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

  // ==========================================
  // SEARCH HISTORY (NO DUPLICATE ADJACENT, PRUNING)
  // ==========================================

  async addSearchHistory(
    telegram_user_id: number,
    query: string,
    filters_json?: string
  ): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();

    // Check last entry for this user to avoid duplicate adjacent entries
    const last = await this.db
      .prepare(`
        SELECT id, query
        FROM search_history
        WHERE telegram_user_id = ?1
        ORDER BY id DESC
        LIMIT 1
      `)
      .bind(telegram_user_id)
      .first<{ id: number; query: string }>();

    if (last && last.query.toLowerCase() === trimmed.toLowerCase()) {
      // Just update timestamp on identical adjacent query
      await this.db
        .prepare('UPDATE search_history SET created_at = ?1 WHERE id = ?2')
        .bind(now, last.id)
        .run();
    } else {
      // Insert new query entry
      await this.db
        .prepare(`
          INSERT INTO search_history (telegram_user_id, query, filters_json, created_at)
          VALUES (?1, ?2, ?3, ?4)
        `)
        .bind(telegram_user_id, trimmed, filters_json || null, now)
        .run();

      // Prune history to limit retained entries to 20 per user
      await this.db
        .prepare(`
          DELETE FROM search_history
          WHERE telegram_user_id = ?1 AND id NOT IN (
            SELECT id FROM search_history
            WHERE telegram_user_id = ?1
            ORDER BY id DESC
            LIMIT 20
          )
        `)
        .bind(telegram_user_id)
        .run();
    }
  }

  async getSearchHistory(
    telegram_user_id: number,
    limit = 10
  ): Promise<Array<{ id: number; query: string; filters_json?: string; created_at: string }>> {
    const rows = await this.db
      .prepare(`
        SELECT id, query, filters_json, created_at
        FROM search_history
        WHERE telegram_user_id = ?1
        ORDER BY id DESC
        LIMIT ?2
      `)
      .bind(telegram_user_id, limit)
      .all<{ id: number; query: string; filters_json?: string; created_at: string }>();

    return rows.results || [];
  }

  async clearSearchHistory(telegram_user_id: number): Promise<void> {
    await this.db
      .prepare('DELETE FROM search_history WHERE telegram_user_id = ?1')
      .bind(telegram_user_id)
      .run();
  }

  // ==========================================
  // TELEGRAM FILE CACHE (PROVIDER + WALLPAPER_ID)
  // ==========================================

  async getCachedTelegramFile(provider: string, wallpaper_id: string): Promise<string | null> {
    const row = await this.db
      .prepare(`
        SELECT telegram_file_id
        FROM telegram_file_cache
        WHERE provider = ?1 AND wallpaper_id = ?2
      `)
      .bind(provider, wallpaper_id)
      .first<{ telegram_file_id: string }>();

    return row?.telegram_file_id || null;
  }

  async setCachedTelegramFile(
    provider: string,
    wallpaper_id: string,
    telegram_file_id: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO telegram_file_cache (provider, wallpaper_id, telegram_file_id, created_at)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(provider, wallpaper_id) DO UPDATE SET
          telegram_file_id = ?3,
          created_at = ?4
      `)
      .bind(provider, wallpaper_id, telegram_file_id, now)
      .run();
  }

  // ==========================================
  // SEARCH SESSIONS (PAGINATION CACHE)
  // ==========================================

  async saveSearchSession(
    sessionId: string,
    telegram_user_id: number,
    query: string,
    filtersJson: string,
    currentPage: number,
    ttlSeconds = 86400
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    await this.db
      .prepare(`
        INSERT INTO search_sessions (session_id, telegram_user_id, query, filters_json, current_page, expires_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(session_id) DO UPDATE SET
          query = ?3,
          filters_json = ?4,
          current_page = ?5,
          expires_at = ?6
      `)
      .bind(sessionId, telegram_user_id, query, filtersJson, currentPage, expiresAt)
      .run();
  }

  async getSearchSession(sessionId: string): Promise<{
    session_id: string;
    telegram_user_id: number;
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
        telegram_user_id: number;
        query: string;
        filters_json: string;
        current_page: number;
      }>();

    return row || null;
  }

  // ==========================================
  // PHASE 4: REVERSE SEARCH & SMART SEARCH HISTORY
  // ==========================================

  async addReverseSearchHistory(
    telegram_user_id: number,
    provider: string,
    result_metadata: any
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO reverse_search_history (telegram_user_id, provider, result_metadata_json, created_at)
        VALUES (?1, ?2, ?3, ?4)
      `)
      .bind(telegram_user_id, provider, JSON.stringify(result_metadata), now)
      .run();
  }

  async getReverseSearchHistory(
    telegram_user_id: number,
    limit = 10
  ): Promise<Array<{ id: number; provider: string; result_metadata: any; created_at: string }>> {
    const rows = await this.db
      .prepare(`
        SELECT id, provider, result_metadata_json, created_at
        FROM reverse_search_history
        WHERE telegram_user_id = ?1
        ORDER BY id DESC
        LIMIT ?2
      `)
      .bind(telegram_user_id, limit)
      .all<{ id: number; provider: string; result_metadata_json: string; created_at: string }>();

    return (rows.results || []).map((r) => {
      let meta: any = {};
      try {
        meta = JSON.parse(r.result_metadata_json);
      } catch {}
      return {
        id: r.id,
        provider: r.provider,
        result_metadata: meta,
        created_at: r.created_at
      };
    });
  }

  async addSmartSearchHistory(
    telegram_user_id: number,
    original_query: string,
    parsed_filters: any
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO smart_search_history (telegram_user_id, original_query, parsed_filters_json, created_at)
        VALUES (?1, ?2, ?3, ?4)
      `)
      .bind(telegram_user_id, original_query, JSON.stringify(parsed_filters), now)
      .run();
  }

  // ==========================================
  // PHASE 4: API USAGE & RATE LIMITING
  // ==========================================

  async checkAndIncrementApiUsage(
    telegram_user_id: number,
    provider: string,
    maxPerDay = 30
  ): Promise<{ allowed: boolean; remaining: number; count: number }> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const now = new Date().toISOString();

    const existing = await this.db
      .prepare(`
        SELECT request_count
        FROM api_usage
        WHERE telegram_user_id = ?1 AND provider = ?2 AND period_start = ?3
      `)
      .bind(telegram_user_id, provider, today)
      .first<{ request_count: number }>();

    const currentCount = existing?.request_count ?? 0;
    if (currentCount >= maxPerDay) {
      return { allowed: false, remaining: 0, count: currentCount };
    }

    const nextCount = currentCount + 1;
    await this.db
      .prepare(`
        INSERT INTO api_usage (telegram_user_id, provider, request_count, period_start, updated_at)
        VALUES (?1, ?2, 1, ?3, ?4)
        ON CONFLICT(telegram_user_id, provider, period_start) DO UPDATE SET
          request_count = request_count + 1,
          updated_at = ?4
      `)
      .bind(telegram_user_id, provider, today, now)
      .run();

    return {
      allowed: true,
      remaining: Math.max(0, maxPerDay - nextCount),
      count: nextCount
    };
  }
}
