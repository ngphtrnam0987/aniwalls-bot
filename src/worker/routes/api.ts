import { Hono } from 'hono';
import { Env, DbClient } from '../db/client';
import { SearchEngine } from '../providers';
import { SearchQuerySchema, UserSettingsSchema } from '@/shared/schemas/search';
import { telegramAuthMiddleware } from '../security/auth-middleware';
import { ValidatedTelegramUser } from '../security/telegram-auth';
import { SauceNaoService } from '../services/saucenao-service';

export const apiRouter = new Hono<{
  Bindings: Env;
  Variables: { user?: ValidatedTelegramUser; userId?: number };
}>();

// Health Check
apiRouter.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AniWalls API',
    version: '1.0.0'
  });
});

// GET /api/search
apiRouter.get('/search', async (c) => {
  const queryParams = c.req.query();
  const parsed = SearchQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const result = await searchEngine.search(parsed.data);

  // If user is authenticated, record search history
  const initData = c.req.header('X-Telegram-Init-Data');
  if (initData && parsed.data.query) {
    try {
      const db = new DbClient(c.env.DB);
      const authUser = c.get('userId');
      if (authUser) {
        await db.addSearchHistory(authUser, parsed.data.query, JSON.stringify(parsed.data));
      }
    } catch {}
  }

  return c.json({ success: true, data: result });
});

// GET /api/random
apiRouter.get('/random', async (c) => {
  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const orientation = c.req.query('orientation') as any || 'all';
  const resolution = c.req.query('resolution') as any || 'all';

  const result = await searchEngine.search({
    sort: 'random',
    limit: 20,
    page: Math.floor(Math.random() * 5) + 1,
    orientation,
    resolution,
    sfwOnly: true
  });

  return c.json({ success: true, data: result });
});

// GET /api/wallpapers/:id
apiRouter.get('/wallpapers/:id', async (c) => {
  const id = c.req.param('id');
  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const wallpaper = await searchEngine.getById(id);

  if (!wallpaper) {
    return c.json({ success: false, error: 'Không tìm thấy hình nền.' }, 404);
  }

  return c.json({ success: true, data: wallpaper });
});

// --- Authenticated routes ---

// GET /api/favorites
apiRouter.get('/favorites', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const db = new DbClient(c.env.DB);
  const favs = await db.getFavorites(userId, page, limit);

  return c.json({
    success: true,
    data: {
      wallpapers: favs.wallpapers,
      total: favs.total,
      page,
      limit
    }
  });
});

// POST /api/favorites
apiRouter.post('/favorites', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json<{ wallpaper_id: string; wallpaper?: any }>();

  if (!body.wallpaper_id) {
    return c.json({ success: false, error: 'Thiếu wallpaper_id.' }, 400);
  }

  const db = new DbClient(c.env.DB);
  let wallpaper = body.wallpaper;

  if (!wallpaper) {
    const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
    wallpaper = await searchEngine.getById(body.wallpaper_id);
  }

  if (!wallpaper) {
    return c.json({ success: false, error: 'Không tìm thấy thông tin hình nền để lưu.' }, 404);
  }

  await db.addFavorite(userId, wallpaper);
  return c.json({ success: true, message: 'Đã lưu vào danh sách yêu thích.' });
});

// DELETE /api/favorites/:id
apiRouter.delete('/favorites/:id', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const wallpaperId = c.req.param('id');
  if (!wallpaperId) {
    return c.json({ success: false, error: 'Thiếu wallpaper_id.' }, 400);
  }

  const parts = wallpaperId.split('_');
  const provider = parts[0];
  const postId = parts.slice(1).join('_');

  const db = new DbClient(c.env.DB);
  await db.removeFavorite(userId, provider, postId);

  return c.json({ success: true, message: 'Đã xóa khỏi danh sách yêu thích.' });
});

// GET /api/history
apiRouter.get('/history', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const db = new DbClient(c.env.DB);
  const history = await db.getSearchHistory(userId, 20);

  return c.json({ success: true, data: history });
});

// DELETE /api/history
apiRouter.delete('/history', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const db = new DbClient(c.env.DB);
  await db.clearSearchHistory(userId);

  return c.json({ success: true, message: 'Đã xóa toàn bộ lịch sử tìm kiếm.' });
});

// GET /api/settings
apiRouter.get('/settings', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const db = new DbClient(c.env.DB);
  const settings = await db.getUserSettings(userId);

  return c.json({ success: true, data: settings });
});

// PATCH /api/settings
apiRouter.patch('/settings', telegramAuthMiddleware, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json();
  const parsed = UserSettingsSchema.partial().safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const db = new DbClient(c.env.DB);
  await db.updateUserSettings(userId, {
    preferred_resolution: parsed.data.default_resolution,
    preferred_orientation: parsed.data.default_orientation,
    enabled_providers: parsed.data.selected_providers,
    language: 'vi'
  });
  const updated = await db.getUserSettings(userId);

  return c.json({ success: true, data: updated });
});

// POST /api/reverse-search
apiRouter.post('/reverse-search', telegramAuthMiddleware, async (c) => {
  const body = await c.req.json<{ image_url: string }>();
  if (!body.image_url) {
    return c.json({ success: false, error: 'Thiếu image_url.' }, 400);
  }

  const sauceNaoService = new SauceNaoService(c.env.SAUCENAO_API_KEY);
  const result = await sauceNaoService.searchByImageUrl(body.image_url);

  return c.json(result);
});
