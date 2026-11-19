import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface YandereItem {
  id: number;
  tags: string;
  created_at: number;
  creator_id: number;
  author: string;
  source: string;
  score: number;
  md5: string;
  file_size: number;
  file_ext: string;
  file_url: string;
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

export class YandereProvider implements WallpaperProvider {
  name = 'yandere' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const url = new URL('https://yande.re/post.json');
      const tagsList: string[] = ['rating:safe'];

      const parsed = parseAnimeQuery(filters.query || '');

      if (parsed.booruTags.length > 0) {
        tagsList.push(parsed.booruTags[0]);
      }

      if (filters.sort === 'favorites' || filters.sort === 'relevance') {
        tagsList.push('order:score');
      } else if (filters.sort === 'random') {
        tagsList.push('order:random');
      }

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
        console.warn(`Yande.re API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const items = (await res.json()) as YandereItem[];
      if (!Array.isArray(items)) {
        return { wallpapers: [], hasMore: false };
      }

      const wallpapers: Wallpaper[] = [];
      for (const item of items) {
        if (item.rating !== 's' && filters.sfwOnly) continue;
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
        hasMore: items.length >= (filters.limit || 20)
      };
    } catch (err) {
      console.error('Yande.re provider search error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const postId = id.replace(/^yandere_/, '');
      const url = `https://yande.re/post.json?tags=id:${postId}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) return null;
      const items = (await res.json()) as YandereItem[];
      if (!items || items.length === 0) return null;

      return this.normalize(items[0]);
    } catch (err) {
      console.error(`Yande.re getById error for ${id}:`, err);
      return null;
    }
  }

  private normalize(item: YandereItem): Wallpaper {
    const tags = item.tags.split(' ').filter(Boolean);
    const primaryTag = tags[0] || 'Anime';
    const title = primaryTag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      id: `yandere_${item.id}`,
      provider: 'yandere',
      providerPostId: String(item.id),
      title: `${title} - Yande.re #${item.id}`,
      tags: tags.slice(0, 15),
      characters: tags.filter((t) => !t.includes(':')).slice(0, 5),
      series: [],
      uploaderName: item.author || undefined,
      width: item.width,
      height: item.height,
      resolution: `${item.width}x${item.height}`,
      aspectRatio: calculateAspectRatio(item.width, item.height),
      orientation: getOrientation(item.width, item.height),
      fileSize: item.file_size,
      mimeType: item.file_ext === 'png' ? 'image/png' : 'image/jpeg',
      thumbnailUrl: item.preview_url,
      previewUrl: item.sample_url || item.jpeg_url || item.file_url,
      originalFileUrl: item.file_url,
      postUrl: `https://yande.re/post/show/${item.id}`,
      externalSourceUrl: item.source || undefined,
      rating: 'safe',
      sourceMetadata: {
        score: item.score,
        md5: item.md5,
        rating: item.rating
      }
    };
  }
}
