import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface ZerochanItem {
  id: string | number;
  width?: string | number;
  height?: string | number;
  thumbnail?: string;
  source?: string;
  tag?: string;
  tags?: string[];
  hash?: string;
}

export class ZerochanProvider implements WallpaperProvider {
  name = 'zerochan' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const page = filters.page || 1;
      let endpoint: string;

      const rawQuery = (filters.query || '').trim();
      const parsed = parseAnimeQuery(rawQuery);
      const queryTag = parsed.cleanQuery || rawQuery;

      if (queryTag) {
        // Zerochan formats tag path with '+' e.g. /Genshin+Impact?json=1
        const formattedTag = encodeURIComponent(queryTag.replace(/\s+/g, '+'));
        endpoint = `https://www.zerochan.net/${formattedTag}?json=1&p=${page}`;
      } else {
        endpoint = `https://www.zerochan.net/?json=1&p=${page}`;
      }

      if (filters.sort === 'favorites') {
        endpoint += '&s=fav';
      } else if (filters.sort === 'newest') {
        endpoint += '&s=id';
      }

      const res = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json, text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)',
          'Referer': 'https://www.zerochan.net/'
        }
      });

      if (!res.ok && res.status !== 500) {
        console.warn(`Zerochan API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const text = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
      const items = this.parseZerochanJson(text);
      if (!items || items.length === 0) {
        return { wallpapers: [], hasMore: false };
      }

      const wallpapers: Wallpaper[] = [];
      for (const item of items) {
        if (!item.id) continue;
        const normalized = this.normalize(item);

        // Filter out adult content if SFW requested
        if (filters.sfwOnly && normalized.rating !== 'safe') {
          continue;
        }

        if (
          matchesResolution(normalized, filters.resolution) &&
          matchesOrientation(normalized, filters.orientation) &&
          matchesAspectRatio(normalized, filters.aspectRatio)
        ) {
          wallpapers.push(normalized);
        }
      }

      return {
        wallpapers,
        hasMore: items.length >= 20
      };
    } catch (err) {
      console.error('Zerochan provider search error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const postId = id.replace(/^zerochan_/, '');
      const url = `https://www.zerochan.net/${postId}?json=1`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)',
          'Referer': 'https://www.zerochan.net/'
        }
      });

      if (!res.ok && res.status !== 500) return null;
      const text = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
      const items = this.parseZerochanJson(text);
      const found = items.find((it) => String(it.id) === postId) || items[0];
      if (!found) return null;

      return this.normalize(found);
    } catch (err) {
      console.error(`Zerochan getById error for ${id}:`, err);
      return null;
    }
  }

  private parseZerochanJson(rawText: string): ZerochanItem[] {
    try {
      // Zerochan has a quirk where its JSON response may have an unescaped outer brace
      // and trailing HTML like `}<p id="browse-filters"...`
      const cut = rawText.indexOf('}<');
      const firstBrace = rawText.indexOf('{', 1);

      let cleanStr: string;
      if (cut !== -1 && firstBrace !== -1 && cut > firstBrace) {
        cleanStr = rawText.slice(firstBrace, cut + 1);
      } else {
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');
        if (start !== -1 && end > start) {
          cleanStr = rawText.slice(start, end + 1).replace(/^\s*\{\s*\{/, '{');
        } else {
          return [];
        }
      }

      const data = JSON.parse(cleanStr);
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  }

  private normalize(item: ZerochanItem): Wallpaper {
    const id = String(item.id);
    const width = Number(item.width) || 1920;
    const height = Number(item.height) || 1080;
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const mainTag = item.tag || 'Anime Artwork';

    // Parse characters and series from tags
    const characters: string[] = [];
    const series: string[] = [];
    let artistName: string | undefined;

    if (mainTag && !mainTag.includes('Artwork')) {
      series.push(mainTag);
    }

    for (const tag of tags) {
      const lower = tag.toLowerCase();
      if (tag.includes('(') && tag.includes(')')) {
        const match = tag.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          characters.push(match[1].trim());
          if (!series.includes(match[2].trim())) {
            series.push(match[2].trim());
          }
        }
      } else if (lower.includes('artist') || lower.includes('mangaka') || lower.includes('illustrator')) {
        artistName = tag;
      }
    }

    // Determine SFW rating
    const hasNsfwTag = tags.some((t) => {
      const l = t.toLowerCase();
      return l.includes('ecchi') || l.includes('nsfw') || l.includes('nude') || l.includes('panty') || l.includes('swimsuit');
    });
    const rating = hasNsfwTag ? 'questionable' : 'safe';

    const safeTagSlug = encodeURIComponent(mainTag.replace(/[^a-zA-Z0-9]/g, '.'));
    const previewUrl = `https://static.zerochan.net/${safeTagSlug}.1024.${id}.webp`;
    const thumbnailUrl = item.thumbnail || `https://s3.zerochan.net/240/${safeTagSlug}.${id}.avif`;
    const originalFileUrl = `https://static.zerochan.net/${safeTagSlug}.full.${id}.jpg`;
    const postUrl = `https://www.zerochan.net/${id}`;

    let title = mainTag;
    if (characters.length > 0) {
      title = `${characters[0]} - ${mainTag}`;
    }

    return {
      id: `zerochan_${id}`,
      provider: 'zerochan',
      providerPostId: id,
      title,
      tags,
      characters: Array.from(new Set(characters)),
      series: Array.from(new Set(series)),
      artistName,
      artistUrl: item.source && (item.source.includes('pixiv.net') || item.source.includes('twitter.com')) ? item.source : undefined,
      externalSourceUrl: item.source,
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: calculateAspectRatio(width, height),
      orientation: getOrientation(width, height),
      thumbnailUrl,
      previewUrl,
      originalFileUrl,
      postUrl,
      rating,
      sourceMetadata: {
        rawItem: item
      }
    };
  }
}
