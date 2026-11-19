import { describe, it, expect } from 'vitest';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

describe('Query Parsing & Natural Language Filters', () => {
  it('should parse resolution keywords and strip them from clean query', () => {
    const res4k = parseAnimeQuery('mountain 4k');
    expect(res4k.detectedResolution).toBe('4k');
    expect(res4k.cleanQuery).toBe('mountain');

    const res2k = parseAnimeQuery('wallpaper 2k');
    expect(res2k.detectedResolution).toBe('2k');

    const res1080p = parseAnimeQuery('city 1080p');
    expect(res1080p.detectedResolution).toBe('1080p');

    const res8k = parseAnimeQuery('universe 8k');
    expect(res8k.detectedResolution).toBe('8k');
  });

  it('should parse orientation keywords accurately', () => {
    const resMobile = parseAnimeQuery('sky clouds mobile');
    expect(resMobile.detectedOrientation).toBe('portrait');
    expect(resMobile.cleanQuery).toBe('sky clouds');

    const resDesktop = parseAnimeQuery('sunset ocean desktop');
    expect(resDesktop.detectedOrientation).toBe('landscape');
    expect(resDesktop.cleanQuery).toBe('sunset ocean');

    const resUltrawide = parseAnimeQuery('space stars ultrawide');
    expect(resUltrawide.detectedOrientation).toBe('ultrawide');

    const resSquare = parseAnimeQuery('minimal art square');
    expect(resSquare.detectedOrientation).toBe('square');
  });

  it('should tokenize query into booru tags and wallhaven query', () => {
    const res = parseAnimeQuery('cyberpunk city night');
    expect(res.booruTags).toEqual(['cyberpunk', 'city', 'night']);
    expect(res.wallhavenQuery).toBe('cyberpunk city night');
  });
});
