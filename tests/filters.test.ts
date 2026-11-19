import { describe, it, expect } from 'vitest';
import {
  calculateAspectRatio,
  getOrientation,
  matchesResolution,
  matchesOrientation,
  matchesAspectRatio
} from '@/worker/providers/base';
import { Wallpaper } from '@/shared/types/wallpaper';

function createMockWallpaper(width: number, height: number): Wallpaper {
  return {
    id: 'test_1',
    provider: 'wallhaven',
    providerPostId: '1',
    title: 'Test Wallpaper',
    tags: ['anime'],
    characters: [],
    series: [],
    width,
    height,
    resolution: `${width}x${height}`,
    aspectRatio: calculateAspectRatio(width, height),
    orientation: getOrientation(width, height),
    thumbnailUrl: 'https://w.wallhaven.cc/thumb.jpg',
    previewUrl: 'https://w.wallhaven.cc/preview.jpg',
    originalFileUrl: 'https://w.wallhaven.cc/full.jpg',
    postUrl: 'https://wallhaven.cc/w/1',
    rating: 'safe',
    sourceMetadata: {}
  };
}

describe('Resolution Filtering', () => {
  it('should strictly accept true 4K landscape (3840x2160 or larger)', () => {
    const true4k = createMockWallpaper(3840, 2160);
    expect(matchesResolution(true4k, '4k')).toBe(true);

    const higherThan4k = createMockWallpaper(4000, 2250);
    expect(matchesResolution(higherThan4k, '4k')).toBe(true);
  });

  it('should strictly reject fake 4K (e.g. 1920x1080 or small images)', () => {
    const fhd = createMockWallpaper(1920, 1080);
    expect(matchesResolution(fhd, '4k')).toBe(false);

    const qhd = createMockWallpaper(2560, 1440);
    expect(matchesResolution(qhd, '4k')).toBe(false);

    const small = createMockWallpaper(1280, 720);
    expect(matchesResolution(small, '4k')).toBe(false);
  });

  it('should accept 4K portrait (2160x3840 or larger)', () => {
    const portrait4k = createMockWallpaper(2160, 3840);
    expect(matchesResolution(portrait4k, '4k')).toBe(true);

    const portraitSmall = createMockWallpaper(1080, 1920);
    expect(matchesResolution(portraitSmall, '4k')).toBe(false);
  });

  it('should strictly handle 8K (7680x4320)', () => {
    const true8k = createMockWallpaper(7680, 4320);
    expect(matchesResolution(true8k, '8k')).toBe(true);

    const false8k = createMockWallpaper(3840, 2160);
    expect(matchesResolution(false8k, '8k')).toBe(false);
  });

  it('should handle 1080p and 2K thresholds', () => {
    const fhd = createMockWallpaper(1920, 1080);
    expect(matchesResolution(fhd, '1080p')).toBe(true);
    expect(matchesResolution(fhd, '2k')).toBe(false);

    const qhd = createMockWallpaper(2560, 1440);
    expect(matchesResolution(qhd, '2k')).toBe(true);
  });
});

describe('Orientation Filtering', () => {
  it('should classify desktop landscape correctly', () => {
    const landscape = createMockWallpaper(1920, 1080);
    expect(matchesOrientation(landscape, 'landscape')).toBe(true);
    expect(matchesOrientation(landscape, 'portrait')).toBe(false);
  });

  it('should classify mobile portrait correctly', () => {
    const portrait = createMockWallpaper(1080, 1920);
    expect(matchesOrientation(portrait, 'portrait')).toBe(true);
    expect(matchesOrientation(portrait, 'landscape')).toBe(false);
  });

  it('should classify ultrawide correctly (ratio >= 2.1)', () => {
    const ultrawide = createMockWallpaper(3440, 1440);
    expect(matchesOrientation(ultrawide, 'ultrawide')).toBe(true);
    expect(matchesOrientation(ultrawide, 'landscape')).toBe(true);

    const regular16x9 = createMockWallpaper(1920, 1080);
    expect(matchesOrientation(regular16x9, 'ultrawide')).toBe(false);
  });

  it('should classify square correctly (0.95 <= ratio <= 1.05)', () => {
    const square = createMockWallpaper(1000, 1000);
    expect(matchesOrientation(square, 'square')).toBe(true);
    expect(matchesOrientation(square, 'landscape')).toBe(false);
  });
});

describe('Aspect Ratio Calculation and Matching', () => {
  it('should match 16:9 within tolerance', () => {
    const w169 = createMockWallpaper(1920, 1080);
    expect(calculateAspectRatio(1920, 1080)).toBe('16:9');
    expect(matchesAspectRatio(w169, '16:9')).toBe(true);
    expect(matchesAspectRatio(w169, '9:16')).toBe(false);
  });

  it('should match 9:16 within tolerance', () => {
    const w916 = createMockWallpaper(1080, 1920);
    expect(calculateAspectRatio(1080, 1920)).toBe('9:16');
    expect(matchesAspectRatio(w916, '9:16')).toBe(true);
    expect(matchesAspectRatio(w916, '16:9')).toBe(false);
  });

  it('should match 21:9 within tolerance', () => {
    const w219 = createMockWallpaper(3440, 1440);
    expect(matchesAspectRatio(w219, '21:9')).toBe(true);
  });
});
