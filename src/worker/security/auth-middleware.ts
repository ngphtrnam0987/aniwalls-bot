import { Context, Next } from 'hono';
import { Env, DbClient } from '../db/client';
import { validateTelegramWebAppData, ValidatedTelegramUser } from './telegram-auth';

export async function telegramAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: { user?: ValidatedTelegramUser; userId?: number } }>,
  next: Next
) {
  const initData = c.req.header('X-Telegram-Init-Data') || c.req.query('initData');

  if (!initData) {
    return c.json({ success: false, error: 'Yêu cầu xác thực Telegram Mini App (Thiếu initData).' }, 401);
  }

  const botToken = c.env.TELEGRAM_BOT_TOKEN;
  const result = await validateTelegramWebAppData(initData, botToken);

  if (!result.valid || !result.user) {
    return c.json({ success: false, error: result.error || 'Dữ liệu xác thực không hợp lệ.' }, 401);
  }

  c.set('user', result.user);
  c.set('userId', result.user.id);

  // Auto upsert user to D1
  try {
    const db = new DbClient(c.env.DB);
    await db.upsertUser({
      telegram_user_id: result.user.id,
      username: result.user.username,
      language: result.user.language_code || 'vi'
    });
  } catch (err) {
    console.warn('Could not auto-upsert user:', err);
  }

  await next();
}

export async function optionalTelegramAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: { user?: ValidatedTelegramUser; userId?: number } }>,
  next: Next
) {
  const initData = c.req.header('X-Telegram-Init-Data') || c.req.query('initData');

  if (initData) {
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const result = await validateTelegramWebAppData(initData, botToken);

    if (result.valid && result.user) {
      c.set('user', result.user);
      c.set('userId', result.user.id);

      try {
        const db = new DbClient(c.env.DB);
        await db.upsertUser({
          telegram_user_id: result.user.id,
          username: result.user.username,
          language: result.user.language_code || 'vi'
        });
      } catch {}
    }
  }

  await next();
}
