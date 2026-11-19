import { Hono } from 'hono';
import { Env, DbClient } from '../db/client';
import { SearchEngine } from '../providers';
import { SearchQuerySchema, UserSettingsSchema, SmartSearchRequestSchema } from '@/shared/schemas/search';
import { telegramAuthMiddleware, optionalTelegramAuthMiddleware } from '../security/auth-middleware';
import { ValidatedTelegramUser } from '../security/telegram-auth';
import { isSafePublicImageUrl } from '../security/ssrf';
import { SauceNaoService } from '../services/saucenao-service';
import { TraceMoeService } from '../services/tracemoe-service';
import { SmartSearchService } from '../services/smart-search';

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
apiRouter.get('/search', optionalTelegramAuthMiddleware, async (c) => {
  const queryParams = c.req.query();
  const parsed = SearchQuerySchema.safeParse(queryParams);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const result = await searchEngine.search(parsed.data);

  // If user is authenticated, record search history
  const authUser = c.get('userId');
  if (authUser && parsed.data.query) {
    try {
      const db = new DbClient(c.env.DB);
      await db.addSearchHistory(authUser, parsed.data.query, JSON.stringify(parsed.data));
    } catch {}
  }

  return c.json({ success: true, data: result });
});

// GET /api/random
apiRouter.get('/random', async (c) => {
  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const orientation = (c.req.query('orientation') as any) || 'all';
  const resolution = (c.req.query('resolution') as any) || 'all';

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

// ==========================================
// PHASE 4: REVERSE SEARCH (SauceNAO)
// ==========================================

// POST /api/reverse-search
apiRouter.post('/reverse-search', optionalTelegramAuthMiddleware, async (c) => {
  const db = new DbClient(c.env.DB);
  const userId = c.get('userId') || 0;

  // Rate limit check
  if (userId > 0) {
    const rateCheck = await db.checkAndIncrementApiUsage(userId, 'saucenao', 30);
    if (!rateCheck.allowed) {
      return c.json({
        success: false,
        error: 'Bạn đã đạt giới hạn 30 lượt tìm kiếm nguồn ảnh hôm nay. Vui lòng quay lại vào ngày mai!'
      }, 429);
    }
  }

  const sauceNaoService = new SauceNaoService(c.env.SAUCENAO_API_KEY);
  const contentType = c.req.header('Content-Type') || '';

  let result;
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return c.json({ success: false, error: 'Thiếu file ảnh tải lên.' }, 400);
    }

    const arrayBuffer = await (file as Blob).arrayBuffer();
    result = await sauceNaoService.searchByImageBuffer(arrayBuffer, (file as Blob).type || 'image/jpeg');
  } else {
    const body = await c.req.json<{ image_url: string }>().catch(() => ({ image_url: '' }));
    if (!body.image_url) {
      return c.json({ success: false, error: 'Thiếu image_url hoặc file ảnh.' }, 400);
    }

    if (!isSafePublicImageUrl(body.image_url)) {
      return c.json({ success: false, error: 'URL ảnh không hợp lệ hoặc bị chặn vì lý do an toàn.' }, 400);
    }

    result = await sauceNaoService.searchByImageUrl(body.image_url);
  }

  // Record history if user is authenticated and results returned
  if (userId > 0 && result.success && result.results.length > 0) {
    try {
      await db.addReverseSearchHistory(userId, 'saucenao', result.results[0]);
    } catch {}
  }

  return c.json(result);
});

// ==========================================
// PHASE 4: ANIME SCENE SEARCH (trace.moe)
// ==========================================

// POST /api/scene-search
apiRouter.post('/scene-search', optionalTelegramAuthMiddleware, async (c) => {
  const db = new DbClient(c.env.DB);
  const userId = c.get('userId') || 0;

  // Rate limit check
  if (userId > 0) {
    const rateCheck = await db.checkAndIncrementApiUsage(userId, 'tracemoe', 30);
    if (!rateCheck.allowed) {
      return c.json({
        success: false,
        error: 'Bạn đã đạt giới hạn 30 lượt nhận diện anime hôm nay. Vui lòng quay lại vào ngày mai!'
      }, 429);
    }
  }

  const traceMoeService = new TraceMoeService();
  const contentType = c.req.header('Content-Type') || '';

  let result;
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return c.json({ success: false, error: 'Thiếu file ảnh tải lên.' }, 400);
    }

    const arrayBuffer = await (file as Blob).arrayBuffer();
    result = await traceMoeService.searchByImageBuffer(arrayBuffer, (file as Blob).type || 'image/jpeg');
  } else {
    const body = await c.req.json<{ image_url: string }>().catch(() => ({ image_url: '' }));
    if (!body.image_url) {
      return c.json({ success: false, error: 'Thiếu image_url hoặc file ảnh.' }, 400);
    }

    if (!isSafePublicImageUrl(body.image_url)) {
      return c.json({ success: false, error: 'URL ảnh không hợp lệ hoặc bị chặn vì lý do an toàn.' }, 400);
    }

    result = await traceMoeService.searchByImageUrl(body.image_url);
  }

  // Record history if user is authenticated and results returned
  if (userId > 0 && result.success && result.results.length > 0) {
    try {
      await db.addReverseSearchHistory(userId, 'tracemoe', result.results[0]);
    } catch {}
  }

  return c.json(result);
});

// ==========================================
// PHASE 4: AI SMART SEARCH
// ==========================================

// POST /api/smart-search
apiRouter.post('/smart-search', optionalTelegramAuthMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = SmartSearchRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' }, 400);
  }

  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const smartSearchService = new SmartSearchService(c.env.AI);

  const result = await smartSearchService.search(parsed.data.query, searchEngine, {
    page: parsed.data.page,
    limit: parsed.data.limit
  });

  // Record smart search history
  const userId = c.get('userId');
  if (userId && result.success) {
    try {
      const db = new DbClient(c.env.DB);
      await db.addSmartSearchHistory(userId, parsed.data.query, result.parsed);
    } catch {}
  }

  return c.json(result);
});

// GET /api/search-suggestions
apiRouter.get('/search-suggestions', (c) => {
  return c.json({
    success: true,
    data: {
      popularTags: ['cyberpunk', 'scenery', 'night', 'sakura', 'rain', 'sunset', 'space', 'ocean', 'city', 'clouds', 'minimal', 'moon'],
      resolutions: ['4k', '2k', '1080p', '8k'],
      orientations: [
        { id: 'landscape', label: 'Máy tính (16:9)' },
        { id: 'portrait', label: 'Điện thoại (9:16)' },
        { id: 'ultrawide', label: 'Màn hình dài (21:9)' }
      ],
      sampleSmartPrompts: [
        'hình nền cyberpunk thành phố ban đêm 4k cho máy tính',
        'cô gái anime dưới trời mưa hoa anh đào điện thoại',
        'phong cảnh vũ trụ ngân hà không có người 4k',
        'thành phố anime hoàng hôn tông màu tím 2k cho pc'
      ]
    }
  });
});
