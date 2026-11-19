import { Hono } from 'hono';
import { Env, DbClient } from '../db/client';
import { TelegramService } from '../services/telegram-service';
import { SearchEngine } from '../providers';
import { DownloadService } from '../services/download-service';
import { SauceNaoService } from '../services/saucenao-service';
import { TelegramUpdate, TelegramInlineKeyboardMarkup, TelegramInlineKeyboardButton } from '@/shared/types/telegram';
import { Wallpaper, ResolutionFilter, OrientationFilter, ProviderName } from '@/shared/types/wallpaper';

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
  const sauceNaoService = new SauceNaoService(c.env.SAUCENAO_API_KEY);

  const miniAppUrl = c.env.APP_BASE_URL || 'https://aniwalls.example.workers.dev';

  // Handle Callback Queries (Inline buttons)
  if (update.callback_query) {
    const cb = update.callback_query;
    const userId = cb.from.id;
    const data = cb.data || '';

    try {
      // 1. Download original
      if (data.startsWith('dl:')) {
        const wallpaperId = data.slice(3);
        await telegram.answerCallbackQuery(cb.id, { text: '⏳ Đang chuẩn bị tải ảnh gốc...' });

        let wallpaper = await db.getCachedWallpaper(wallpaperId);
        if (!wallpaper) {
          wallpaper = await searchEngine.getById(wallpaperId);
        }

        if (!wallpaper) {
          await telegram.sendMessage(userId, '❌ Không tìm thấy thông tin ảnh.');
          return c.text('OK');
        }

        const res = await downloadService.deliverOriginalWallpaper(userId, wallpaper);
        if (!res.success && res.fallbackUrl) {
          await telegram.sendMessage(
            userId,
            `⚠️ <b>Không thể gửi ảnh trực tiếp:</b> ${res.error || ''}\n\n` +
            `👉 <a href="${res.fallbackUrl}">Bấm vào đây để tải trực tiếp ảnh gốc</a>\n` +
            `👉 <a href="${res.postUrl}">Hoặc mở trang nguồn ảnh</a>`,
            { parse_mode: 'HTML' }
          );
        }
        return c.text('OK');
      }

      // 2. Favorite toggle
      if (data.startsWith('fav:')) {
        const wallpaperId = data.slice(4);
        const isFav = await db.isFavorite(userId, wallpaperId);

        if (isFav) {
          await db.removeFavorite(userId, wallpaperId);
          await telegram.answerCallbackQuery(cb.id, { text: '💔 Đã bỏ khỏi danh sách yêu thích' });
        } else {
          let wallpaper = await db.getCachedWallpaper(wallpaperId);
          if (!wallpaper) {
            wallpaper = await searchEngine.getById(wallpaperId);
          }
          if (wallpaper) {
            await db.addFavorite(userId, wallpaper);
            await telegram.answerCallbackQuery(cb.id, { text: '⭐ Đã lưu vào yêu thích!' });
          } else {
            await telegram.answerCallbackQuery(cb.id, { text: '❌ Không thể lưu ảnh' });
          }
        }
        return c.text('OK');
      }

      // 3. Navigation across search results
      if (data.startsWith('nav:')) {
        const parts = data.split(':');
        const sessionId = parts[1];
        const targetIndex = parseInt(parts[2], 10);

        const session = await db.getSearchSession(sessionId);
        if (!session) {
          await telegram.answerCallbackQuery(cb.id, { text: 'Phiên tìm kiếm đã hết hạn. Hãy tìm kiếm lại!', show_alert: true });
          return c.text('OK');
        }

        const filters = JSON.parse(session.filters_json);
        const searchRes = await searchEngine.search({ ...filters, page: session.current_page });

        if (!searchRes.wallpapers || targetIndex < 0 || targetIndex >= searchRes.wallpapers.length) {
          await telegram.answerCallbackQuery(cb.id, { text: 'Không còn kết quả nào khác.' });
          return c.text('OK');
        }

        const wallpaper = searchRes.wallpapers[targetIndex];
        await db.cacheWallpaper(wallpaper);

        const caption = buildWallpaperCaption(wallpaper, targetIndex + 1, searchRes.wallpapers.length);
        const markup = buildWallpaperKeyboard(wallpaper, sessionId, targetIndex, searchRes.wallpapers.length, miniAppUrl);

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

      // 4. Toggle daily notifications
      if (data === 'toggle_daily') {
        const settings = await db.getUserSettings(userId);
        const nextState = !settings.daily_enabled;
        await db.updateUserSettings(userId, { daily_enabled: nextState });
        await telegram.answerCallbackQuery(cb.id, {
          text: nextState ? '🔔 Đã bật nhận hình nền anime hàng ngày!' : '🔕 Đã tắt nhận hình nền hàng ngày.'
        });
        return c.text('OK');
      }

      await telegram.answerCallbackQuery(cb.id);
    } catch (err) {
      console.error('Callback query error:', err);
      await telegram.answerCallbackQuery(cb.id, { text: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }

    return c.text('OK');
  }

  // Handle Messages
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) return c.text('OK');

    // Upsert user in D1
    await db.upsertUser({
      telegram_user_id: user.id,
      username: user.username,
      display_name: [user.first_name, user.last_name].filter(Boolean).join(' '),
      language: user.language_code || 'vi'
    });

    // Case 1: Photo uploaded -> Reverse Image Search
    if (msg.photo && msg.photo.length > 0) {
      await telegram.sendMessage(chatId, '🔍 <i>Đang kiểm tra nguồn ảnh qua hệ thống nhận diện...</i>', { parse_mode: 'HTML' });

      // Get highest resolution photo size
      const bestPhoto = msg.photo[msg.photo.length - 1];
      const fileInfo = await telegram.getFile(bestPhoto.file_id);

      if (fileInfo && fileInfo.file_path) {
        const photoUrl = telegram.getFileDownloadUrl(fileInfo.file_path);
        const reverseResult = await sauceNaoService.searchByImageUrl(photoUrl);

        if (!reverseResult.configured) {
          await telegram.sendMessage(
            chatId,
            `ℹ️ <b>Tính năng tìm nguồn ảnh:</b>\n${reverseResult.message}\n\n` +
            `👉 Hãy dùng lệnh <code>/search &lt;tên nhân vật hoặc anime&gt;</code> để tìm kiếm trực tiếp!`,
            { parse_mode: 'HTML' }
          );
          return c.text('OK');
        }

        if (!reverseResult.success || reverseResult.results.length === 0) {
          await telegram.sendMessage(chatId, `⚠️ ${reverseResult.message || 'Không tìm thấy thông tin tác phẩm.'}`);
          return c.text('OK');
        }

        let replyText = `🎯 <b>Kết quả nhận diện ảnh:</b>\n\n`;
        reverseResult.results.forEach((r, idx) => {
          replyText += `<b>#${idx + 1} Tác phẩm:</b> ${escapeHtml(r.title || 'Không rõ')}\n`;
          replyText += `📊 Độ tương đồng: <b>${r.similarity.toFixed(1)}%</b>\n`;
          if (r.authorName) replyText += `🎨 Tác giả: ${escapeHtml(r.authorName)}\n`;
          if (r.sourceUrl) replyText += `🔗 <a href="${r.sourceUrl}">Xem bài đăng gốc</a>\n`;
          replyText += `\n`;
        });

        await telegram.sendMessage(chatId, replyText, { parse_mode: 'HTML' });
      }
      return c.text('OK');
    }

    // Case 2: Text commands or natural search query
    const text = (msg.text || '').trim();
    if (!text) return c.text('OK');

    // /start command
    if (text === '/start') {
      const welcomeText =
        `🌸 <b>Chào mừng bạn đến với AniWalls!</b>\n\n` +
        `Kho hình nền Anime chất lượng cao (1080p, 2K, 4K, 8K) từ Wallhaven, Konachan và Safebooru.\n\n` +
        `⚡ <b>Các lệnh nhanh:</b>\n` +
        `• <code>/search [từ khóa]</code> – Tìm hình nền anime\n` +
        `• <code>/4k [từ khóa]</code> – Lọc ảnh chuẩn 4K UHD\n` +
        `• <code>/mobile [từ khóa]</code> – Lọc ảnh nền điện thoại dọc\n` +
        `• <code>/desktop [từ khóa]</code> – Lọc ảnh nền máy tính ngang\n` +
        `• <code>/random</code> – Lấy ảnh ngẫu nhiên cực đẹp\n` +
        `• <code>/favorites</code> – Xem danh sách đã lưu\n` +
        `• <code>/daily</code> – Bật/tắt ảnh nền mỗi ngày\n` +
        `• <code>/settings</code> – Cài đặt chất lượng & tỷ lệ\n` +
        `• <code>/help</code> – Hướng dẫn chi tiết\n\n` +
        `💡 <i>Hoặc chỉ cần gõ trực tiếp tên nhân vật (vd: <code>miku</code>, <code>furina</code>, <code>frieren</code>) để tìm kiếm ngay!</i>`;

      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: '✨ Mở Mini App AniWalls', web_app: { url: miniAppUrl } }
          ],
          [
            { text: '🎲 Ảnh ngẫu nhiên', callback_data: 'quick:random' },
            { text: '⭐ Yêu thích', callback_data: 'quick:favs' }
          ],
          [
            { text: '⚙️ Cài đặt', callback_data: 'quick:settings' }
          ]
        ]
      };

      await telegram.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      return c.text('OK');
    }

    // /help command
    if (text === '/help') {
      const helpText =
        `📖 <b>HƯỚNG DẪN SỬ DỤNG ANIWALLS</b>\n\n` +
        `<b>1. Tìm kiếm hình nền:</b>\n` +
        `• Gõ bất kỳ tên nhân vật, anime hoặc game: <code>furina genshin</code>, <code>frieren</code>, <code>carlotta wuthering waves</code>\n` +
        `• Thêm chuẩn độ phân giải: <code>miku 4k</code>, <code>evangelion 2k</code>\n` +
        `• Thêm thiết bị: <code>frieren mobile</code>, <code>genshin desktop</code>\n\n` +
        `<b>2. Danh sách lệnh:</b>\n` +
        `• <code>/search &lt;từ khóa&gt;</code> – Tìm kiếm\n` +
        `• <code>/4k &lt;từ khóa&gt;</code> – Tìm ảnh độ phân giải 4K\n` +
        `• <code>/mobile &lt;từ khóa&gt;</code> – Tìm ảnh nền điện thoại (9:16)\n` +
        `• <code>/desktop &lt;từ khóa&gt;</code> – Tìm ảnh nền máy tính (16:9)\n` +
        `• <code>/random</code> – Khám phá ảnh đẹp ngẫu nhiên\n` +
        `• <code>/favorites</code> – Xem lại các ảnh bạn đã bấm sao ⭐\n` +
        `• <code>/history</code> – Lịch sử các tìm kiếm gần đây\n` +
        `• <code>/daily</code> – Nhận hình nền tuyển chọn mỗi sáng\n` +
        `• <code>/sources</code> – Xem trạng thái các nguồn ảnh\n` +
        `• <code>/settings</code> – Tùy chỉnh nguồn và độ phân giải mặc định\n\n` +
        `<b>3. Tìm nguồn ảnh ngược (Reverse Image Search):</b>\n` +
        `• Chỉ cần gửi 1 bức ảnh vào cuộc trò chuyện này, bot sẽ tìm tên tác phẩm và link gốc!\n\n` +
        `<b>4. Mini App:</b>\n` +
        `• Bấm vào nút Mini App bên dưới để trải nghiệm giao diện lướt ảnh Pinterest tuyệt đẹp.`;

      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [{ text: '📱 Mở AniWalls Mini App', web_app: { url: miniAppUrl } }]
        ]
      };

      await telegram.sendMessage(chatId, helpText, { parse_mode: 'HTML', reply_markup: keyboard });
      return c.text('OK');
    }

    // /sources command
    if (text === '/sources') {
      const sourcesText =
        `🌐 <b>DANH SÁCH NGUỒN TÌM KIẾM</b>\n\n` +
        `1. <b>Wallhaven.cc</b>: Nguồn hình nền desktop & 4K/8K chất lượng cao hàng đầu thế giới, lọc SFW an toàn tuyệt đối.\n\n` +
        `2. <b>Konachan.net</b>: Nguồn anime chuyên dụng, phong phú nhân vật và hỗ trợ tải ảnh gốc đầy đủ kích thước.\n\n` +
        `3. <b>Safebooru</b>: Nguồn anime an toàn chuẩn general, phân loại nhân vật, tác giả và bộ phim cực kỳ chi tiết.\n\n` +
        `<i>AniWalls kết nối trực tiếp đến các API công khai của các nguồn trên mà không can thiệp nén hay thay đổi chất lượng ảnh gốc.</i>`;

      await telegram.sendMessage(chatId, sourcesText, { parse_mode: 'HTML' });
      return c.text('OK');
    }

    // /favorites command
    if (text === '/favorites') {
      const favResult = await db.getFavorites(user.id, 1, 5);
      if (!favResult.wallpapers || favResult.wallpapers.length === 0) {
        await telegram.sendMessage(
          chatId,
          `⭐ Bạn chưa lưu hình nền nào vào danh sách yêu thích.\n\nHãy bấm nút <b>[⭐ Yêu thích]</b> khi xem ảnh để lưu lại tại đây nhé!`,
          { parse_mode: 'HTML' }
        );
        return c.text('OK');
      }

      await telegram.sendMessage(
        chatId,
        `⭐ <b>Danh sách yêu thích của bạn (${favResult.total} ảnh):</b>\n` +
        `Mở Mini App để xem toàn bộ danh sách ở dạng lưới ảnh Pinterest!`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✨ Mở thư viện Yêu Thích trong Mini App', web_app: { url: `${miniAppUrl}#favorites` } }]
            ]
          }
        }
      );
      return c.text('OK');
    }

    // /history command
    if (text === '/history') {
      const history = await db.getSearchHistory(user.id, 8);
      if (history.length === 0) {
        await telegram.sendMessage(chatId, '📝 Bạn chưa có lịch sử tìm kiếm nào.');
        return c.text('OK');
      }

      let historyText = `🕒 <b>Lịch sử tìm kiếm gần đây:</b>\n\n`;
      history.forEach((h, i) => {
        historyText += `${i + 1}. <code>${escapeHtml(h.query)}</code>\n`;
      });

      await telegram.sendMessage(chatId, historyText, { parse_mode: 'HTML' });
      return c.text('OK');
    }

    // /daily command
    if (text === '/daily') {
      const settings = await db.getUserSettings(user.id);
      const isEnabled = settings.daily_enabled;

      const dailyText =
        `🌅 <b>HÌNH NỀN HÀNG NGÀY (DAILY WALLPAPER)</b>\n\n` +
        `Trạng thái hiện tại: <b>${isEnabled ? '✅ Đang BẬT' : '❌ Đang TẮT'}</b>\n` +
        `Giờ gửi: <b>${settings.daily_time} (${settings.timezone})</b>\n\n` +
        `Mỗi ngày bot sẽ tự động gửi cho bạn 1 hình nền anime chất lượng cao theo đúng sở thích của bạn!`;

      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [
            {
              text: isEnabled ? '🔕 Tắt nhận hàng ngày' : '🔔 Bật nhận hàng ngày',
              callback_data: 'toggle_daily'
            }
          ]
        ]
      };

      await telegram.sendMessage(chatId, dailyText, { parse_mode: 'HTML', reply_markup: keyboard });
      return c.text('OK');
    }

    // /settings command
    if (text === '/settings') {
      const settings = await db.getUserSettings(user.id);
      const settingsText =
        `⚙️ <b>CÀI ĐẶT CỦA BẠN</b>\n\n` +
        `• Độ phân giải mặc định: <b>${settings.default_resolution.toUpperCase()}</b>\n` +
        `• Chiều ảnh mặc định: <b>${settings.default_orientation}</b>\n` +
        `• Nguồn tìm kiếm: <b>${settings.selected_providers.join(', ')}</b>\n` +
        `• Hình nền mỗi ngày: <b>${settings.daily_enabled ? 'Bật (' + settings.daily_time + ')' : 'Tắt'}</b>\n\n` +
        `💡 Bạn có thể tùy chỉnh chi tiết bằng giao diện trực quan trong Mini App!`;

      await telegram.sendMessage(chatId, settingsText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚙️ Mở Cài đặt trong Mini App', web_app: { url: `${miniAppUrl}#settings` } }]
          ]
        }
      });
      return c.text('OK');
    }

    // Search command or text query
    let queryStr = text;
    let forceResolution: ResolutionFilter | undefined;
    let forceOrientation: OrientationFilter | undefined;
    let isRandom = false;

    if (text.startsWith('/search')) {
      queryStr = text.replace(/^\/search\s*/i, '').trim();
    } else if (text.startsWith('/4k')) {
      queryStr = text.replace(/^\/4k\s*/i, '').trim();
      forceResolution = '4k';
    } else if (text.startsWith('/mobile')) {
      queryStr = text.replace(/^\/mobile\s*/i, '').trim();
      forceOrientation = 'portrait';
    } else if (text.startsWith('/desktop')) {
      queryStr = text.replace(/^\/desktop\s*/i, '').trim();
      forceOrientation = 'landscape';
    } else if (text.startsWith('/random')) {
      isRandom = true;
      queryStr = '';
    }

    // If query was empty on /search
    if (!queryStr && !isRandom) {
      await telegram.sendMessage(chatId, '🔎 Vui lòng nhập từ khóa tìm kiếm. Ví dụ: <code>/search furina</code> hoặc <code>/4k frieren</code>', { parse_mode: 'HTML' });
      return c.text('OK');
    }

    // Execute Search
    await telegram.sendMessage(chatId, '🔎 <i>Đang tìm kiếm hình nền chất lượng cao...</i>', { parse_mode: 'HTML' });

    const userSettings = await db.getUserSettings(user.id);
    const resolution = forceResolution || userSettings.default_resolution;
    const orientation = forceOrientation || userSettings.default_orientation;

    const searchFilters = {
      query: queryStr,
      providers: userSettings.selected_providers,
      resolution,
      orientation,
      sort: isRandom ? ('random' as const) : ('relevance' as const),
      page: 1,
      limit: 15,
      sfwOnly: true
    };

    const searchResult = await searchEngine.search(searchFilters);

    if (!searchResult.wallpapers || searchResult.wallpapers.length === 0) {
      await telegram.sendMessage(
        chatId,
        `❌ Không tìm thấy hình nền phù hợp cho từ khóa: <b>${escapeHtml(queryStr || 'ngẫu nhiên')}</b>\n` +
        `💡 Mẹo: Hãy thử đổi từ khóa đơn giản hơn (ví dụ: <code>miku</code>, <code>frieren</code>, <code>genshin</code>).`,
        { parse_mode: 'HTML' }
      );
      return c.text('OK');
    }

    // Save search history
    if (queryStr) {
      await db.addSearchHistory(user.id, queryStr, JSON.stringify(searchFilters));
    }

    // Create a search session for pagination
    const sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await db.saveSearchSession(sessionId, user.id, queryStr, JSON.stringify(searchFilters), 1, 86400);

    // Pick first result
    const firstWallpaper = searchResult.wallpapers[0];
    await db.cacheWallpaper(firstWallpaper);

    const caption = buildWallpaperCaption(firstWallpaper, 1, searchResult.wallpapers.length);
    const keyboard = buildWallpaperKeyboard(firstWallpaper, sessionId, 0, searchResult.wallpapers.length, miniAppUrl);

    await telegram.sendPhoto(chatId, firstWallpaper.previewUrl, {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    return c.text('OK');
  }

  return c.text('OK');
});

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

  return (
    `<b>AniWalls – Kết quả ${index}/${total}</b>\n\n` +
    `📌 <b>Tiêu đề:</b> ${escapeHtml(w.title)}\n` +
    `📐 <b>Độ phân giải:</b> ${w.resolution} (${w.aspectRatio})\n` +
    `📦 <b>Dung lượng:</b> ${sizeText}\n` +
    `🌐 <b>Nguồn:</b> ${w.provider.toUpperCase()}\n` +
    `🎨 <b>Tác giả:</b> ${escapeHtml(w.artistName || 'Chưa xác định')}\n` +
    `🏷️ <b>Thẻ:</b> ${escapeHtml(w.tags.slice(0, 5).join(', ') || 'anime')}`
  );
}

