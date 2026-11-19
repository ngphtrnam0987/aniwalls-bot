import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceMoeService } from '../src/worker/services/tracemoe-service';

describe('trace.moe Scene Recognition Provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should format timestamps correctly into MM:SS and HH:MM:SS', () => {
    const service = new TraceMoeService();
    expect(service.formatTimestamp(0)).toBe('00:00');
    expect(service.formatTimestamp(95.4)).toBe('01:35');
    expect(service.formatTimestamp(3665)).toBe('01:01:05');
  });

  it('2. should correctly normalize trace.moe response with AniList metadata', async () => {
    const mockResponse = {
      frameCount: 500000,
      result: [
        {
          anilist: {
            id: 101922,
            title: {
              native: '鬼滅の刃',
              romaji: 'Kimetsu no Yaiba',
              english: 'Demon Slayer: Kimetsu no Yaiba'
            },
            isAdult: false
          },
          filename: '[HorribleSubs] Kimetsu no Yaiba - 19 [1080p].mkv',
          episode: 19,
          from: 1145.2,
          to: 1150.0,
          similarity: 0.965,
          video: 'https://media.trace.moe/video/101922/preview.mp4',
          image: 'https://media.trace.moe/image/101922/frame.jpg'
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    } as any);

    const service = new TraceMoeService();
    const res = await service.searchByImageUrl('https://example.com/scene.jpg');

    expect(res.success).toBe(true);
    expect(res.results).toHaveLength(1);

    const match = res.results[0];
    expect(match.similarity).toBe(96.5);
    expect(match.confidenceLabel).toBe('high');
    expect(match.animeTitle.romaji).toBe('Kimetsu no Yaiba');
    expect(match.animeTitle.english).toBe('Demon Slayer: Kimetsu no Yaiba');
    expect(match.episode).toBe(19);
    expect(match.timestampFormatted).toBe('19:05');
    expect(match.anilistUrl).toBe('https://anilist.co/anime/101922');
    expect(match.imagePreviewUrl).toBe('https://media.trace.moe/image/101922/frame.jpg');

    // High res query extraction
    const query = service.extractWallpaperQuery(match);
    expect(query).toBe('Demon Slayer: Kimetsu no Yaiba');
  });

  it('3. should handle low confidence recognition and rate limiting', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429
    } as any);

    const service = new TraceMoeService();
    const res = await service.searchByImageUrl('https://example.com/scene.jpg');

    expect(res.success).toBe(false);
    expect(res.message).toContain('giới hạn');
  });

  it('4. should support searching with binary image buffer', async () => {
    const mockResponse = {
      result: [
        {
          anilist: 12345,
          filename: 'Sample.mkv',
          episode: 1,
          from: 50,
          to: 55,
          similarity: 0.72,
          image: 'https://media.trace.moe/image/sample.jpg'
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    } as any);

    const service = new TraceMoeService();
    const res = await service.searchByImageBuffer(new Uint8Array([10, 20, 30]));

    expect(res.success).toBe(true);
    expect(res.results[0].confidenceLabel).toBe('low');
    expect(res.results[0].similarity).toBe(72);
  });
});
