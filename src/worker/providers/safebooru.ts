import { Wallpaper, SearchFilters } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult, calculateAspectRatio, getOrientation, matchesResolution, matchesOrientation, matchesAspectRatio } from './base';
import { parseAnimeQuery } from '@/shared/constants/anime-dictionary';

interface DonmaiPost {
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
  tag_string_meta: string;
  file_url?: string;
  large_file_url?: string;
  preview_file_url?: string;
  file_size?: number;
  file_ext?: string;
}

interface SafebooruOrgItem {
  id: number;
  width: number;
  height: number;
  file_url: string;
  sample_url?: string;
  preview_url: string;
  tags: string;
  source: string;
  rating: string;
  score: number;
  owner: string;
  image: string;
}

export class SafebooruProvider implements WallpaperProvider {
  name = 'safebooru' as const;

  async search(filters: SearchFilters): Promise<ProviderResult> {
    const parsed = parseAnimeQuery(filters.query || '');

    // 1. Try safebooru.donmai.us first
    try {
      const donmaiResult = await this.searchDonmai(filters, parsed);
      if (donmaiResult && donmaiResult.wallpapers.length > 0) {
        return donmaiResult;
      }
    } catch (err) {
      console.warn('Safebooru donmai API error, falling back to safebooru.org:', err);
    }

    // 2. Fallback to safebooru.org (DAPI) if donmai is blocked or empty
    try {
      const orgResult = await this.searchSafebooruOrg(filters, parsed);
      return orgResult;
    } catch (err) {
      console.error('Safebooru org API error:', err);
      return { wallpapers: [], hasMore: false };
    }
  }

