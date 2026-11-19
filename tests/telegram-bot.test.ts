import { describe, it, expect } from 'vitest';
import { SearchEngine } from '@/worker/providers';
import { Wallpaper } from '@/shared/types/wallpaper';

describe('Telegram Bot Core Search & Metadata Formatting', () => {
  const engine = new SearchEngine();

  function formatPhase2Caption(w: Wallpaper, index: number, total: number): string {
    let sizeText = 'N/A';
    if (w.fileSize) {
      sizeText = `${(w.fileSize / (1024 * 1024)).toFixed(2)} MB`;
    }
    const artistText = w.artistName && w.artistName !== 'Chưa xác định' ? w.artistName : 'Chưa xác định';

    return [
      `🎴 <b>AniWalls | Result ${index}/${total}</b>`,
      `🎨 <b>Title:</b> ${w.title}`,
      `📐 <b>Resolution:</b> ${w.resolution.replace('x', '×')}`,
      `🖥 <b>Aspect Ratio:</b> ${w.aspectRatio}`,
      `💾 <b>Size:</b> ${sizeText}`,
      `🌐 <b>Provider:</b> ${w.provider.toUpperCase()}`,
      `👤 <b>Artist:</b> ${artistText}`
    ].join('\n\n');
  }

  it('1. should format search caption with Phase 2 layout and accurate metadata', async () => {
    const res = await engine.search({
      query: 'scenery',
      providers: ['wallhaven'],
      limit: 1
    });

    expect(res.wallpapers.length).toBeGreaterThan(0);
    const wallpaper = res.wallpapers[0];

    // Verify metadata requirements:
    expect(wallpaper.width).toBeGreaterThan(0);
    expect(wallpaper.height).toBeGreaterThan(0);
    expect(wallpaper.resolution).toBe(`${wallpaper.width}x${wallpaper.height}`);
    expect(wallpaper.aspectRatio).toBeDefined();
    expect(wallpaper.originalFileUrl).toContain('https://');
    expect(wallpaper.postUrl).toContain('https://wallhaven.cc/w/');

    const caption = formatPhase2Caption(wallpaper, 1, 20);
    expect(caption).toContain('🎴 <b>AniWalls | Result 1/20</b>');
    expect(caption).toContain('📐 <b>Resolution:</b>');
    expect(caption).toContain('🖥 <b>Aspect Ratio:</b>');
    expect(caption).toContain('🌐 <b>Provider:</b> WALLHAVEN');
    expect(caption).toContain('👤 <b>Artist:</b>');
  });

  it('2. should support pagination over multi-item results', async () => {
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
