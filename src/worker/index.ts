import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, DbClient } from './db/client';
import { telegramRouter } from './routes/telegram';
import { apiRouter } from './routes/api';
import { SearchEngine } from './providers';
import { TelegramService } from './services/telegram-service';
import { DailyWallpaperService } from './services/daily-service';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for API routes
app.use('/api/*', cors({
  origin: (origin) => {
    // Allow local development and telegram webview origins
    if (!origin) return '*';
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return origin;
    if (origin.endsWith('.workers.dev') || origin.endsWith('.telegram.org') || origin.endsWith('.web.telegram.org')) return origin;
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}));

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled Application Error:', err);
  return c.json({
    success: false,
    error: err.message || 'Lỗi hệ thống nội bộ'
  }, 500);
});

// Mount Routes
app.route('/telegram', telegramRouter);
app.route('/api', apiRouter);

// Root health ping
app.get('/', (c) => {
  return c.text('AniWalls Telegram Bot & Mini App API is running smoothly.');
});

export default {
  // HTTP Fetch handler
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // Cloudflare Cron Trigger Scheduled Handler (Daily Wallpaper)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Cron Trigger] Scheduled event triggered at ${new Date(event.scheduledTime).toISOString()}`);

    const db = new DbClient(env.DB);
    const telegram = new TelegramService(env.TELEGRAM_BOT_TOKEN);
    const searchEngine = new SearchEngine({ wallhavenApiKey: env.WALLHAVEN_API_KEY });
    const dailyService = new DailyWallpaperService(db, telegram, searchEngine, env.APP_BASE_URL);

    ctx.waitUntil(
      dailyService.processDailyDeliveries().then((res) => {
        console.log(`[Cron Trigger] Daily deliveries processed: sent=${res.sent}, skipped=${res.skipped}, errors=${res.errors}`);
      }).catch((err) => {
        console.error('[Cron Trigger] Failed processing daily deliveries:', err);
      })
    );
  }
};