  private async searchDonmai(filters: SearchFilters, parsed: ReturnType<typeof parseAnimeQuery>): Promise<ProviderResult | null> {
    const url = new URL('https://safebooru.donmai.us/posts.json');
    const tags: string[] = ['rating:g']; // General rating only

    if (parsed.booruTags.length > 0) {
      tags.push(parsed.booruTags[0]);
    }

    if (filters.resolution === '4k') {
      tags.push('width:>=3840');
    } else if (filters.resolution === '2k') {
      tags.push('width:>=2560');
    } else if (filters.resolution === '1080p') {
      tags.push('width:>=1920');
    }

    url.searchParams.set('tags', tags.join(' '));
    url.searchParams.set('page', String(filters.page || 1));
    url.searchParams.set('limit', String(Math.min(filters.limit || 20, 50)));

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
      }
    });

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      return null;
    }

    const posts = await res.json() as DonmaiPost[];
    if (!Array.isArray(posts)) return null;

    const wallpapers: Wallpaper[] = posts
      .filter((p) => p.rating === 'g' && (p.file_url || p.large_file_url))
      .map((p) => this.normalizeDonmaiPost(p, parsed))
      .filter((w) => matchesResolution(w, filters.resolution))
      .filter((w) => matchesOrientation(w, filters.orientation))
      .filter((w) => matchesAspectRatio(w, filters.aspectRatio));

    return {
      wallpapers,
      hasMore: posts.length >= (filters.limit || 20)
    };
  }

  private async searchSafebooruOrg(filters: SearchFilters, parsed: ReturnType<typeof parseAnimeQuery>): Promise<ProviderResult> {
    const url = new URL('https://safebooru.org/index.php');
    url.searchParams.set('page', 'dapi');
    url.searchParams.set('s', 'post');
    url.searchParams.set('q', 'index');
    url.searchParams.set('json', '1');
    url.searchParams.set('pid', String((filters.page || 1) - 1));
    url.searchParams.set('limit', String(Math.min(filters.limit || 20, 50)));

    const tagList: string[] = ['rating:safe'];
    if (parsed.booruTags.length > 0) {
      tagList.push(parsed.booruTags[0]);
    }

    url.searchParams.set('tags', tagList.join(' '));

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
      }
    });

    if (!res.ok) {
      return { wallpapers: [], hasMore: false };
    }

    const items = await res.json() as SafebooruOrgItem[];
    if (!Array.isArray(items)) {
      return { wallpapers: [], hasMore: false };
    }

    const wallpapers: Wallpaper[] = items
      .filter((item) => item.rating === 'safe' && item.file_url)
      .map((item) => this.normalizeOrgItem(item, parsed))
      .filter((w) => matchesResolution(w, filters.resolution))
      .filter((w) => matchesOrientation(w, filters.orientation))
      .filter((w) => matchesAspectRatio(w, filters.aspectRatio));

    return {
      wallpapers,
      hasMore: items.length >= (filters.limit || 20)
    };
  }

  async getById(id: string): Promise<Wallpaper | null> {
    try {
      const cleanId = id.replace(/^safebooru_/, '');
      // Try Donmai first
      const url = new URL(`https://safebooru.donmai.us/posts/${cleanId}.json`);
      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'AniWalls/1.0' }
      });

      if (res.ok && res.headers.get('content-type')?.includes('json')) {
        const post = await res.json() as DonmaiPost;
        return this.normalizeDonmaiPost(post);
      }

      // Try org fallback
      const orgUrl = new URL(`https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&id=${cleanId}`);
      const orgRes = await fetch(orgUrl.toString(), {
        headers: { 'Accept': 'application/json', 'User-Agent': 'AniWalls/1.0' }
      });
      if (orgRes.ok) {
        const items = await orgRes.json() as SafebooruOrgItem[];
        if (Array.isArray(items) && items.length > 0) {
          return this.normalizeOrgItem(items[0]);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private normalizeDonmaiPost(p: DonmaiPost, parsedHint?: ReturnType<typeof parseAnimeQuery>): Wallpaper {
    const width = p.image_width;
    const height = p.image_height;
    const orientation = getOrientation(width, height);
    const calculatedRatio = calculateAspectRatio(width, height);

    const characters = (p.tag_string_character || '').split(/\s+/).filter(Boolean).map(c => c.replace(/_/g, ' '));
    const series = (p.tag_string_copyright || '').split(/\s+/).filter(Boolean).map(s => s.replace(/_/g, ' '));
    const artists = (p.tag_string_artist || '').split(/\s+/).filter(Boolean);
    const artistName = artists.length > 0 ? artists[0].replace(/_/g, ' ') : undefined;

    let externalSourceUrl: string | undefined;
    let artistUrl: string | undefined;
    if (p.source && p.source.startsWith('http')) {
      externalSourceUrl = p.source;
      if (p.source.includes('pixiv.net') || p.source.includes('twitter.com') || p.source.includes('x.com')) {
        artistUrl = p.source;
      }
    }

    const title = characters[0] || series[0] || (parsedHint?.cleanQuery ? parsedHint.cleanQuery.toUpperCase() : 'Anime Wallpaper');
    const originalUrl = p.file_url || p.large_file_url || '';
    const previewUrl = p.large_file_url || p.preview_file_url || originalUrl;

    return {
      id: `safebooru_${p.id}`,
      provider: 'safebooru',
      providerPostId: String(p.id),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      tags: (p.tag_string || '').split(/\s+/).filter(Boolean),
      characters,
      series,
      artistName: artistName || 'Chưa xác định',
      artistUrl,
      uploaderName: p.uploader_id ? `User #${p.uploader_id}` : undefined,
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: calculatedRatio,
      orientation,
      fileSize: p.file_size,
      mimeType: p.file_ext === 'png' ? 'image/png' : 'image/jpeg',
      thumbnailUrl: p.preview_file_url || previewUrl,
      previewUrl,
      originalFileUrl: originalUrl,
      postUrl: `https://safebooru.donmai.us/posts/${p.id}`,
      externalSourceUrl,
      rating: 'safe',
      sourceMetadata: {
        score: p.score,
        md5: p.md5
      },
      createdAt: p.created_at
    };
  }

  private normalizeOrgItem(item: SafebooruOrgItem, parsedHint?: ReturnType<typeof parseAnimeQuery>): Wallpaper {
    const width = item.width;
    const height = item.height;
    const orientation = getOrientation(width, height);
    const calculatedRatio = calculateAspectRatio(width, height);

    const rawTags = (item.tags || '').split(/\s+/).filter(Boolean);
    const characters: string[] = [];
    const series: string[] = [];

    for (const tag of rawTags) {
      if (tag.includes('(') && tag.endsWith(')')) {
        const match = tag.match(/^(.+)_\((.+)\)$/);
        if (match) {
          characters.push(match[1].replace(/_/g, ' '));
          series.push(match[2].replace(/_/g, ' '));
        }
      }
    }

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
      id: `safebooru_${item.id}`,
      provider: 'safebooru',
      providerPostId: String(item.id),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      tags: rawTags,
      characters,
      series,
      artistName: 'Chưa xác định',
      artistUrl,
      uploaderName: item.owner,
      width,
      height,
      resolution: `${width}x${height}`,
      aspectRatio: calculatedRatio,
      orientation,
      mimeType: item.image?.endsWith('.png') ? 'image/png' : 'image/jpeg',
      thumbnailUrl: item.sample_url || item.preview_url,
      previewUrl: item.sample_url || item.file_url,
      originalFileUrl: item.file_url,
      postUrl: `https://safebooru.org/index.php?page=post&s=view&id=${item.id}`,
      externalSourceUrl,
      rating: 'safe',
      sourceMetadata: {
        score: item.score
      }
    };
  }
}
