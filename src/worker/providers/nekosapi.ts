import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';

interface NekosApiItem {
  id: number;
  url: string;
  rating?: string;
  color_dominant?: [number, number, number];
  color_palette?: Array<[number, number, number]>;
  artist_name?: string | null;
  tags?: string[];
  source_url?: string | null;
  sample_url?: string;
  width?: number;
  height?: number;
}

export class NekosApiProvider implements WallpaperProvider {
  name = 'nekosapi' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 50);
      const url = new URL('https://api.nekosapi.com/v4/images');

      url.searchParams.set('limit', String(limit));
      url.searchParams.set('page', String(page));

      if (filters.sfwOnly) {
        url.searchParams.set('rating', 'safe');
      }

      const query = (filters.query || '').trim().toLowerCase();
      if (query) {
        // Tag query if applicable
        const cleanTag = query.replace(/\s+/g, '-');
        url.searchParams.set('tags', cleanTag);
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) {
        console.warn(`NekosAPI returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const data = (await res.json()) as { items?: NekosApiItem[] };
      const items = data.items || [];

      const wallpapers: Wallpaper[] = [];
      for (const item of items) {
        if (!item.url) continue;
        const normalized = this.normalize(item);

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
        hasMore: items.length >= limit
      };
    } catch (err) {
      console.error('NekosAPI provider search error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const postId = id.replace(/^nekosapi_/, '');
      const url = `https://api.nekosapi.com/v4/images/${postId}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) return null;
      const item = (await res.json()) as NekosApiItem;
      if (!item || !item.url) return null;

      return this.normalize(item);
    } catch (err) {
      console.error(`NekosAPI getById error for ${id}:`, err);
      return null;
    }
  }

  private rgbToHex(rgb: [number, number, number]): string {
    const [r, g, b] = rgb;
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  private normalize(item: NekosApiItem): Wallpaper {
    const id = String(item.id);
    const tags = Array.isArray(item.tags) ? item.tags : [];

    // Dominant color & palette hex conversion
    let dominantColor: string | undefined;
    if (item.color_dominant && item.color_dominant.length === 3) {
      dominantColor = this.rgbToHex(item.color_dominant);
    }

    let colorPalette: string[] | undefined;
    if (Array.isArray(item.color_palette) && item.color_palette.length > 0) {
      colorPalette = item.color_palette
        .filter((rgb) => Array.isArray(rgb) && rgb.length === 3)
        .map((rgb) => this.rgbToHex(rgb as [number, number, number]));
    }

    const isPortrait = tags.includes('portrait') || tags.includes('phone') || tags.includes('mobile');
    const width = item.width || (isPortrait ? 1080 : 1920);
    const height = item.height || (isPortrait ? 1920 : 1080);

    const title = tags.length > 0
      ? tags.slice(0, 3).map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ')
      : 'Anime Artwork';

    return {
      id: `nekosapi_${id}`,
      provider: 'nekosapi',
      providerPostId: id,
      title,
      tags,
      characters: [],
      series: [],
      artistName: item.artist_name || undefined,
      externalSourceUrl: item.source_url || undefined,
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: calculateAspectRatio(width, height),
      orientation: getOrientation(width, height),
      mimeType: 'image/webp',
      thumbnailUrl: item.url,
      previewUrl: item.url,
      originalFileUrl: item.url,
      postUrl: `https://nekosapi.com/images/${id}`,
      dominantColor,
      colorPalette,
      rating: item.rating === 'safe' ? 'safe' : (item.rating === 'explicit' ? 'explicit' : 'questionable'),
      sourceMetadata: {
        rawItem: item
      }
    };
  }
}