function buildWallpaperKeyboard(
  w: Wallpaper,
  sessionId: string,
  currentIndex: number,
  totalCount: number,
  miniAppUrl: string
): TelegramInlineKeyboardMarkup {
  const buttons: TelegramInlineKeyboardButton[][] = [];

  // Row 1: Download Original & Direct URL
  const row1: TelegramInlineKeyboardButton[] = [
    { text: '📥 Tải ảnh gốc', callback_data: `dl:${w.id}` }
  ];
  if (w.originalFileUrl) {
    row1.push({ text: '🔗 Link trực tiếp', url: w.originalFileUrl });
  }
  buttons.push(row1);

  // Row 2: Source Post & Artist / External
  const row2: TelegramInlineKeyboardButton[] = [
    { text: '🌐 Trang nguồn', url: w.postUrl }
  ];
  if (w.artistUrl || w.externalSourceUrl) {
    row2.push({ text: '🎨 Nguồn tác giả', url: w.artistUrl || w.externalSourceUrl! });
  }
  buttons.push(row2);

  // Row 3: Favorite
  buttons.push([
    { text: '⭐ Yêu thích', callback_data: `fav:${w.id}` }
  ]);

  // Row 4: Previous & Next navigation
  const rowNav: TelegramInlineKeyboardButton[] = [];
  if (currentIndex > 0) {
    rowNav.push({ text: '⬅️ Trước', callback_data: `nav:${sessionId}:${currentIndex - 1}` });
  }
  if (currentIndex < totalCount - 1) {
    rowNav.push({ text: 'Tiếp ➡️', callback_data: `nav:${sessionId}:${currentIndex + 1}` });
  }
  if (rowNav.length > 0) {
    buttons.push(rowNav);
  }

  // Row 5: Open Mini App
  buttons.push([
    { text: '📱 Mở Mini App AniWalls', web_app: { url: miniAppUrl } }
  ]);

  return { inline_keyboard: buttons };
}
