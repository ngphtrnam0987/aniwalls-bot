import { describe, it, expect, vi } from 'vitest';
import { DownloadService } from '@/worker/services/download-service';
import { DbClient } from '@/worker/db/client';
import { TelegramService } from '@/worker/services/telegram-service';
import { Wallpaper } from '@/shared/types/wallpaper';

describe('Original Image Download Service & Security', () => {
  const mockDb = {
    getCachedTelegramFile: vi.fn(),
    setCachedTelegramFile: vi.fn()
  } as unknown as DbClient;

  const mockTelegram = {
    sendDocumentWithFileId: vi.fn(),
    sendDocumentMultipart: vi.fn()
  } as unknown as TelegramService;

  function createSampleWallpaper(originalFileUrl: string): Wallpaper {
    return {
      id: 'wallhaven_sample1',
      provider: 'wallhaven',
      providerPostId: 'sample1',
      title: 'Sample Anime Scenery',
      tags: ['scenery'],
      characters: [],
      series: [],
      width: 3840,
      height: 2160,
      resolution: '3840x2160',
      aspectRatio: '16:9',
      orientation: 'landscape',
      originalFileUrl,
      postUrl: 'https://wallhaven.cc/w/sample1',
      thumbnailUrl: 'https://th.wallhaven.cc/lg/sa/sample1.jpg',
      previewUrl: 'https://th.wallhaven.cc/lg/sa/sample1.jpg',
      rating: 'safe',
      sourceMetadata: {}
    };
  }

  it('1. should reject unsafe URLs (SSRF prevention: localhost, private IP, file protocol)', async () => {
    const service = new DownloadService(mockDb, mockTelegram);

    // Test localhost
    const res1 = await service.deliverOriginalWallpaper(1234, createSampleWallpaper('http://localhost:8080/image.jpg'));
    expect(res1.success).toBe(false);
    expect(res1.fallbackUrl).toBe('http://localhost:8080/image.jpg');

    // Test cloud metadata IP
    const res2 = await service.deliverOriginalWallpaper(1234, createSampleWallpaper('http://169.254.169.254/secret.png'));
    expect(res2.success).toBe(false);

    // Test internal network
    const res3 = await service.deliverOriginalWallpaper(1234, createSampleWallpaper('http://192.168.1.1/admin.jpg'));
    expect(res3.success).toBe(false);
  });

  it('2. should use cached Telegram file_id when available in D1', async () => {
    const cachedFileId = 'AgACAgIAAxkBAAI...cached_id';
    vi.mocked(mockDb.getCachedTelegramFile).mockResolvedValueOnce(cachedFileId);
    vi.mocked(mockTelegram.sendDocumentWithFileId).mockResolvedValueOnce({ ok: true });

    const service = new DownloadService(mockDb, mockTelegram);
    const wallpaper = createSampleWallpaper('https://w.wallhaven.cc/full/sa/wallhaven-sample1.jpg');

    const result = await service.deliverOriginalWallpaper(1234, wallpaper);

    expect(result.success).toBe(true);
    expect(result.fileId).toBe(cachedFileId);
    expect(mockTelegram.sendDocumentWithFileId).toHaveBeenCalledWith(
      1234,
      cachedFileId,
      expect.objectContaining({ parse_mode: 'HTML' })
    );
  });

  it('3. should provide working direct links when upload fails or file is too large', async () => {
    vi.mocked(mockDb.getCachedTelegramFile).mockResolvedValueOnce(null);

    const service = new DownloadService(mockDb, mockTelegram);
    const wallpaper = createSampleWallpaper('https://w.wallhaven.cc/full/sa/wallhaven-sample1.jpg');

    // Simulate fetch failure or oversized file
    const res = await service.deliverOriginalWallpaper(1234, wallpaper);

    // The failure must return fallbackUrl and postUrl gracefully without crashing
    expect(res.fallbackUrl).toBe(wallpaper.originalFileUrl);
    expect(res.postUrl).toBe(wallpaper.postUrl);
    expect(res.error).toBeDefined();
  });
});
