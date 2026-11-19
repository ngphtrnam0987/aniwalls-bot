import { Hono } from 'hono';
import { Env, DbClient } from '../db/client';
import { TelegramService } from '../services/telegram-service';
import { SearchEngine } from '../providers';
import { DownloadService } from '../services/download-service';
import { SauceNaoService } from '../services/saucenao-service';
import { TraceMoeService } from '../services/tracemoe-service';
import { SmartSearchService } from '../services/smart-search';
import { TelegramUpdate, TelegramInlineKeyboardMarkup, TelegramInlineKeyboardButton } from '@/shared/types/telegram';
import { Wallpaper } from '@/shared/types/wallpaper';
import { ReverseSearchItem, SceneSearchItem } from '@/shared/types/api';

export const telegramRouter = new Hono<{ Bindings: Env }>();

telegramRouter.post('/webhook', async (c) => {
  const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  const expectedSecret = c.env.TELEGRAM_WEBHOOK_SECRET;

  if (expectedSecret && secretHeader !== expectedSecret) {
    return c.text('Unauthorized', 401);
  }

  const update = await c.req.json<TelegramUpdate>();
  const db = new DbClient(c.env.DB);
  const telegram = new TelegramService(c.env.TELEGRAM_BOT_TOKEN);
  const searchEngine = new SearchEngine({ wallhavenApiKey: c.env.WALLHAVEN_API_KEY });
  const downloadService = new DownloadService(db, telegram);

  // ==========================================
  // 1. HANDLE CALLBACK QUERIES (INLINE BUTTONS)
  // ==========================================
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;
    const data = cb.data || '';

    try {
      // Action: Download original image
      if (data.startsWith('dl:')) {
        const parts = data.split(':');
        const provider = parts[1];
        const postId = parts[2];

        await telegram.answerCallbackQuery(cb.id, { text: '⏳ Đang chuẩn bị tải ảnh gốc...' });

        let wallpaper: Wallpaper | null = null;
        const wallpaperId = `${provider}_${postId}`;
        wallpaper = await searchEngine.getById(wallpaperId);

        if (!wallpaper) {
          const favs = await db.getFavorites(userId, 1, 50);
          const found = favs.wallpapers.find((w) => w.provider === provider && w.providerPostId === postId);
          if (found) wallpaper = found;
        }

        if (!wallpaper) {
          await telegram.sendMessage(userId, '❌ Không thể tìm thấy thông tin hình nền.');
          return c.text('OK');
        }

        const res = await downloadService.deliverOriginalWallpaper(userId, wallpaper);

        if (!res.success && res.fallbackUrl) {
          await telegram.sendMessage(
            userId,
            `⚠️ <b>Không thể gửi trực tiếp:</b> ${res.error || ''}\n\n` +
            `👉 <a href="${res.fallbackUrl}">Bấm vào đây để tải trực tiếp ảnh gốc</a>\n` +
            `👉 <a href="${res.postUrl}">Hoặc mở trang bài đăng nguồn</a>`,
            { parse_mode: 'HTML' }
          );
        }
        return c.text('OK');
      }

      // Action: Toggle Favorite from Search result (fav:add or fav:rem)
      if (data.startsWith('fav:')) {
        const parts = data.split(':');
        const action = parts[1]; // 'add' or 'rem'
        const provider = parts[2];
        const postId = parts[3];
        const sessionId = parts[4];
        const currentIndex = parseInt(parts[5] || '0', 10);

        const wallpaperId = `${provider}_${postId}`;
        let wallpaper = await searchEngine.getById(wallpaperId);

        if (!wallpaper && sessionId) {
          const session = await db.getSearchSession(sessionId);
          if (session) {
            const filters = JSON.parse(session.filters_json);
            const searchRes = await searchEngine.search({ ...filters, page: session.current_page });
            wallpaper = searchRes.wallpapers[currentIndex] || null;
          }
        }

        if (action === 'add') {
          if (wallpaper) {
            await db.addFavorite(userId, wallpaper);
            await telegram.answerCallbackQuery(cb.id, { text: '❤️ Đã thêm vào danh sách yêu thích!' });
          } else {
            await telegram.answerCallbackQuery(cb.id, { text: '❌ Không thể lưu ảnh vào yêu thích.' });
            return c.text('OK');
          }
        } else {
          await db.removeFavorite(userId, provider, postId);
          await telegram.answerCallbackQuery(cb.id, { text: '💔 Đã xóa khỏi danh sách yêu thích.' });
        }

        if (cb.message && wallpaper && sessionId) {
          const isNowFav = action === 'add';
          const session = await db.getSearchSession(sessionId);
          const totalCount = session ? 15 : 1;
          const updatedMarkup = buildWallpaperKeyboard(wallpaper, isNowFav, sessionId, currentIndex, totalCount);

          await telegram.editMessageReplyMarkup(
            cb.message.chat.id,
            cb.message.message_id,
            updatedMarkup
          );
        }
        return c.text('OK');
      }

      // Action: Search Session Navigation (Previous / Next)
      if (data.startsWith('nav:')) {
        const parts = data.split(':');
        const sessionId = parts[1];
        const targetIndex = parseInt(parts[2], 10);

        const session = await db.getSearchSession(sessionId);
        if (!session) {
          await telegram.answerCallbackQuery(cb.id, {
            text: 'Phiên tìm kiếm đã hết hạn. Vui lòng tìm kiếm lại!',
            show_alert: true
          });
          return c.text('OK');
        }

        const filters = JSON.parse(session.filters_json);
        const searchRes = await searchEngine.search({ ...filters, page: session.current_page });

        if (!searchRes.wallpapers || targetIndex < 0 || targetIndex >= searchRes.wallpapers.length) {
          await telegram.answerCallbackQuery(cb.id, { text: 'Không còn kết quả nào khác.' });
          return c.text('OK');
        }

        const wallpaper = searchRes.wallpapers[targetIndex];
        const isFav = await db.isFavorite(userId, wallpaper.provider, wallpaper.providerPostId);

        const caption = buildWallpaperCaption(wallpaper, targetIndex + 1, searchRes.wallpapers.length);
        const markup = buildWallpaperKeyboard(wallpaper, isFav, sessionId, targetIndex, searchRes.wallpapers.length);

        await telegram.answerCallbackQuery(cb.id);

        if (cb.message) {
          await telegram.editMessageMedia(
            cb.message.chat.id,
            cb.message.message_id,
            {
              type: 'photo',
              media: wallpaper.previewUrl,
              caption,
              parse_mode: 'HTML'
            },
            markup
          );
        }
        return c.text('OK');
      }

      // Action: Remove from Favorites list directly (/favorites view)
      if (data.startsWith('fdel:')) {
        const parts = data.split(':');
        const provider = parts[1];
        const postId = parts[2];
        const currentIndex = parseInt(parts[3] || '0', 10);

        await db.removeFavorite(userId, provider, postId);
        await telegram.answerCallbackQuery(cb.id, { text: '💔 Đã xóa khỏi yêu thích!' });

        const favResult = await db.getFavorites(userId, 1, 50);
        if (!favResult.wallpapers || favResult.wallpapers.length === 0) {
          if (cb.message) {
            await telegram.sendMessage(userId, '❤️ <b>Bạn chưa có hình nền nào trong danh sách yêu thích.</b>', { parse_mode: 'HTML' });
          }
          return c.text('OK');
        }

        const nextIndex = Math.min(currentIndex, favResult.wallpapers.length - 1);
        const nextWallpaper = favResult.wallpapers[nextIndex];
        const caption = buildFavoritesCaption(nextWallpaper, nextIndex + 1, favResult.total);
        const markup = buildFavoritesKeyboard(nextWallpaper, nextIndex, favResult.wallpapers.length);

        if (cb.message) {
          await telegram.editMessageMedia(
            cb.message.chat.id,
            cb.message.message_id,
            {
              type: 'photo',
              media: nextWallpaper.previewUrl,
              caption,
              parse_mode: 'HTML'
            },
            markup
          );
        }
        return c.text('OK');
      }

      // Action: Favorites navigation (fnav:index)
      if (data.startsWith('fnav:')) {
        const targetIndex = parseInt(data.split(':')[1], 10);
        const favResult = await db.getFavorites(userId, 1, 50);

        if (!favResult.wallpapers || targetIndex < 0 || targetIndex >= favResult.wallpapers.length) {
          await telegram.answerCallbackQuery(cb.id, { text: 'Không còn mục nào khác.' });
          return c.text('OK');
        }

        const nextWallpaper = favResult.wallpapers[targetIndex];
        const caption = buildFavoritesCaption(nextWallpaper, targetIndex + 1, favResult.total);
        const markup = buildFavoritesKeyboard(nextWallpaper, targetIndex, favResult.wallpapers.length);

        await telegram.answerCallbackQuery(cb.id);

        if (cb.message) {
          await telegram.editMessageMedia(
            cb.message.chat.id,
            cb.message.message_id,
            {
              type: 'photo',
              media: nextWallpaper.previewUrl,
              caption,
              parse_mode: 'HTML'
            },
            markup
          );
        }
        return c.text('OK');
      }

      // Action: Quick repeat search from /history
      if (data.startsWith('qsearch:')) {
        const queryText = decodeURIComponent(data.slice(8));
        await telegram.answerCallbackQuery(cb.id, { text: `🔍 Đang tìm kiếm: ${queryText}` });
        await executeSearchAndReply(telegram, db, searchEngine, userId, queryText, c.env.AI);
        return c.text('OK');
      }

      // Action: Clear Search History
      if (data === 'hist_clear') {
        await db.clearSearchHistory(userId);
        await telegram.answerCallbackQuery(cb.id, { text: '🗑️ Đã xóa sạch lịch sử tìm kiếm!' });

        if (cb.message) {
          await telegram.sendMessage(userId, '🗑️ <b>Lịch sử tìm kiếm đã được dọn sạch.</b>', { parse_mode: 'HTML' });
        }
        return c.text('OK');
      }

      // Action: Trigger Reverse Search via SauceNAO from Photo choice
      if (data.startsWith('rev:sauce:')) {
        const fileId = data.slice(10);
        await telegram.answerCallbackQuery(cb.id, { text: '⏳ Đang phân tích nguồn tranh qua SauceNAO...' });
        await handleSauceNaoSearch(telegram, db, fileId, userId, c.env.SAUCENAO_API_KEY, searchEngine);
        return c.text('OK');
      }

      // Action: Trigger Scene Recognition via trace.moe from Photo choice
      if (data.startsWith('rev:scene:')) {
        const fileId = data.slice(10);
        await telegram.answerCallbackQuery(cb.id, { text: '⏳ Đang nhận diện tập phim qua trace.moe...' });
        await handleTraceMoeSearch(telegram, db, fileId, userId, searchEngine);
        return c.text('OK');
      }

      // Action: Find High Resolution Wallpapers from reverse search result
      if (data.startsWith('rev:hires:')) {
        const sessionId = data.slice(10);
        const session = await db.getSearchSession(sessionId);

        if (!session) {
          await telegram.answerCallbackQuery(cb.id, { text: 'Phiên tìm kiếm đã hết hạn.' });
          return c.text('OK');
        }

        await telegram.answerCallbackQuery(cb.id, { text: `✨ Tìm hình nền chất lượng cao: ${session.query}` });
        await executeSearchAndReply(telegram, db, searchEngine, userId, session.query, c.env.AI);
        return c.text('OK');
      }

      await telegram.answerCallbackQuery(cb.id);
    } catch (err) {
      console.error('Callback query execution error:', err);
      await telegram.answerCallbackQuery(cb.id, { text: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }

    return c.text('OK');
  }

  // ==========================================
  // 2. HANDLE MESSAGES & COMMANDS
  // ==========================================
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) return c.text('OK');

    // Upsert user profile into Cloudflare D1
    await db.upsertUser({
      telegram_user_id: user.id,
      username: user.username,
      language: user.language_code || 'vi'
    });

    const text = (msg.text || msg.caption || '').trim();
    const photo = msg.photo && msg.photo.length > 0 ? msg.photo[msg.photo.length - 1] : null;

    // Handle Photo Message
    if (photo) {
      if (text.startsWith('/sauce')) {
        await handleSauceNaoSearch(telegram, db, photo.file_id, chatId, c.env.SAUCENAO_API_KEY, searchEngine);
        return c.text('OK');
      }
      if (text.startsWith('/scene')) {
        await handleTraceMoeSearch(telegram, db, photo.file_id, chatId, searchEngine);
        return c.text('OK');
      }

      // User sent photo without command -> Prompt interactive menu
      const buttons: TelegramInlineKeyboardButton[][] = [
        [
          { text: '🔎 Tìm nguồn tranh vẽ (SauceNAO)', callback_data: `rev:sauce:${photo.file_id}` }
        ],
        [
          { text: '🎬 Nhận diện tập phim Anime (trace.moe)', callback_data: `rev:scene:${photo.file_id}` }
        ]
      ];

      await telegram.sendMessage(
        chatId,
        `📸 <b>Bạn vừa gửi một hình ảnh!</b>\n\n` +
        `Bạn muốn tìm kiếm thông tin gì từ hình ảnh này? Vui lòng chọn bên dưới:`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: buttons }
        }
      );
      return c.text('OK');
    }

    if (!text) return c.text('OK');

    // Command: /start
    if (text === '/start') {
      const welcomeText =
        `🎴 <b>Chào mừng bạn đến với AniWalls!</b>\n\n` +
        `Kho hình nền anime chất lượng cao hỗ trợ 1080p, 2K QHD, 4K UHD và 8K UHD từ nguồn Wallhaven công khai.\n\n` +
        `⚡ <b>Các tính năng & lệnh nổi bật:</b>\n` +
        `• <code>/search &lt;từ khóa&gt;</code> – Tìm hình nền theo tên nhân vật, phong cảnh hoặc câu mô tả tự nhiên\n` +
        `• <code>/sauce</code> – Tìm nguồn gốc tranh vẽ, tác giả và link bài đăng gốc (gửi kèm ảnh hoặc reply ảnh)\n` +
        `• <code>/scene</code> – Nhận diện tên anime, tập phim và thời điểm từ ảnh chụp màn hình\n` +
        `• <code>/favorites</code> – Xem danh sách hình nền bạn đã lưu\n` +
        `• <code>/history</code> – Xem và lặp lại các tìm kiếm gần đây\n` +
        `• <code>/help</code> – Hướng dẫn chi tiết cú pháp lọc nâng cao\n\n` +
        `💡 <i>Bạn cũng có thể gửi trực tiếp một hình ảnh để tìm nguồn hoặc nhận diện phim anime!</i>`;

      await telegram.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
      return c.text('OK');
    }

    // Command: /help
    if (text === '/help') {
      const helpText =
        `📖 <b>HƯỚNG DẪN SỬ DỤNG ANIWALLS</b>\n\n` +
        `<b>1. Tìm kiếm hình nền thông minh:</b>\n` +
        `• Gõ trực tiếp câu miêu tả tự nhiên:\n` +
        `  <i>Ví dụ:</i> <code>phong cảnh thành phố cyberpunk 4k pc</code>\n` +
        `  <i>Ví dụ:</i> <code>cô gái dưới mưa hoa anh đào điện thoại</code>\n\n` +
        `<b>2. Tìm nguồn tranh vẽ (/sauce):</b>\n` +
        `• Gửi ảnh kèm chú thích <code>/sauce</code> hoặc reply ảnh với lệnh <code>/sauce</code>.\n` +
        `• Bot sẽ phân tích qua cơ sở dữ liệu SauceNAO, trả về tên tác giả, link Pixiv/Twitter và nút tìm ảnh 4K tương tự.\n\n` +
        `<b>3. Nhận diện tập phim Anime (/scene):</b>\n` +
        `• Gửi ảnh chụp màn hình kèm chú thích <code>/scene</code> hoặc reply ảnh với lệnh <code>/scene</code>.\n` +
        `• Bot sẽ nhận diện tên anime, tập phim, phút giây chính xác qua trace.moe.\n\n` +
        `<b>4. Lọc độ phân giải & thiết bị:</b>\n` +
        `• Độ phân giải: <code>4k</code>, <code>2k</code>, <code>1080p</code>, <code>8k</code>\n` +
        `• Thiết bị: <code>mobile</code> / <code>phone</code> (dọc), <code>desktop</code> / <code>pc</code> (ngang), <code>ultrawide</code> (21:9)`;

      await telegram.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
      return c.text('OK');
    }

    // Command: /sauce (as text without photo attached)
    if (text.startsWith('/sauce')) {
      const replyPhoto = msg.reply_to_message?.photo && msg.reply_to_message.photo.length > 0
        ? msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1]
        : null;

      if (!replyPhoto) {
        await telegram.sendMessage(
          chatId,
          `💡 <i>Vui lòng gửi kèm hình ảnh hoặc trả lời (Reply) vào một ảnh đã gửi trước đó kèm lệnh /sauce để tìm nguồn tranh vẽ.</i>`,
          { parse_mode: 'HTML' }
        );
        return c.text('OK');
      }

      await handleSauceNaoSearch(telegram, db, replyPhoto.file_id, chatId, c.env.SAUCENAO_API_KEY, searchEngine);
      return c.text('OK');
    }

    // Command: /scene (as text without photo attached)
    if (text.startsWith('/scene')) {
      const replyPhoto = msg.reply_to_message?.photo && msg.reply_to_message.photo.length > 0
        ? msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1]
        : null;

      if (!replyPhoto) {
        await telegram.sendMessage(
          chatId,
          `💡 <i>Vui lòng gửi kèm ảnh chụp màn hình anime hoặc trả lời (Reply) vào một ảnh có sẵn kèm lệnh /scene để nhận diện tập phim.</i>`,
          { parse_mode: 'HTML' }
        );
        return c.text('OK');
      }

      await handleTraceMoeSearch(telegram, db, replyPhoto.file_id, chatId, searchEngine);
      return c.text('OK');
    }

    // Command: /favorites
    if (text === '/favorites') {
      const favResult = await db.getFavorites(user.id, 1, 50);

      if (!favResult.wallpapers || favResult.wallpapers.length === 0) {
        await telegram.sendMessage(
          chatId,
          `❤️ <b>Danh sách yêu thích đang trống!</b>\n\n` +
          `Bạn chưa lưu hình nền nào. Khi tìm kiếm hình nền, hãy bấm nút <b>[❤️ Favorite]</b> trên bức ảnh để lưu vào đây nhé!`,
          { parse_mode: 'HTML' }
        );
        return c.text('OK');
      }

      const firstFav = favResult.wallpapers[0];
      const caption = buildFavoritesCaption(firstFav, 1, favResult.total);
      const keyboard = buildFavoritesKeyboard(firstFav, 0, favResult.wallpapers.length);

      await telegram.sendPhoto(chatId, firstFav.previewUrl, {
        caption,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      return c.text('OK');
    }

    // Command: /history
    if (text === '/history') {
      const history = await db.getSearchHistory(user.id, 6);

      if (history.length === 0) {
        await telegram.sendMessage(chatId, '🕒 <b>Lịch sử tìm kiếm của bạn đang trống.</b>', { parse_mode: 'HTML' });
        return c.text('OK');
      }

      let historyText = `🕒 <b>Lịch sử tìm kiếm gần đây:</b>\n\n`;
      const buttons: TelegramInlineKeyboardButton[][] = [];

      history.forEach((h, idx) => {
        historyText += `${idx + 1}. <code>${escapeHtml(h.query)}</code>\n`;
        buttons.push([
          {
            text: `🔍 Tìm lại: ${h.query}`,
            callback_data: `qsearch:${encodeURIComponent(h.query).slice(0, 45)}`
          }
        ]);
      });

      buttons.push([
        { text: '🗑️ Xóa toàn bộ lịch sử', callback_data: 'hist_clear' }
      ]);

      await telegram.sendMessage(chatId, historyText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
      return c.text('OK');
    }

    // Search command or plain text query
    let queryStr = text;
    if (text.startsWith('/search')) {
      queryStr = text.replace(/^\/search\s*/i, '').trim();
    }

    if (!queryStr) {
      await telegram.sendMessage(
        chatId,
        '🔎 Vui lòng nhập từ khóa hoặc câu miêu tả tìm kiếm.\n<i>Ví dụ:</i> <code>/search landscape 4k pc</code> hoặc <code>thành phố cyberpunk màu tím</code>',
        { parse_mode: 'HTML' }
      );
      return c.text('OK');
    }

    await executeSearchAndReply(telegram, db, searchEngine, chatId, queryStr, c.env.AI);
    return c.text('OK');
  }

  return c.text('OK');
});

