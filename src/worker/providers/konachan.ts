import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface KonachanItem {
  id: number;
  tags: string;
  created_at: number;
  creator_id: number;
  author: string; // Uploader
  source: string;
  score: number;
  md5: string;
  file_size: number;
  file_ext: string;
  file_url: string;
  is_shown_in_index: boolean;
  preview_url: string;
  preview_width: number;
  preview_height: number;
  sample_url: string;
  sample_width: number;
  sample_height: number;
  sample_file_size: number;
  jpeg_url: string;
  jpeg_width: number;
  jpeg_height: number;
  rating: 's' | 'q' | 'e';
  width: number;
  height: number;
}

export class KonachanProvider implements WallpaperProvider {
  name = 'konachan' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const url = new URL('https://konachan.net/post.json');
      const tagsList: string[] = ['rating:safe'];

      const parsed = parseAnimeQuery(filters.query || '');

      // Add query tags
      if (parsed.booruTags.length > 0) {
        // Booru limits multiple tags in basic search, use the most specific primary tag
        tagsList.push(parsed.booruTags[0]);
      }

      // Add order tag
      if (filters.sort === 'favorites' || filters.sort === 'relevance') {
        tagsList.push('order:score');
      } else if (filters.sort === 'random') {
        tagsList.push('order:random');
      }

      // Resolution tags
      if (filters.resolution === '4k') {
        tagsList.push('width:>=3840');
      } else if (filters.resolution === '2k') {
        tagsList.push('width:>=2560');
      } else if (filters.resolution === '1080p') {
        tagsList.push('width:>=1920');
      }

      url.searchParams.set('tags', tagsList.join(' '));
      url.searchParams.set('page', String(filters.page || 1));
      url.searchParams.set('limit', String(Math.min(filters.limit || 20, 50)));

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) {
        console.warn(`Konachan API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const items = await res.json() as KonachanItem[];
      if (!Array.isArray(items)) {
        return { wallpapers: [], hasMore: false };
      }

      const wallpapers: Wallpaper[] = items
        .filter((item) => item.rating === 's' && item.file_url) // Always enforce rating safe
        .map((item) => this.normalizeItem(item, parsed))
        .filter((w) => matchesResolution(w, filters.resolution))
        .filter((w) => matchesOrientation(w, filters.orientation))
        .filter((w) => matchesAspectRatio(w, filters.aspectRatio));

      return {
        wallpapers,
        hasMore: items.length >= (filters.limit || 20)
      };
    } catch (err) {
      console.error('Error fetching Konachan wallpapers:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const cleanId = id.replace(/^konachan_/, '');
      const url = new URL(`https://konachan.net/post.json?tags=id:${cleanId}`);

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0'
        }
      });

      if (!res.ok) return null;
      const items = await res.json() as KonachanItem[];
      if (!Array.isArray(items) || items.length === 0) return null;

      return this.normalizeItem(items[0]);
    } catch (err) {
      console.error('Error fetching Konachan single wallpaper:', err);
      return null;
    }
  }

  private normalizeItem(item: KonachanItem, parsedHint?: ReturnType<typeof parseAnimeQuery>): Wallpaper {
    const width = item.width;
    const height = item.height;
    const orientation = getOrientation(width, height);
    const calculatedRatio = calculateAspectRatio(width, height);

    const rawTags = (item.tags || '').split(/\s+/).filter(Boolean);
    const characters: string[] = [];
    const series: string[] = [];
    let artistName: string | undefined;

    // Detect characters and series from booru tag conventions (e.g. name_(series))
    for (const tag of rawTags) {
      if (tag.includes('(') && tag.endsWith(')')) {
        const match = tag.match(/^(.+)_\((.+)\)$/);
        if (match) {
          characters.push(match[1].replace(/_/g, ' '));
          series.push(match[2].replace(/_/g, ' '));
        }
      }
    }

    // Check external source
    let externalSourceUrl: string | undefined;
    let artistUrl: string | undefined;
    if (item.source && item.source.startsWith('http')) {
      externalSourceUrl = item.source;
      if (item.source.includes('pixiv.net') || item.source.includes('twitter.com') || item.source.includes('x.com')) {
        artistUrl = item.source;
      }
    }

    const title = characters[0] || series[0] || (rawTags[0] ? rawTags[0].replace(/_/g, ' ') : 'Anime Wallpaper');

    return {
      id: `konachan_${item.id}`,
      provider: 'konachan',
      providerPostId: String(item.id),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      tags: rawTags,
      characters,
      series,
      artistName: artistName || 'Chưa xác định',
      artistUrl,
      uploaderName: item.author, // Clearly labeled as uploader
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: calculatedRatio,
      orientation,
      fileSize: item.file_size,
      mimeType: item.file_ext === 'png' ? 'image/png' : 'image/jpeg',
      thumbnailUrl: item.sample_url || item.preview_url,
      previewUrl: item.sample_url || item.file_url,
      originalFileUrl: item.file_url,
      postUrl: `https://konachan.net/post/show/${item.id}`,
      externalSourceUrl,
      rating: 'safe',
      sourceMetadata: {
        score: item.score,
        md5: item.md5,
        created_at: item.created_at
      },
      createdAt: item.created_at ? new Date(item.created_at * 1000).toISOString() : undefined
    };
  }
}
