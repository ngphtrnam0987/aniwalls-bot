import { DbClient } from '../db/client';
import { TelegramService } from './telegram-service';
import { SearchEngine } from '../providers';

export class DailyWallpaperService {
  constructor(
    private db: DbClient,
    private telegram: TelegramService,
    private searchEngine: SearchEngine,
    private miniAppUrl?: string
  ) {}

  async processDailyDeliveries(): Promise<{ sent: number; skipped: number; errors: number }> {
    const subscribers = await this.db.getDailySubscribers();
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const now = new Date();

    for (const sub of subscribers) {
      try {
        // Calculate user's current local hour and date
        const timeZone = sub.timezone || 'Asia/Ho_Chi_Minh';
        const userDateStr = now.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
        const userTimeStr = now.toLocaleTimeString('en-US', { timeZone, hour12: false, hour: '2-digit', minute: '2-digit' }); // HH:mm
        const userHour = parseInt(userTimeStr.split(':')[0], 10);

        const targetHour = parseInt(sub.daily_time.split(':')[0], 10);

        // Check if current user hour matches target hour
        if (userHour !== targetHour) {
          skipped++;
          continue;
        }

        // Check if already delivered today (idempotency against re-runs)
        const alreadyReceived = await this.db.hasReceivedDailyToday(sub.user_id, userDateStr);
        if (alreadyReceived) {
          skipped++;
          continue;
        }

        // Fetch user preferences
        const settings = await this.db.getUserSettings(sub.user_id);

        // Search for a random high-quality wallpaper matching settings
        const searchRes = await this.searchEngine.search({
          providers: settings.selected_providers,
          resolution: settings.default_resolution,
          orientation: settings.default_orientation,
          sort: 'random',
          page: Math.floor(Math.random() * 5) + 1,
          limit: 10,
          sfwOnly: true
        });

        if (!searchRes.wallpapers || searchRes.wallpapers.length === 0) {
          skipped++;
          continue;
        }

        // Pick one wallpaper
        const wallpaper = searchRes.wallpapers[Math.floor(Math.random() * searchRes.wallpapers.length)];

        // Send wallpaper via Telegram
        const caption =
          `🌟 <b>Hình nền Anime của ngày!</b>\n\n` +
          `<b>Tiêu đề:</b> ${this.escapeHtml(wallpaper.title)}\n` +
          `<b>Độ phân giải:</b> ${wallpaper.resolution} (${wallpaper.aspectRatio})\n` +
          `<b>Nguồn:</b> ${wallpaper.provider.toUpperCase()}\n` +
          `<b>Tác giả:</b> ${this.escapeHtml(wallpaper.artistName || 'Chưa xác định')}\n\n` +
          `Chúc bạn một ngày tràn đầy năng lượng! ✨`;

        const keyboard: any = {
          inline_keyboard: [
            [
              { text: '📥 Tải ảnh gốc', callback_data: `dl:${wallpaper.id}` },
              { text: '⭐ Yêu thích', callback_data: `fav:${wallpaper.id}` }
            ],
            [
              { text: '🌐 Trang nguồn', url: wallpaper.postUrl }
            ]
          ]
        };

        if (this.miniAppUrl) {
          keyboard.inline_keyboard.push([
            { text: '📱 Mở Mini App AniWalls', web_app: { url: this.miniAppUrl } }
          ]);
        }

        const msgRes = await this.telegram.sendPhoto(sub.user_id, wallpaper.previewUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        if (msgRes && msgRes.ok) {
          await this.db.logDailyDelivery(sub.user_id, wallpaper.id, userDateStr, 'sent');
          sent++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Error sending daily wallpaper to user ${sub.user_id}:`, err);
        errors++;
      }
    }

    return { sent, skipped, errors };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
