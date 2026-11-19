import { describe, it, expect } from 'vitest';
import { SearchEngine } from '@/worker/providers';
import { WallhavenProvider } from '@/worker/providers/wallhaven';

describe('Wallhaven Search Provider & Metadata Normalization', () => {
  const provider = new WallhavenProvider();
  const engine = new SearchEngine();

  it('Wallhaven provider should fetch and normalize real anime wallpapers', async () => {
    const result = await provider.search({
      query: 'landscape',
      resolution: 'all',
      limit: 3,
      sfwOnly: true
    });

    expect(result.wallpapers.length).toBeGreaterThan(0);
    const w = result.wallpapers[0];

    // Verify metadata normalization requirements:
    // 1. Dimensions
    expect(w.width).toBeGreaterThan(0);
    expect(w.height).toBeGreaterThan(0);
    expect(w.resolution).toBe(`${w.width}x${w.height}`);
    expect(w.aspectRatio).toBeDefined();

    // 2. Preview URL & Original Image URL
    expect(w.previewUrl).toMatch(/^https:\/\/(th|w)\.wallhaven\.cc\//);
    expect(w.originalFileUrl).toMatch(/^https:\/\/w\.wallhaven\.cc\//);

    // 3. Source post URL
    expect(w.postUrl).toMatch(/^https:\/\/wallhaven\.cc\/w\//);

    // 4. Provider & SFW rating
    expect(w.provider).toBe('wallhaven');
    expect(w.rating).toBe('safe');
  }, 15000);

  it('Strict 4K search should never return images smaller than 3840x2160 in landscape', async () => {
    const result = await engine.search({
      query: 'nature',
      providers: ['wallhaven'],
      resolution: '4k',
      orientation: 'landscape',
      limit: 3
    });

    if (result.wallpapers.length > 0) {
      for (const w of result.wallpapers) {
        expect(w.width).toBeGreaterThanOrEqual(3840);
        expect(w.height).toBeGreaterThanOrEqual(2160);
      }
    }
  }, 15000);
});
