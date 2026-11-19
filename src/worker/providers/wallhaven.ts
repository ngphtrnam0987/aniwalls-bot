import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface WallhavenItem {
  id: string;
  url: string;
  short_url: string;
  views: number;
  favorites: number;
  source: string;
  purity: string;
  category: string;
  dimension_x: number;
  dimension_y: number;
  resolution: string;
  ratio: string;
  file_size: number;
  file_type: string;
  created_at: string;
  path: string;
  thumbs: {
    large: string;
    original: string;
    small: string;
  };
  uploader?: {
    username: string;
    group: string;
    avatar: Record<string, string>;
  };
  tags?: Array<{
    id: number;
    name: string;
    alias: string;
    category: string;
  }>;
}

interface WallhavenResponse {
  data: WallhavenItem[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    query: string | null;
  };
}

export class WallhavenProvider implements WallpaperProvider {
  name = 'wallhaven' as const;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const url = new URL('https://wallhaven.cc/api/v1/search');
      url.searchParams.set('categories', '010'); // Anime only
      url.searchParams.set('purity', '100'); // SFW only

      // Process query using anime dictionary
      const parsed = parseAnimeQuery(filters.query || '');
      const searchQuery = parsed.wallhavenQuery || 'anime';
      url.searchParams.set('q', searchQuery);

      // Sorting
      if (filters.sort === 'favorites') {
        url.searchParams.set('sorting', 'favorites');
      } else if (filters.sort === 'newest') {
        url.searchParams.set('sorting', 'date_added');
      } else if (filters.sort === 'random') {
        url.searchParams.set('sorting', 'random');
      } else if (filters.sort === 'resolution') {
        url.searchParams.set('sorting', 'toplist');
      } else {
        url.searchParams.set('sorting', 'relevance');
      }

      // Resolution & Ratio
      if (filters.resolution === '4k') {
        url.searchParams.set('atleast', '3840x2160');
      } else if (filters.resolution === '2k') {
        url.searchParams.set('atleast', '2560x1440');
      } else if (filters.resolution === '1080p') {
        url.searchParams.set('atleast', '1920x1080');
      } else if (filters.resolution === '8k') {
        url.searchParams.set('atleast', '7680x4320');
      }

      if (filters.aspectRatio && filters.aspectRatio !== 'all') {
        url.searchParams.set('ratios', filters.aspectRatio.replace(':', 'x'));
      }

      // Orientation ratio filter
      if (filters.orientation === 'portrait') {
        url.searchParams.set('ratios', '9x16,9x18,10x16');
      } else if (filters.orientation === 'landscape') {
        url.searchParams.set('ratios', '16x9,16x10,21x9,32x9');
      } else if (filters.orientation === 'ultrawide') {
        url.searchParams.set('ratios', '21x9,32x9');
      } else if (filters.orientation === 'square') {
        url.searchParams.set('ratios', '1x1');
      }

      url.searchParams.set('page', String(filters.page || 1));

      if (this.apiKey) {
        url.searchParams.set('apikey', this.apiKey);
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) {
        console.warn(`Wallhaven API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const json = await res.json() as WallhavenResponse;
      if (!json.data || !Array.isArray(json.data)) {
        return { wallpapers: [], hasMore: false };
      }

      const wallpapers: Wallpaper[] = json.data
        .map((item) => this.normalizeItem(item, parsed))
        .filter((w) => matchesResolution(w, filters.resolution))
        .filter((w) => matchesOrientation(w, filters.orientation))
        .filter((w) => matchesAspectRatio(w, filters.aspectRatio));

      const hasMore = (json.meta?.current_page ?? 1) < (json.meta?.last_page ?? 1);

      return {
        wallpapers,
        hasMore
      };
    } catch (err) {
      console.error('Error fetching Wallhaven wallpapers:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const cleanId = id.replace(/^wallhaven_/, '');
      const url = new URL(`https://wallhaven.cc/api/v1/w/${cleanId}`);
      if (this.apiKey) {
        url.searchParams.set('apikey', this.apiKey);
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0'
        }
      });

      if (!res.ok) return null;
      const json = await res.json() as { data: WallhavenItem };
      if (!json.data) return null;

      return this.normalizeItem(json.data);
    } catch (err) {
      console.error('Error fetching Wallhaven single wallpaper:', err);
      return null;
    }
  }

  private normalizeItem(item: WallhavenItem, parsedHint?: ReturnType<typeof parseAnimeQuery>): Wallpaper {
    const width = item.dimension_x;
    const height = item.dimension_y;
    const orientation = getOrientation(width, height);
    const calculatedRatio = calculateAspectRatio(width, height);

    // Parse external source and artist if available
    let artistName: string | undefined;
    let artistUrl: string | undefined;
    const externalSourceUrl = item.source && item.source.startsWith('http') ? item.source : undefined;

    if (externalSourceUrl) {
      if (externalSourceUrl.includes('pixiv.net')) {
        // e.g. https://www.pixiv.net/en/artworks/12345
        artistUrl = externalSourceUrl;
      } else if (externalSourceUrl.includes('twitter.com') || externalSourceUrl.includes('x.com')) {
        artistUrl = externalSourceUrl;
      } else if (externalSourceUrl.includes('artstation.com')) {
        artistUrl = externalSourceUrl;
      }
    }

    const characters: string[] = [];
    const series: string[] = [];
    const tags: string[] = [];

    if (item.tags && Array.isArray(item.tags)) {
      for (const t of item.tags) {
        tags.push(t.name);
        if (t.category === 'character' && !characters.includes(t.name)) {
          characters.push(t.name);
        } else if (t.category === 'anime' && !series.includes(t.name)) {
          series.push(t.name);
        }
      }
    }

    const title = characters[0] || series[0] || (parsedHint?.cleanQuery ? parsedHint.cleanQuery.toUpperCase() : 'Anime Wallpaper');

    return {
      id: `wallhaven_${item.id}`,
      provider: 'wallhaven',
      providerPostId: item.id,
      title: title,
      tags,
      characters,
      series,
      artistName: artistName || 'Chưa xác định',
      artistUrl,
      uploaderName: item.uploader?.username,
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: calculatedRatio,
      orientation,
      fileSize: item.file_size,
      mimeType: item.file_type || 'image/jpeg',
      thumbnailUrl: item.thumbs.large || item.thumbs.small,
      previewUrl: item.thumbs.large || item.path,
      originalFileUrl: item.path,
      postUrl: item.url,
      externalSourceUrl,
      rating: 'safe',
      sourceMetadata: {
        views: item.views,
        favorites: item.favorites,
        category: item.category,
        short_url: item.short_url
      },
      createdAt: item.created_at
    };
  }
}
