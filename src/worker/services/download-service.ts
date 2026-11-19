import { Wallpaper } from '@/shared/types/wallpaper';
import { DbClient } from '../db/client';
import { TelegramService } from './telegram-service';
import { isAllowedUrl } from '../security/ssrf';

export interface DownloadResult {
  success: boolean;
  fileId?: string;
  fallbackUrl?: string;
  postUrl?: string;
  error?: string;
}

export class DownloadService {
  constructor(
    private db: DbClient,
    private telegram: TelegramService
  ) {}

  async deliverOriginalWallpaper(
    chatId: number | string,
    wallpaper: Wallpaper
  ): Promise<DownloadResult> {
    const { id, originalFileUrl, postUrl, resolution, width, height, title } = wallpaper;

    // Step 1: Validate URL security (SSRF prevention)
    if (!originalFileUrl || !isAllowedUrl(originalFileUrl)) {
      return {
        success: false,
        fallbackUrl: originalFileUrl,
        postUrl,
        error: 'URL không hợp lệ hoặc nằm ngoài danh sách cho phép.'
      };
    }

    // Step 2: Check D1 cache for existing Telegram file_id
    try {
      const cachedFileId = await this.db.getCachedTelegramFile(id);
      if (cachedFileId) {
        const caption = `<b>${this.escapeHtml(title)}</b>\nĐộ phân giải: ${resolution} (${width}x${height})\nNguồn: ${wallpaper.provider.toUpperCase()}`;
        const sent = await this.telegram.sendDocumentWithFileId(chatId, cachedFileId, {
          caption,
          parse_mode: 'HTML'
        });

        if (sent && sent.ok) {
          return { success: true, fileId: cachedFileId };
        }
      }
    } catch (err) {
      console.warn('Error checking telegram file cache:', err);
    }

    // Step 3: Fetch file within size limits (Telegram bot limit is ~20MB, we check <= 15MB for Workers memory safety)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const headRes = await fetch(originalFileUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        },
        signal: controller.signal
      });

      const contentLengthStr = headRes.headers.get('content-length');
      const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

      // If file is too large for bot upload (> 18MB), immediately return fallback
      if (contentLength > 18 * 1024 * 1024) {
        clearTimeout(timeoutId);
        return {
          success: false,
          fallbackUrl: originalFileUrl,
          postUrl,
          error: `File gốc rất lớn (${(contentLength / (1024 * 1024)).toFixed(1)}MB), vui lòng tải trực tiếp qua link.`
        };
      }

      // Fetch file
      const response = await fetch(originalFileUrl, {
        headers: {
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          fallbackUrl: originalFileUrl,
          postUrl,
          error: `Máy chủ ảnh nguồn phản hồi lỗi (HTTP ${response.status}).`
        };
      }

      const blob = await response.blob();
      if (blob.size > 19 * 1024 * 1024) {
        return {
          success: false,
          fallbackUrl: originalFileUrl,
          postUrl,
          error: `Dung lượng ảnh vượt quá giới hạn gửi trực tiếp của Telegram.`
        };
      }

      // Determine extension and filename
      const ext = originalFileUrl.endsWith('.png') ? 'png' : 'jpg';
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const filename = `AniWalls_${wallpaper.provider}_${cleanTitle}_${resolution}.${ext}`;

      const caption = `<b>${this.escapeHtml(title)}</b>\nĐộ phân giải gốc: ${resolution} (${width}x${height})\nNguồn: ${wallpaper.provider.toUpperCase()}`;

      // Upload via sendDocument multipart
      const sent = await this.telegram.sendDocumentMultipart(chatId, blob, filename, {
        caption,
        parse_mode: 'HTML'
      });

      if (sent && sent.ok && sent.result?.document?.file_id) {
        const newFileId = sent.result.document.file_id;
        // Cache to D1 for future instant re-sends
        await this.db.setCachedTelegramFile(id, newFileId);
        return { success: true, fileId: newFileId };
      }

      // Fallback if telegram sendDocument failed
      return {
        success: false,
        fallbackUrl: originalFileUrl,
        postUrl,
        error: sent?.description || 'Không thể upload ảnh gốc qua Telegram API.'
      };
    } catch (err: any) {
      console.error('Download original error:', err);
      return {
        success: false,
        fallbackUrl: originalFileUrl,
        postUrl,
        error: err?.name === 'AbortError' ? 'Thời gian tải ảnh quá hạn (Timeout).' : (err?.message || 'Lỗi không xác định khi tải ảnh.')
      };
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
