import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';

interface NekosBestItem {
  artist_name?: string;
  artist_href?: string;
  source_url?: string;
  url: string;
  dimensions?: {
    width: number;
    height: number;
  };
}

export class NekosBestProvider implements WallpaperProvider {
  name = 'nekos_best' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const limit = Math.min(filters.limit || 20, 20);
      let url: string;

      if (filters.query && filters.query.trim()) {
        url = `https://nekos.best/api/v2/search?query=${encodeURIComponent(filters.query.trim())}&type=1&amount=${limit}`;
      } else {
        const categories = ['neko', 'waifu', 'kitsune'];
        const randomCat = categories[Math.floor(Math.random() * categories.length)];
        url = `https://nekos.best/api/v2/${randomCat}?amount=${limit}`;
      }

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) {
        console.warn(`Nekos.best API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const json = (await res.json()) as { results?: NekosBestItem[] };
      const items = json.results || [];

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
      console.error('Nekos.best provider search error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    // For Nekos.best, direct lookup by arbitrary ID is not a single item endpoint,
    // but the ID contains the filename/UUID.
    return null;
  }

  private normalize(item: NekosBestItem): Wallpaper {
    const w = item.dimensions?.width || 1920;
    const h = item.dimensions?.height || 1080;

    // Extract UUID from URL: https://nekos.best/api/v2/neko/<uuid>.png
    const parts = item.url.split('/');
    const filename = parts[parts.length - 1] || `${Date.now()}`;
    const id = filename.replace(/\.[^/.]+$/, '');

    const artist = item.artist_name || 'Anime Illustrator';

    return {
      id: `nekos_best_${id}`,
      provider: 'nekos_best',
      providerPostId: id,
      title: `${artist} Anime Art`,
      tags: ['anime', 'artwork', 'highres'],
      characters: [],
      series: [],
      artistName: item.artist_name,
      artistUrl: item.artist_href,
      width: w,
      height: h,
      resolution: `${w}x${h}`,
      aspectRatio: calculateAspectRatio(w, h),
      orientation: getOrientation(w, h),
      thumbnailUrl: item.url,
      previewUrl: item.url,
      originalFileUrl: item.url,
      postUrl: item.source_url || item.url,
      externalSourceUrl: item.source_url,
      rating: 'safe',
      sourceMetadata: {
        artist_name: item.artist_name,
        artist_href: item.artist_href
      }
    };
  }
}
