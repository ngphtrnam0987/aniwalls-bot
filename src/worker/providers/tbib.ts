import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface TBIBItem {
  id: number;
  directory: number | string;
  image: string;
  width: number;
  height: number;
  sample_width?: number;
  sample_height?: number;
  sample?: boolean;
  tags: string;
  rating: string;
  score: number;
  owner?: string;
}

export class TBIBProvider implements WallpaperProvider {
  name = 'tbib' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const url = new URL('https://tbib.org/index.php');
      url.searchParams.set('page', 'dapi');
      url.searchParams.set('s', 'post');
      url.searchParams.set('q', 'index');
      url.searchParams.set('json', '1');

      const tagsList: string[] = ['rating:general'];

      const parsed = parseAnimeQuery(filters.query || '');
      if (parsed.booruTags.length > 0) {
        tagsList.push(parsed.booruTags[0]);
      }

      if (filters.sort === 'favorites' || filters.sort === 'relevance') {
        tagsList.push('sort:score:desc');
      }

      url.searchParams.set('tags', tagsList.join(' '));
      // TBIB uses 0-indexed page (pid)
      const pageIndex = Math.max(0, (filters.page || 1) - 1);
      url.searchParams.set('pid', String(pageIndex));
      url.searchParams.set('limit', String(Math.min(filters.limit || 20, 50)));

      const res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) {
        console.warn(`TBIB API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const items = (await res.json()) as TBIBItem[];
      if (!Array.isArray(items)) {
        return { wallpapers: [], hasMore: false };
      }

      const wallpapers: Wallpaper[] = [];
      for (const item of items) {
        if (!item.image) continue;
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
      console.error('TBIB provider search error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const postId = id.replace(/^tbib_/, '');
      const url = `https://tbib.org/index.php?page=dapi&s=post&q=index&json=1&id=${postId}`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) return null;
      const items = (await res.json()) as TBIBItem[];
      if (!items || items.length === 0) return null;

      return this.normalize(items[0]);
    } catch (err) {
      console.error(`TBIB getById error for ${id}:`, err);
      return null;
    }
  }

  private normalize(item: TBIBItem): Wallpaper {
    const originalUrl = `https://tbib.org/images/${item.directory}/${item.image}`;
    const sampleUrl = item.sample
      ? `https://tbib.org/samples/${item.directory}/sample_${item.image}`
      : originalUrl;
    const thumbUrl = `https://tbib.org/thumbnails/${item.directory}/thumbnail_${item.image}`;

    const tags = (item.tags || '').split(' ').filter(Boolean);
    const primaryTag = tags[0] || 'Anime';
    const title = primaryTag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      id: `tbib_${item.id}`,
      provider: 'tbib',
      providerPostId: String(item.id),
      title: `${title} - TBIB #${item.id}`,
      tags: tags.slice(0, 15),
      characters: tags.filter((t) => !t.includes(':')).slice(0, 5),
      series: [],
      uploaderName: item.owner,
      width: item.width,
      height: item.height,
      resolution: `${item.width}x${item.height}`,
      aspectRatio: calculateAspectRatio(item.width, item.height),
      orientation: getOrientation(item.width, item.height),
      thumbnailUrl: thumbUrl,
      previewUrl: sampleUrl,
      originalFileUrl: originalUrl,
      postUrl: `https://tbib.org/index.php?page=post&s=view&id=${item.id}`,
      rating: 'safe',
      sourceMetadata: {
        score: item.score,
        rating: item.rating
      }
    };
  }
}
