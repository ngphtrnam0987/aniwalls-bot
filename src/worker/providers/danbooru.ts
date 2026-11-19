import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface DanbooruPostItem {
  id: number;
  created_at: string;
  uploader_id: number;
  score: number;
  source: string;
  md5: string;
  rating: string;
  image_width: number;
  image_height: number;
  tag_string: string;
  tag_string_general: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  file_url?: string;
  large_file_url?: string;
  preview_file_url?: string;
  file_size?: number;
  file_ext?: string;
}

export class DanbooruProvider implements WallpaperProvider {
  name = 'danbooru' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    try {
      const url = new URL('https://danbooru.donmai.us/posts.json');
      const tagsList: string[] = ['rating:g'];

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
        console.warn(`Danbooru API returned status ${res.status}`);
        return { wallpapers: [], hasMore: false };
      }

      const items = (await res.json()) as DanbooruPostItem[];
      if (!Array.isArray(items)) {
        return { wallpapers: [], hasMore: false };
      }

      const wallpapers: Wallpaper[] = [];
      for (const item of items) {
        if (!item.file_url) continue;
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
      console.error('Danbooru provider search error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const postId = id.replace(/^danbooru_/, '');
      const url = `https://danbooru.donmai.us/posts/${postId}.json`;

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        }
      });

      if (!res.ok) return null;
      const item = (await res.json()) as DanbooruPostItem;
      if (!item || !item.id || !item.file_url) return null;

      return this.normalize(item);
    } catch (err) {
      console.error(`Danbooru getById error for ${id}:`, err);
      return null;
    }
  }

  private normalize(item: DanbooruPostItem): Wallpaper {
    const characters = item.tag_string_character
      ? item.tag_string_character.split(' ').map((s) => s.replace(/_/g, ' '))
      : [];
    const series = item.tag_string_copyright
      ? item.tag_string_copyright.split(' ').map((s) => s.replace(/_/g, ' '))
      : [];
    const artist = item.tag_string_artist
      ? item.tag_string_artist.split(' ')[0]?.replace(/_/g, ' ')
      : undefined;

    let title = 'Danbooru Anime Artwork';
    if (characters.length > 0) {
      title = characters.slice(0, 2).join(' & ');
    } else if (series.length > 0) {
      title = series[0];
    }

    const w = item.image_width || 1920;
    const h = item.image_height || 1080;
    const originalUrl = item.file_url!;
    const previewUrl = item.large_file_url || originalUrl;
    const thumbUrl = item.preview_file_url || previewUrl;

    return {
      id: `danbooru_${item.id}`,
      provider: 'danbooru',
      providerPostId: String(item.id),
      title: `${title} #${item.id}`,
      tags: (item.tag_string || '').split(' ').slice(0, 15),
      characters: characters.slice(0, 5),
      series: series.slice(0, 3),
      artistName: artist,
      width: w,
      height: h,
      resolution: `${w}x${h}`,
      aspectRatio: calculateAspectRatio(w, h),
      orientation: getOrientation(w, h),
      fileSize: item.file_size,
      mimeType: item.file_ext === 'png' ? 'image/png' : 'image/jpeg',
      thumbnailUrl: thumbUrl,
      previewUrl: previewUrl,
      originalFileUrl: originalUrl,
      postUrl: `https://danbooru.donmai.us/posts/${item.id}`,
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
