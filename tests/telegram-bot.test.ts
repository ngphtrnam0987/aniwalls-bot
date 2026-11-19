import { describe, it, expect, vi } from 'vitest';
import { WallhavenProvider } from '@/worker/providers/wallhaven';
import { SearchEngine } from '@/worker/providers';

describe('Telegram Bot Core Search & Metadata Formatting', () => {
  const engine = new SearchEngine();

  it('should format search caption with accurate metadata and source links', async () => {
    const res = await engine.search({
      query: 'anime',
      providers: ['wallhaven'],
      limit: 1
    });

    expect(res.wallpapers.length).toBeGreaterThan(0);
    const wallpaper = res.wallpapers[0];

    // Verify metadata requirements:
    // Dimensions, ratio, preview URL, original URL, post URL
    expect(wallpaper.width).toBeGreaterThan(0);
    expect(wallpaper.height).toBeGreaterThan(0);
    expect(wallpaper.resolution).toBe(`${wallpaper.width}x${wallpaper.height}`);
    expect(wallpaper.aspectRatio).toBeDefined();
    expect(wallpaper.originalFileUrl).toContain('https://');
    expect(wallpaper.postUrl).toContain('https://wallhaven.cc/w/');

    // Caption formatting simulation
    const caption = [
      `<b>AniWalls – Kết quả 1/${res.wallpapers.length}</b>`,
      `📌 <b>Tiêu đề:</b> ${wallpaper.title}`,
      `📐 <b>Độ phân giải:</b> ${wallpaper.resolution} (${wallpaper.aspectRatio})`,
      `🌐 <b>Nguồn:</b> ${wallpaper.provider.toUpperCase()}`,
      `🎨 <b>Tác giả:</b> ${wallpaper.artistName || 'Chưa xác định'}`
    ].join('\n\n');

    expect(caption).toContain(wallpaper.resolution);
    expect(caption).toContain('WALLHAVEN');
  });

  it('should support pagination over multi-item results', async () => {
    const res = await engine.search({
      query: 'sky',
      providers: ['wallhaven'],
      limit: 5
    });

    expect(res.wallpapers.length).toBeGreaterThan(1);
    expect(res.hasMore).toBeDefined();

    // Verify first and second wallpaper have unique IDs
    expect(res.wallpapers[0].id).not.toBe(res.wallpapers[1].id);
  });
});
