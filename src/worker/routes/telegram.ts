import { Hono } from 'hono';
import { Env, DbClient } from '../db/client';
import { TelegramService } from '../services/telegram-service';
import { SearchEngine } from '../providers';
import { DownloadService } from '../services/download-service';
import { TelegramUpdate, TelegramInlineKeyboardMarkup, TelegramInlineKeyboardButton } from '@/shared/types/telegram';
import { Wallpaper, ResolutionFilter, OrientationFilter } from '@/shared/types/wallpaper';

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

        // Retrieve wallpaper metadata
        let wallpaper: Wallpaper | null = null;
        const wallpaperId = `${provider}_${postId}`;
        wallpaper = await searchEngine.getById(wallpaperId);

        if (!wallpaper) {
          // Check favorites
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

        // Seamlessly update reply_markup button text without re-uploading photo
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

        await telegram.answerCallbackQuery(cb.id);
        return c.text('OK');
      }

      // Action: Favorites Navigation (fnav:<index>)
      if (data.startsWith('fnav:')) {
        const targetIndex = parseInt(data.slice(5), 10);
        const favResult = await db.getFavorites(userId, 1, 50);

        if (!favResult.wallpapers || targetIndex < 0 || targetIndex >= favResult.wallpapers.length) {
          await telegram.answerCallbackQuery(cb.id, { text: 'Không còn hình nền yêu thích nào.' });
          return c.text('OK');
        }

        const wallpaper = favResult.wallpapers[targetIndex];
        const caption = buildFavoritesCaption(wallpaper, targetIndex + 1, favResult.total);
        const markup = buildFavoritesKeyboard(wallpaper, targetIndex, favResult.wallpapers.length);

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

        await telegram.answerCallbackQuery(cb.id);
        return c.text('OK');
      }

      // Action: Remove Favorite from Favorites View (fdel:<provider>:<postId>:<index>)
      if (data.startsWith('fdel:')) {
        const parts = data.split(':');
        const provider = parts[1];
        const postId = parts[2];
        const currentIndex = parseInt(parts[3] || '0', 10);

        await db.removeFavorite(userId, provider, postId);
        await telegram.answerCallbackQuery(cb.id, { text: '💔 Đã xóa khỏi yêu thích.' });

        // Load next or previous favorite
        const favResult = await db.getFavorites(userId, 1, 50);

        if (favResult.wallpapers.length === 0) {
          if (cb.message) {
            await telegram.sendMessage(
              cb.message.chat.id,
              '❤️ Danh sách yêu thích của bạn hiện đang trống.'
            );
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

      // Action: Quick repeat search from /history
      if (data.startsWith('qsearch:')) {
        const queryText = decodeURIComponent(data.slice(8));
        await telegram.answerCallbackQuery(cb.id, { text: `🔍 Đang tìm kiếm: ${queryText}` });

        // Execute search
        await executeSearchAndReply(telegram, db, searchEngine, userId, queryText);
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

    const text = (msg.text || '').trim();
    if (!text) return c.text('OK');

    // Command: /start
    if (text === '/start') {
      const welcomeText =
        `🎴 <b>Chào mừng bạn đến với AniWalls!</b>\n\n` +
        `Kho hình nền anime chất lượng cao hỗ trợ 1080p, 2K QHD, 4K UHD và 8K UHD từ nguồn Wallhaven công khai.\n\n` +
        `⚡ <b>Các lệnh khả dụng:</b>\n` +
        `• <code>/search &lt;từ khóa&gt;</code> – Tìm hình nền theo tên nhân vật hoặc phong cảnh\n` +
        `• <code>/favorites</code> – Xem danh sách hình nền bạn đã lưu\n` +
        `• <code>/history</code> – Xem và lặp lại các tìm kiếm gần đây\n` +
        `• <code>/help</code> – Hướng dẫn chi tiết và cú pháp lọc nâng cao\n\n` +
        `💡 <i>Bạn cũng có thể gõ trực tiếp từ khóa vào khung chat để tìm kiếm ngay lập tức!</i>`;

      await telegram.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
      return c.text('OK');
    }

    // Command: /help
    if (text === '/help') {
      const helpText =
        `📖 <b>HƯỚNG DẪN TÌM KIẾM HÌNH NỀN ANIWALLS</b>\n\n` +
        `<b>1. Tìm kiếm cơ bản:</b>\n` +
        `• <code>/search &lt;từ khóa&gt;</code> hoặc gửi tin nhắn thông thường.\n\n` +
        `<b>2. Lọc theo độ phân giải:</b>\n` +
        `• Thêm từ khóa: <code>4k</code>, <code>2k</code>, <code>1080p</code>, <code>8k</code>\n` +
        `  <i>Ví dụ:</i> <code>nature 4k</code>, <code>city 1080p</code>\n\n` +
        `<b>3. Lọc theo tỷ lệ / thiết bị:</b>\n` +
        `• Hình nền điện thoại (9:16): thêm <code>mobile</code> hoặc <code>phone</code>\n` +
        `• Hình nền máy tính (16:9): thêm <code>desktop</code> hoặc <code>pc</code>\n` +
        `• Màn hình siêu rộng (21:9): thêm <code>ultrawide</code>\n\n` +
        `<b>4. Lưu yêu thích & tải ảnh gốc:</b>\n` +
        `• Bấm <b>[❤️ Favorite]</b> để lưu ảnh vào bộ sưu tập cá nhân.\n` +
        `• Bấm <b>[⬇️ Download Original]</b> để tải trực tiếp ảnh gốc không nén.\n` +
        `• Xem lại bộ sưu tập bất cứ lúc nào bằng lệnh <code>/favorites</code>.`;

      await telegram.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
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

      // Display the first favorite with navigation controls
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
        '🔎 Vui lòng nhập từ khóa tìm kiếm.\n<i>Ví dụ:</i> <code>/search landscape 4k</code> hoặc <code>city mobile</code>',
        { parse_mode: 'HTML' }
      );
      return c.text('OK');
    }

    await executeSearchAndReply(telegram, db, searchEngine, chatId, queryStr);
    return c.text('OK');
  }

  return c.text('OK');
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function executeSearchAndReply(
  telegram: TelegramService,
  db: DbClient,
  searchEngine: SearchEngine,
  chatId: number,
  rawQuery: string
): Promise<void> {
  await telegram.sendMessage(chatId, '🔎 <i>Đang tìm kiếm hình nền chất lượng cao...</i>', { parse_mode: 'HTML' });

  // Get user settings from D1
  const userSettings = await db.getUserSettings(chatId);

  const searchFilters = {
    query: rawQuery,
    providers: userSettings.enabled_providers,
    resolution: userSettings.preferred_resolution,
    orientation: userSettings.preferred_orientation,
    sort: 'relevance' as const,
    page: 1,
    limit: 15,
    sfwOnly: true
  };

  const searchResult = await searchEngine.search(searchFilters);

  if (!searchResult.wallpapers || searchResult.wallpapers.length === 0) {
    await telegram.sendMessage(
      chatId,
      `❌ Không tìm thấy hình nền phù hợp cho từ khóa: <b>${escapeHtml(rawQuery)}</b>\n\n` +
      `💡 <i>Gợi ý:</i> Thử dùng từ khóa ngắn gọn hơn (ví dụ: <code>sky</code>, <code>night</code>, <code>landscape</code>).`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Save to search history (deduplicating adjacent identical queries)
  await db.addSearchHistory(chatId, rawQuery, JSON.stringify(searchFilters));

  // Create search session for inline pagination
  const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await db.saveSearchSession(sessionId, chatId, rawQuery, JSON.stringify(searchFilters), 1, 86400);

  // Pick first wallpaper
  const firstWallpaper = searchResult.wallpapers[0];
  const isFav = await db.isFavorite(chatId, firstWallpaper.provider, firstWallpaper.providerPostId);

  const caption = buildWallpaperCaption(firstWallpaper, 1, searchResult.wallpapers.length);
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

function buildWallpaperCaption(w: Wallpaper, index: number, total: number): string {
  let sizeText = 'N/A';
  if (w.fileSize) {
    sizeText = `${(w.fileSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  const artistText = w.artistName && w.artistName !== 'Chưa xác định'
    ? escapeHtml(w.artistName)
    : 'Chưa xác định';

  return (
    `🎴 <b>AniWalls | Result ${index}/${total}</b>\n\n` +
    `🎨 <b>Title:</b> ${escapeHtml(w.title)}\n` +
    `📐 <b>Resolution:</b> ${w.resolution.replace('x', '×')}\n` +
    `🖥 <b>Aspect Ratio:</b> ${w.aspectRatio}\n` +
    `💾 <b>Size:</b> ${sizeText}\n` +
    `🌐 <b>Provider:</b> ${w.provider.toUpperCase()}\n` +
    `👤 <b>Artist:</b> ${artistText}`
  );
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

  // Row 3: [💔 Remove Favorite]
  buttons.push([
    { text: '💔 Remove Favorite', callback_data: `fdel:${w.provider}:${w.providerPostId}:${currentIndex}` }
  ]);

  // Row 4: [⬅️ Previous] [Next ➡️]
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