// ==========================================
// REVERSE SEARCH & SCENE HANDLERS
// ==========================================

async function handleSauceNaoSearch(
  telegram: TelegramService,
  db: DbClient,
  fileId: string,
  chatId: number,
  sauceNaoApiKey?: string,
  searchEngine?: SearchEngine
): Promise<void> {
  const file = await telegram.getFile(fileId);
  if (!file?.file_path) {
    await telegram.sendMessage(chatId, '❌ Không thể tải hình ảnh từ Telegram. Vui lòng thử lại sau.');
    return;
  }

  const downloadUrl = telegram.getFileDownloadUrl(file.file_path);
  const sauceService = new SauceNaoService(sauceNaoApiKey);

  await telegram.sendMessage(chatId, '🔍 <i>Đang phân tích hình ảnh qua cơ sở dữ liệu SauceNAO...</i>', { parse_mode: 'HTML' });

  const result = await sauceService.searchByImageUrl(downloadUrl);

  if (!result.success) {
    await telegram.sendMessage(chatId, `⚠️ ${result.message || 'Không thể tìm kiếm nguồn ảnh.'}`);
    return;
  }

  if (result.results.length === 0) {
    await telegram.sendMessage(chatId, '❌ Không tìm thấy nguồn phù hợp trên cơ sở dữ liệu tranh vẽ.');
    return;
  }

  const topMatch = result.results[0];

  // Record reverse search history
  await db.addReverseSearchHistory(chatId, 'saucenao', topMatch);

  // Extract high res query if possible
  const hiresQuery = sauceService.extractHighResQuery(topMatch);

  let sessionId = '';
  if (hiresQuery) {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await db.saveSearchSession(sessionId, chatId, hiresQuery, JSON.stringify({ query: hiresQuery }), 1, 86400);
  }

  const caption = buildSauceCaption(topMatch);
  const keyboard = buildSauceKeyboard(topMatch, sessionId);

  if (topMatch.thumbnailUrl) {
    await telegram.sendPhoto(chatId, topMatch.thumbnailUrl, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  } else {
    await telegram.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
}

async function handleTraceMoeSearch(
  telegram: TelegramService,
  db: DbClient,
  fileId: string,
  chatId: number,
  searchEngine?: SearchEngine
): Promise<void> {
  const file = await telegram.getFile(fileId);
  if (!file?.file_path) {
    await telegram.sendMessage(chatId, '❌ Không thể tải hình ảnh từ Telegram. Vui lòng thử lại sau.');
    return;
  }

  const downloadUrl = telegram.getFileDownloadUrl(file.file_path);
  const traceService = new TraceMoeService();

  await telegram.sendMessage(chatId, '🎬 <i>Đang nhận diện cảnh phim anime qua trace.moe...</i>', { parse_mode: 'HTML' });

  const result = await traceService.searchByImageUrl(downloadUrl);

  if (!result.success) {
    await telegram.sendMessage(chatId, `⚠️ ${result.message || 'Không thể nhận diện cảnh phim anime.'}`);
    return;
  }

  if (result.results.length === 0) {
    await telegram.sendMessage(chatId, '❌ Không tìm thấy cảnh phim anime trùng khớp.');
    return;
  }

  const topMatch = result.results[0];

  // Record history
  await db.addReverseSearchHistory(chatId, 'tracemoe', topMatch);

  const animeTitle = traceService.extractWallpaperQuery(topMatch);
  let sessionId = '';
  if (animeTitle) {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await db.saveSearchSession(sessionId, chatId, animeTitle, JSON.stringify({ query: animeTitle }), 1, 86400);
  }

  const caption = buildSceneCaption(topMatch);
  const keyboard = buildSceneKeyboard(topMatch, sessionId);

  if (topMatch.imagePreviewUrl) {
    await telegram.sendPhoto(chatId, topMatch.imagePreviewUrl, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  } else {
    await telegram.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
}

// ==========================================
// SEARCH EXECUTION & FORMATTING
// ==========================================

async function executeSearchAndReply(
  telegram: TelegramService,
  db: DbClient,
  searchEngine: SearchEngine,
  chatId: number,
  rawQuery: string,
  aiBinding?: any
): Promise<void> {
  await telegram.sendMessage(chatId, '🔎 <i>Đang tìm kiếm hình nền chất lượng cao...</i>', { parse_mode: 'HTML' });

  // Get user settings from D1
  const userSettings = await db.getUserSettings(chatId);

  // Interpret natural language / extract tags via Smart Search
  const smartSearch = new SmartSearchService(aiBinding);
  const parsed = await smartSearch.interpretQuery(rawQuery);

  const searchFilters = {
    query: parsed.keywords,
    providers: userSettings.enabled_providers,
    resolution: parsed.resolution !== 'all' ? parsed.resolution : userSettings.preferred_resolution,
    orientation: parsed.orientation !== 'all' ? parsed.orientation : userSettings.preferred_orientation,
    sort: 'relevance' as const,
    page: 1,
    limit: 15,
    sfwOnly: true
  };

  const searchResult = await searchEngine.search(searchFilters);

  if (!searchResult.wallpapers || searchResult.wallpapers.length === 0) {
    await telegram.sendMessage(
      chatId,
      `❌ Không tìm thấy hình nền phù hợp cho: <b>${escapeHtml(rawQuery)}</b>\n\n` +
      `💡 <i>Gợi ý:</i> Thử dùng từ khóa ngắn gọn hơn (ví dụ: <code>sky</code>, <code>night</code>, <code>cyberpunk</code>).`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Save to search history
  await db.addSearchHistory(chatId, rawQuery, JSON.stringify(searchFilters));

  // Create search session for inline pagination
  const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await db.saveSearchSession(sessionId, chatId, parsed.keywords, JSON.stringify(searchFilters), 1, 86400);

  // Pick first wallpaper
  const firstWallpaper = searchResult.wallpapers[0];
  const isFav = await db.isFavorite(chatId, firstWallpaper.provider, firstWallpaper.providerPostId);

  const caption = buildWallpaperCaption(firstWallpaper, 1, searchResult.wallpapers.length, parsed.explanation);
  const keyboard = buildWallpaperKeyboard(firstWallpaper, isFav, sessionId, 0, searchResult.wallpapers.length);

  await telegram.sendPhoto(chatId, firstWallpaper.previewUrl, {
    caption,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildWallpaperCaption(w: Wallpaper, index: number, total: number, extraNote?: string): string {
  let sizeText = 'N/A';
  if (w.fileSize) {
    sizeText = `${(w.fileSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  const artistText = w.artistName && w.artistName !== 'Chưa xác định'
    ? escapeHtml(w.artistName)
    : 'Chưa xác định';

  let caption =
    `🎴 <b>AniWalls | Result ${index}/${total}</b>\n\n` +
    `🎨 <b>Title:</b> ${escapeHtml(w.title)}\n` +
    `📐 <b>Resolution:</b> ${w.resolution.replace('x', '×')}\n` +
    `🖥 <b>Aspect Ratio:</b> ${w.aspectRatio}\n` +
    `💾 <b>Size:</b> ${sizeText}\n` +
    `🌐 <b>Provider:</b> ${w.provider.toUpperCase()}\n` +
    `👤 <b>Artist:</b> ${artistText}`;

  if (extraNote) {
    caption += `\n\n💡 <i>${escapeHtml(extraNote)}</i>`;
  }

  return caption;
}

function buildWallpaperKeyboard(
  w: Wallpaper,
  isFavorite: boolean,
  sessionId: string,
  currentIndex: number,
  totalCount: number
): TelegramInlineKeyboardMarkup {
  const buttons: TelegramInlineKeyboardButton[][] = [];

  // Row 1: [⬇️ Download Original] [🔗 Original Image URL]
  const row1: TelegramInlineKeyboardButton[] = [
    { text: '⬇️ Download Original', callback_data: `dl:${w.provider}:${w.providerPostId}` }
  ];
  if (w.originalFileUrl) {
    row1.push({ text: '🔗 Original Image URL', url: w.originalFileUrl });
  }
  buttons.push(row1);

  // Row 2: [🌐 Source Post] [👤 Artist Profile] (when available)
  const row2: TelegramInlineKeyboardButton[] = [
    { text: '🌐 Source Post', url: w.postUrl }
  ];
  if (w.artistUrl || w.externalSourceUrl) {
    row2.push({ text: '👤 Artist Profile', url: w.artistUrl || w.externalSourceUrl! });
  }
  buttons.push(row2);

  // Row 3: [❤️ Favorite] or [💔 Remove Favorite]
  const favCallback = isFavorite
    ? `fav:rem:${w.provider}:${w.providerPostId}:${sessionId}:${currentIndex}`
    : `fav:add:${w.provider}:${w.providerPostId}:${sessionId}:${currentIndex}`;

  buttons.push([
    {
      text: isFavorite ? '💔 Remove Favorite' : '❤️ Favorite',
      callback_data: favCallback
    }
  ]);

  // Row 4: [⬅️ Previous] [Next ➡️]
  const navRow: TelegramInlineKeyboardButton[] = [];
  if (currentIndex > 0) {
    navRow.push({ text: '⬅️ Previous', callback_data: `nav:${sessionId}:${currentIndex - 1}` });
  }
  if (currentIndex < totalCount - 1) {
    navRow.push({ text: 'Next ➡️', callback_data: `nav:${sessionId}:${currentIndex + 1}` });
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  return { inline_keyboard: buttons };
}

function buildFavoritesCaption(w: Wallpaper, index: number, total: number): string {
  let sizeText = 'N/A';
  if (w.fileSize) {
    sizeText = `${(w.fileSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  const artistText = w.artistName && w.artistName !== 'Chưa xác định'
    ? escapeHtml(w.artistName)
    : 'Chưa xác định';

  return (
    `❤️ <b>AniWalls | Yêu thích ${index}/${total}</b>\n\n` +
    `🎨 <b>Title:</b> ${escapeHtml(w.title)}\n` +
    `📐 <b>Resolution:</b> ${w.resolution.replace('x', '×')}\n` +
    `🖥 <b>Aspect Ratio:</b> ${w.aspectRatio}\n` +
    `💾 <b>Size:</b> ${sizeText}\n` +
    `🌐 <b>Provider:</b> ${w.provider.toUpperCase()}\n` +
    `👤 <b>Artist:</b> ${artistText}`
  );
}

function buildFavoritesKeyboard(
  w: Wallpaper,
  currentIndex: number,
  totalCount: number
): TelegramInlineKeyboardMarkup {
  const buttons: TelegramInlineKeyboardButton[][] = [];

  const row1: TelegramInlineKeyboardButton[] = [
    { text: '⬇️ Download Original', callback_data: `dl:${w.provider}:${w.providerPostId}` }
  ];
  if (w.originalFileUrl) {
    row1.push({ text: '🔗 Original Image URL', url: w.originalFileUrl });
  }
  buttons.push(row1);

  const row2: TelegramInlineKeyboardButton[] = [
    { text: '🌐 Source Post', url: w.postUrl }
  ];
  if (w.artistUrl || w.externalSourceUrl) {
    row2.push({ text: '👤 Artist Profile', url: w.artistUrl || w.externalSourceUrl! });
  }
  buttons.push(row2);

  buttons.push([
    { text: '💔 Remove Favorite', callback_data: `fdel:${w.provider}:${w.providerPostId}:${currentIndex}` }
  ]);

  const navRow: TelegramInlineKeyboardButton[] = [];
  if (currentIndex > 0) {
    navRow.push({ text: '⬅️ Previous', callback_data: `fnav:${currentIndex - 1}` });
  }
  if (currentIndex < totalCount - 1) {
    navRow.push({ text: 'Next ➡️', callback_data: `fnav:${currentIndex + 1}` });
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  return { inline_keyboard: buttons };
}

function buildSauceCaption(r: ReverseSearchItem): string {
  const sim = r.similarity.toFixed(1);
  const barBlocks = Math.min(5, Math.max(1, Math.round(r.similarity / 20)));
  const bar = '🟩'.repeat(barBlocks) + '⬜'.repeat(5 - barBlocks);

  let text = `🔎 <b>KẾT QUẢ TÌM NGUỒN TRANH (SauceNAO)</b>\n\n`;
  text += `📊 <b>Độ khớp:</b> [${bar}] ${sim}% (${r.confidenceLabel.toUpperCase()})\n`;
  if (r.title) text += `🎨 <b>Tiêu đề:</b> ${escapeHtml(r.title)}\n`;
  if (r.series) text += `📚 <b>Series:</b> ${escapeHtml(r.series)}\n`;
  if (r.character) text += `👤 <b>Nhân vật:</b> ${escapeHtml(r.character)}\n`;
  if (r.authorName) text += `🖌 <b>Tác giả:</b> ${escapeHtml(r.authorName)}\n`;

  return text;
}

function buildSauceKeyboard(r: ReverseSearchItem, sessionId: string): TelegramInlineKeyboardMarkup {
  const buttons: TelegramInlineKeyboardButton[][] = [];

  const row1: TelegramInlineKeyboardButton[] = [];
  if (r.sourceUrl) {
    row1.push({ text: '🌐 Trang nguồn tác giả', url: r.sourceUrl });
  }
  if (r.authorUrl) {
    row1.push({ text: '👤 Hồ sơ tác giả', url: r.authorUrl });
  }
  if (row1.length > 0) buttons.push(row1);

  if (sessionId) {
    buttons.push([
      { text: '✨ Tìm hình nền chất lượng cao', callback_data: `rev:hires:${sessionId}` }
    ]);
  }

  return { inline_keyboard: buttons };
}

function buildSceneCaption(r: SceneSearchItem): string {
  const sim = r.similarity.toFixed(1);
  const barBlocks = Math.min(5, Math.max(1, Math.round(r.similarity / 20)));
  const bar = '🟩'.repeat(barBlocks) + '⬜'.repeat(5 - barBlocks);

  let text = `🎬 <b>NHẬN DIỆN CẢNH PHIM ANIME (trace.moe)</b>\n\n`;
  text += `📺 <b>Tên Anime:</b> ${escapeHtml(r.animeTitle.romaji)}\n`;
  if (r.animeTitle.english) text += `🇬🇧 <b>Tiếng Anh:</b> ${escapeHtml(r.animeTitle.english)}\n`;
  if (r.episode !== null) text += `🎞 <b>Tập phim:</b> Tập ${r.episode}\n`;
  text += `⏱ <b>Thời điểm:</b> ${r.timestampFormatted}\n`;
  text += `📊 <b>Độ khớp:</b> [${bar}] ${sim}% (${r.confidenceLabel.toUpperCase()})\n`;

  return text;
}

function buildSceneKeyboard(r: SceneSearchItem, sessionId: string): TelegramInlineKeyboardMarkup {
  const buttons: TelegramInlineKeyboardButton[][] = [];

  const row1: TelegramInlineKeyboardButton[] = [
    { text: '🌐 Thông tin Anime (AniList)', url: r.anilistUrl }
  ];
  buttons.push(row1);

  if (sessionId) {
    buttons.push([
      { text: '✨ Tìm hình nền Anime này', callback_data: `rev:hires:${sessionId}` }
    ]);
  }

  return { inline_keyboard: buttons };
}
