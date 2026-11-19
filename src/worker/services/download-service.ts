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
    const { provider, providerPostId, originalFileUrl, postUrl, resolution, width, height, title } = wallpaper;

    // Step 1: Validate URL security (SSRF prevention)
    if (!originalFileUrl || !isAllowedUrl(originalFileUrl)) {
      return {
        success: false,
        fallbackUrl: originalFileUrl,
        postUrl,
        error: 'URL hình ảnh không an toàn hoặc nằm ngoài danh sách cho phép.'
      };
    }

    // Step 2: Check D1 cache for existing Telegram file_id
    try {
      const cachedFileId = await this.db.getCachedTelegramFile(provider, providerPostId);
      if (cachedFileId) {
        const caption =
          `🎴 <b>${this.escapeHtml(title)}</b>\n\n` +
          `📐 Độ phân giải gốc: <b>${resolution}</b> (${width}×${height})\n` +
          `🌐 Nguồn: <b>${provider.toUpperCase()}</b>\n` +
          `⚡ Gửi nhanh qua Telegram File Cache`;

        const sent = await this.telegram.sendDocumentWithFileId(chatId, cachedFileId, {
          caption,
          parse_mode: 'HTML'
        });

        if (sent && sent.ok) {
          return { success: true, fileId: cachedFileId };
        }
      }
    } catch (err) {
      console.warn('Error checking telegram file cache in D1:', err);
    }

    // Step 3: Fetch original image with size and content-type checks
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

      // Perform a HEAD request first to verify Content-Length and Content-Type without buffering
      let contentLength = 0;
      let contentType = '';

      try {
        const headRes = await fetch(originalFileUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
          },
          signal: controller.signal
        });

        if (headRes.ok) {
          const lenHeader = headRes.headers.get('content-length');
          if (lenHeader) contentLength = parseInt(lenHeader, 10);
          contentType = headRes.headers.get('content-type') || '';
        }
      } catch {
        // Some servers reject HEAD requests; fallback to GET
      }

      // Check if file is too large for Telegram bot sendDocument (Telegram limit ~20MB, we set 18MB for Workers safety)
      if (contentLength > 18 * 1024 * 1024) {
        clearTimeout(timeoutId);
        return {
          success: false,
          fallbackUrl: originalFileUrl,
          postUrl,
          error: `Dung lượng ảnh gốc lớn (${(contentLength / (1024 * 1024)).toFixed(1)}MB), vui lòng tải trực tiếp qua liên kết bên dưới.`
        };
      }

      // Download original image file
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
          error: `Máy chủ lưu trữ ảnh phản hồi mã lỗi (HTTP ${response.status}).`
        };
      }

      contentType = response.headers.get('content-type') || contentType;
      const blob = await response.blob();

      // Guard against unbounded stream sizes
      if (blob.size > 19 * 1024 * 1024) {
        return {
          success: false,
          fallbackUrl: originalFileUrl,
          postUrl,
          error: `Dung lượng file tải về vượt quá giới hạn gửi tài liệu của Telegram.`
        };
      }

      // Determine extension and clean filename
      const ext = originalFileUrl.endsWith('.png') || contentType.includes('png') ? 'png' : 'jpg';
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const filename = `AniWalls_${provider}_${providerPostId}_${resolution}.${ext}`;

      const caption =
        `🎴 <b>${this.escapeHtml(title)}</b>\n\n` +
        `📐 Độ phân giải gốc: <b>${resolution}</b> (${width}×${height})\n` +
        `💾 Dung lượng: <b>${(blob.size / (1024 * 1024)).toFixed(2)} MB</b>\n` +
        `🌐 Nguồn: <b>${provider.toUpperCase()}</b>`;

      // Upload via sendDocument multipart
      const sent = await this.telegram.sendDocumentMultipart(chatId, blob, filename, {
        caption,
        parse_mode: 'HTML'
      });

      if (sent && sent.ok && sent.result?.document?.file_id) {
        const newFileId = sent.result.document.file_id;
        // Cache to D1 for future instant re-sends
        await this.db.setCachedTelegramFile(provider, providerPostId, newFileId);
        return { success: true, fileId: newFileId };
      }

      // If Telegram sendDocument rejected or failed
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
        error: err?.name === 'AbortError'
          ? 'Quá thời gian tải ảnh từ máy chủ nguồn (Timeout).'
          : (err?.message || 'Lỗi không xác định khi tải ảnh gốc.')
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
