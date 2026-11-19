import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DbClient } from '@/worker/db/client';
import { Wallpaper } from '@/shared/types/wallpaper';

function createD1Mock(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  const migration2Path = path.resolve(__dirname, '../migrations/0002_phase2_schema.sql');
  const migration2Sql = fs.readFileSync(migration2Path, 'utf8');
  sqlite.exec(migration2Sql);

  const migration3Path = path.resolve(__dirname, '../migrations/0003_phase4_schema.sql');
  const migration3Sql = fs.readFileSync(migration3Path, 'utf8');
  sqlite.exec(migration3Sql);

  function createPreparedStatement(query: string, boundParams: any[] = []): D1PreparedStatement {
    return {
      bind(...params: any[]) {
        return createPreparedStatement(query, params);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        try {
          const stmt = sqlite.prepare(query);
          const row = stmt.get(...boundParams) as any;
          if (!row) return null;
          if (colName) return row[colName];
          return row as T;
        } catch (e) {
          console.error('SQL first error:', e, query, boundParams);
          return null;
        }
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        try {
          const stmt = sqlite.prepare(query);
          const results = stmt.all(...boundParams) as T[];
          return {
            results,
            success: true,
            meta: { duration: 1, changes: 0, last_row_id: 0, served_by: 'mock' }
          } as any;
        } catch (e) {
          console.error('SQL all error:', e, query, boundParams);
          return { results: [], success: false, meta: {} } as any;
        }
      },
      async run<T = unknown>(): Promise<D1Result<T>> {
        try {
          const stmt = sqlite.prepare(query);
          const result = stmt.run(...boundParams);
          return {
            results: [],
            success: true,
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
              duration: 1,
              served_by: 'mock'
            }
          } as any;
        } catch (e) {
          console.error('SQL run error:', e, query, boundParams);
          throw e;
        }
      },
      async raw() { return []; }
    } as unknown as D1PreparedStatement;
  }

  return {
    prepare(query: string) {
      return createPreparedStatement(query);
    },
    async dump() { return new ArrayBuffer(0); },
    async batch() { return []; },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 1 };
    }
  } as unknown as D1Database;
}

function mockWallpaper(provider: 'wallhaven', id: string, title = 'Sample Anime'): Wallpaper {
  return {
    id: `${provider}_${id}`,
    provider,
    providerPostId: id,
    title,
    tags: ['landscape', 'scenery'],
    characters: [],
    series: [],
    width: 3840,
    height: 2160,
    resolution: '3840x2160',
    aspectRatio: '16:9',
    orientation: 'landscape',
    fileSize: 2500000,
    mimeType: 'image/jpeg',
    thumbnailUrl: `https://th.wallhaven.cc/lg/${id.slice(0, 2)}/${id}.jpg`,
    previewUrl: `https://th.wallhaven.cc/lg/${id.slice(0, 2)}/${id}.jpg`,
    originalFileUrl: `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.jpg`,
    postUrl: `https://wallhaven.cc/w/${id}`,
    rating: 'safe',
    sourceMetadata: {}
  };
}

