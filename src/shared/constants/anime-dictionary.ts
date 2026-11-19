export interface QueryEntity {
  name: string;
  category: 'character' | 'series' | 'general';
  tags: string[];
}

export interface ParsedQuery {
  rawQuery: string;
  cleanQuery: string;
  detectedResolution?: '1080p' | '2k' | '4k' | '8k';
  detectedOrientation?: 'landscape' | 'portrait' | 'ultrawide' | 'square';
  booruTags: string[];
  wallhavenQuery: string;
}

export function parseAnimeQuery(input: string): ParsedQuery {
  const normalized = input.trim().toLowerCase();
  let clean = normalized;

  let detectedResolution: '1080p' | '2k' | '4k' | '8k' | undefined;
  if (/\b8k\b/i.test(clean)) {
    detectedResolution = '8k';
    clean = clean.replace(/\b8k\b/gi, '').trim();
  } else if (/\b4k\b/i.test(clean) || /\buhd\b/i.test(clean)) {
    detectedResolution = '4k';
    clean = clean.replace(/\b(4k|uhd)\b/gi, '').trim();
  } else if (/\b2k\b/i.test(clean) || /\bqhd\b/i.test(clean) || /\b1440p\b/i.test(clean)) {
    detectedResolution = '2k';
    clean = clean.replace(/\b(2k|qhd|1440p)\b/gi, '').trim();
  } else if (/\b1080p\b/i.test(clean) || /\bfhd\b/i.test(clean)) {
    detectedResolution = '1080p';
    clean = clean.replace(/\b(1080p|fhd)\b/gi, '').trim();
  }

  let detectedOrientation: 'landscape' | 'portrait' | 'ultrawide' | 'square' | undefined;
  if (/\b(mobile|phone|vertical|portrait|dien thoai)\b/i.test(clean)) {
    detectedOrientation = 'portrait';
    clean = clean.replace(/\b(mobile|phone|vertical|portrait|dien thoai)\b/gi, '').trim();
  } else if (/\b(desktop|pc|computer|horizontal|landscape|may tinh)\b/i.test(clean)) {
    detectedOrientation = 'landscape';
    clean = clean.replace(/\b(desktop|pc|computer|horizontal|landscape|may tinh)\b/gi, '').trim();
  } else if (/\b(ultrawide|21:9|32:9)\b/i.test(clean)) {
    detectedOrientation = 'ultrawide';
    clean = clean.replace(/\b(ultrawide|21:9|32:9)\b/gi, '').trim();
  } else if (/\bsquare\b/i.test(clean)) {
    detectedOrientation = 'square';
    clean = clean.replace(/\bsquare\b/gi, '').trim();
  }

  // Tokenize words for booru search tags
  const tokens = clean.split(/\s+/).filter(Boolean);
  const booruTags = tokens.map((token) => token.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

  return {
    rawQuery: input,
    cleanQuery: clean || input,
    detectedResolution,
    detectedOrientation,
    booruTags,
    wallhavenQuery: clean || 'anime'
  };
}
