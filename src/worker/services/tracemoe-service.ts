import { SceneSearchResult, SceneSearchItem, ConfidenceLabel } from '@/shared/types/api';

interface TraceMoeResultItem {
  anilist: number | {
    id: number;
    idMal?: number;
    title: {
      native?: string;
      romaji?: string;
      english?: string;
    };
    synonyms?: string[];
    isAdult?: boolean;
  };
  filename: string;
  episode: number | string | null;
  from: number;
  to: number;
  similarity: number;
  video?: string;
  image: string;
}

interface TraceMoeResponse {
  frameCount?: number;
  error?: string;
  result?: TraceMoeResultItem[];
}

export class TraceMoeService {
  private baseUrl = 'https://api.trace.moe/search';

  private getConfidence(similarityPercentage: number): ConfidenceLabel {
    if (similarityPercentage >= 85) return 'high';
    if (similarityPercentage >= 75) return 'medium';
    return 'low';
  }

  formatTimestamp(seconds: number): string {
    const totalSecs = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const remainingSecs = totalSecs % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(remainingSecs)}`;
    }
    return `${pad(minutes)}:${pad(remainingSecs)}`;
  }

  /**
   * Identify anime scene using an accessible image URL
   */
  async searchByImageUrl(imageUrl: string): Promise<SceneSearchResult> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('cutBorders', '');
      url.searchParams.set('anilistInfo', '');
      url.searchParams.set('url', imageUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return this.parseResponse(res);
    } catch (err: any) {
      console.error('trace.moe URL search error:', err);
      return {
        success: false,
        results: [],
        message: err?.name === 'AbortError' ? 'Hết thời gian chờ phản hồi từ máy chủ trace.moe (Timeout).' : 'Lỗi kết nối khi nhận diện cảnh anime.'
      };
    }
  }

  /**
   * Identify anime scene by uploading image binary data
   */
  async searchByImageBuffer(
    buffer: ArrayBuffer | Uint8Array,
    mimeType = 'image/jpeg'
  ): Promise<SceneSearchResult> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('cutBorders', '');
      url.searchParams.set('anilistInfo', '');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        },
        body: buffer as any,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return this.parseResponse(res);
    } catch (err: any) {
      console.error('trace.moe buffer search error:', err);
      return {
        success: false,
        results: [],
        message: err?.name === 'AbortError' ? 'Hết thời gian chờ phản hồi từ máy chủ trace.moe (Timeout).' : 'Lỗi kết nối khi gửi ảnh nhận diện anime.'
      };
    }
  }

  private async parseResponse(res: Response): Promise<SceneSearchResult> {
    if (!res.ok) {
      if (res.status === 429) {
        return {
          success: false,
          results: [],
          message: 'Đã đạt giới hạn yêu cầu (Rate limit) của trace.moe. Vui lòng thử lại sau giây lát.'
        };
      }
      return {
        success: false,
        results: [],
        message: `Lỗi kết nối đến máy chủ trace.moe (HTTP ${res.status}).`
      };
    }

    const json = (await res.json()) as TraceMoeResponse;

    if (json.error) {
      return {
        success: false,
        results: [],
        message: `Lỗi nhận diện anime: ${json.error}`
      };
    }

    if (!json.result || json.result.length === 0) {
      return {
        success: true,
        results: [],
        message: 'Không tìm thấy cảnh phim anime trùng khớp.'
      };
    }

    const results: SceneSearchItem[] = json.result.slice(0, 5).map((r) => {
      // similarity is 0.0 - 1.0 -> convert to percentage
      const similarityPercentage = Math.round(r.similarity * 10000) / 100;

      let anilistId = 0;
      let titles = {
        romaji: 'Unknown Anime',
        english: undefined as string | undefined,
        native: undefined as string | undefined
      };
      let isAdult = false;

      if (typeof r.anilist === 'object' && r.anilist !== null) {
        anilistId = r.anilist.id;
        titles = {
          romaji: r.anilist.title?.romaji || 'Unknown Anime',
          english: r.anilist.title?.english,
          native: r.anilist.title?.native
        };
        isAdult = Boolean(r.anilist.isAdult);
      } else if (typeof r.anilist === 'number') {
        anilistId = r.anilist;
        titles.romaji = `AniList ID #${r.anilist}`;
      }

      return {
        animeTitle: titles,
        episode: r.episode ?? null,
        timestamp: r.from,
        timestampFormatted: this.formatTimestamp(r.from),
        similarity: similarityPercentage,
        confidenceLabel: this.getConfidence(similarityPercentage),
        videoPreviewUrl: r.video,
        imagePreviewUrl: r.image,
        anilistId,
        anilistUrl: `https://anilist.co/anime/${anilistId}`,
        isAdult
      };
    });

    return {
      success: true,
      results
    };
  }

  /**
   * Helper to extract best keyword query to find wallpapers for this anime
   */
  extractWallpaperQuery(item: SceneSearchItem): string {
    if (item.animeTitle.english && item.animeTitle.english.trim()) {
      return item.animeTitle.english.trim();
    }
    return item.animeTitle.romaji.trim();
  }
}