describe('Cloudflare D1 Database & Phase 2 Operations', () => {
  let db: DbClient;

  beforeEach(() => {
    const mockD1 = createD1Mock();
    db = new DbClient(mockD1);
  });

  it('1. should upsert user and initialize default settings', async () => {
    await db.upsertUser({
      telegram_user_id: 111,
      username: 'anime_fan',
      language: 'vi'
    });

    const user = await db.getUser(111);
    expect(user).toBeDefined();
    expect(user?.telegram_user_id).toBe(111);
    expect(user?.username).toBe('anime_fan');
    expect(user?.language).toBe('vi');

    const settings = await db.getUserSettings(111);
    expect(settings.telegram_user_id).toBe(111);
    expect(settings.preferred_resolution).toBe('all');
    expect(settings.enabled_providers).toEqual(['wallhaven']);
  });

  it('2. should add, check and idempotently insert favorites', async () => {
    const w1 = mockWallpaper('wallhaven', 'gpl8d3', 'Scenic Sunset');

    // Add first time
    const added = await db.addFavorite(1001, w1);
    expect(added).toBe(true);

    const isFav = await db.isFavorite(1001, 'wallhaven', 'gpl8d3');
    expect(isFav).toBe(true);

    // Re-inserting the same favorite (idempotent)
    const addedAgain = await db.addFavorite(1001, w1);
    expect(addedAgain).toBe(true);

    const list = await db.getFavorites(1001);
    expect(list.total).toBe(1);
    expect(list.wallpapers.length).toBe(1);
    expect(list.wallpapers[0].title).toBe('Scenic Sunset');
  });

  it('3. should isolate user favorites completely (User Data Isolation)', async () => {
    const w1 = mockWallpaper('wallhaven', 'w111', 'User 1 Wallpaper');
    const w2 = mockWallpaper('wallhaven', 'w222', 'User 2 Wallpaper');

    await db.addFavorite(1001, w1);
    await db.addFavorite(2002, w2);

    // User 1001 only sees w1
    const favsUser1 = await db.getFavorites(1001);
    expect(favsUser1.total).toBe(1);
    expect(favsUser1.wallpapers[0].providerPostId).toBe('w111');
    expect(await db.isFavorite(1001, 'wallhaven', 'w222')).toBe(false);

    // User 2002 only sees w2
    const favsUser2 = await db.getFavorites(2002);
    expect(favsUser2.total).toBe(1);
    expect(favsUser2.wallpapers[0].providerPostId).toBe('w222');
    expect(await db.isFavorite(2002, 'wallhaven', 'w111')).toBe(false);
  });

  it('4. should remove favorite and update total count', async () => {
    const w = mockWallpaper('wallhaven', 'del1', 'To Delete');
    await db.addFavorite(1001, w);

    expect(await db.isFavorite(1001, 'wallhaven', 'del1')).toBe(true);

    const removed = await db.removeFavorite(1001, 'wallhaven', 'del1');
    expect(removed).toBe(true);

    expect(await db.isFavorite(1001, 'wallhaven', 'del1')).toBe(false);
    const list = await db.getFavorites(1001);
    expect(list.total).toBe(0);
  });

  it('5. should record search history and avoid duplicate adjacent entries', async () => {
    const userId = 5001;

    // Search 1: landscape
    await db.addSearchHistory(userId, 'landscape');
    // Search 2: landscape again (adjacent duplicate)
    await db.addSearchHistory(userId, 'landscape');

    let history = await db.getSearchHistory(userId);
    expect(history.length).toBe(1);
    expect(history[0].query).toBe('landscape');

    // Search 3: sunset
    await db.addSearchHistory(userId, 'sunset');
    history = await db.getSearchHistory(userId);
    expect(history.length).toBe(2);
    expect(history[0].query).toBe('sunset');
    expect(history[1].query).toBe('landscape');
  });

  it('6. should enforce search history limit of 20 entries per user', async () => {
    const userId = 6001;

    for (let i = 1; i <= 25; i++) {
      await db.addSearchHistory(userId, `search query ${i}`);
    }

    const history = await db.getSearchHistory(userId, 50);
    expect(history.length).toBe(20);
    expect(history[0].query).toBe('search query 25');
  });

  it('7. should clear search history on demand', async () => {
    const userId = 7001;
    await db.addSearchHistory(userId, 'query to clear');
    expect((await db.getSearchHistory(userId)).length).toBe(1);

    await db.clearSearchHistory(userId);
    expect((await db.getSearchHistory(userId)).length).toBe(0);
  });

  it('8. should cache and retrieve Telegram file_id', async () => {
    const provider = 'wallhaven';
    const wallpaperId = 'gp123';
    const fakeFileId = 'AgACAgIAAxkBAAI...test_file_id';

    // Verify initial cache miss
    const initial = await db.getCachedTelegramFile(provider, wallpaperId);
    expect(initial).toBeNull();

    // Cache the file_id
    await db.setCachedTelegramFile(provider, wallpaperId, fakeFileId);

    // Verify cache hit
    const cached = await db.getCachedTelegramFile(provider, wallpaperId);
    expect(cached).toBe(fakeFileId);
  });

  it('9. should save and retrieve pagination search sessions', async () => {
    const sessionId = 's_test_123';
    const userId = 8001;
    const query = 'cyberpunk';
    const filters = JSON.stringify({ query, resolution: '4k' });

    await db.saveSearchSession(sessionId, userId, query, filters, 1, 3600);

    const session = await db.getSearchSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.session_id).toBe(sessionId);
    expect(session?.telegram_user_id).toBe(userId);
    expect(session?.query).toBe('cyberpunk');
  });

  it('10. should record and retrieve reverse search history in D1', async () => {
    const userId = 9001;
    await db.addReverseSearchHistory(userId, 'saucenao', {
      title: 'Test Illustration',
      similarity: 95.5,
      author: 'TestArtist'
    });

    const history = await db.getReverseSearchHistory(userId);
    expect(history).toHaveLength(1);
    expect(history[0].provider).toBe('saucenao');
    expect(history[0].result_metadata.title).toBe('Test Illustration');
  });

  it('11. should enforce daily rate limit and increment api_usage in D1', async () => {
    const userId = 9002;
    const provider = 'saucenao';

    // Limit to 2 for testing
    const req1 = await db.checkAndIncrementApiUsage(userId, provider, 2);
    expect(req1.allowed).toBe(true);
    expect(req1.remaining).toBe(1);
    expect(req1.count).toBe(1);

    const req2 = await db.checkAndIncrementApiUsage(userId, provider, 2);
    expect(req2.allowed).toBe(true);
    expect(req2.remaining).toBe(0);
    expect(req2.count).toBe(2);

    const req3 = await db.checkAndIncrementApiUsage(userId, provider, 2);
    expect(req3.allowed).toBe(false);
    expect(req3.remaining).toBe(0);
  });
});
