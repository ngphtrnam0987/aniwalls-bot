import { ReverseSearchResult, ReverseSearchItem, ConfidenceLabel } from '@/shared/types/api';

interface SauceNaoResponse {
  header: {
    status: number;
    results_returned: number;
    message?: string;
    short_remaining?: number;
    long_remaining?: number;
  };
  results?: Array<{
    header: {
      similarity: string;
      thumbnail: string;
      index_name: string;
    };
    data: {
      title?: string;
      source?: string;
      ext_urls?: string[];
      member_name?: string;
      author_name?: string;
      author_url?: string;
      creator?: string;
      material?: string;
      characters?: string;
    };
  }>;
}

export class SauceNaoService {
  constructor(private apiKey?: string) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Determine confidence level based on similarity percentage.
   */
  private getConfidence(similarity: number): ConfidenceLabel {
    if (similarity >= 80) return 'high';
    if (similarity >= 60) return 'medium';
    return 'low';
  }

  /**
   * Search artwork source using an accessible image URL.
   */
  async searchByImageUrl(imageUrl: string): Promise<ReverseSearchResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        provider: 'saucenao',
        results: [],
        message: 'Tính năng tìm nguồn ảnh bằng SauceNAO chưa được cấu hình API Key trên máy chủ.'
      };
    }

    try {
      const url = new URL('https://saucenao.com/search.php');
      url.searchParams.set('db', '999');
      url.searchParams.set('output_type', '2');
      url.searchParams.set('numres', '5');
      url.searchParams.set('api_key', this.apiKey!);
      url.searchParams.set('url', imageUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return this.parseResponse(res);
    } catch (err: any) {
      console.error('SauceNAO URL search error:', err);
      return {
        success: false,
        configured: true,
        provider: 'saucenao',
        results: [],
        message: err?.name === 'AbortError' ? 'Hết thời gian chờ phản hồi từ SauceNAO (Timeout).' : 'Lỗi kết nối khi tìm kiếm ảnh.'
      };
    }
  }

  /**
   * Search artwork source by uploading image binary data.
   */
  async searchByImageBuffer(
    buffer: ArrayBuffer | Uint8Array,
    mimeType = 'image/jpeg'
  ): Promise<ReverseSearchResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        provider: 'saucenao',
        results: [],
        message: 'Tính năng tìm nguồn ảnh bằng SauceNAO chưa được cấu hình API Key trên máy chủ.'
      };
    }

    try {
      const blob = new Blob([buffer as any], { type: mimeType });
      const formData = new FormData();
      formData.append('file', blob, 'image.jpg');
      formData.append('output_type', '2');
      formData.append('numres', '5');
      formData.append('db', '999');
      formData.append('api_key', this.apiKey!);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch('https://saucenao.com/search.php', {
        method: 'POST',
        headers: {
          'User-Agent': 'AniWalls/1.0 (+https://github.com/ngphtrnam0987/aniwalls-bot)'
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return this.parseResponse(res);
    } catch (err: any) {
      console.error('SauceNAO buffer search error:', err);
      return {
        success: false,
        configured: true,
        provider: 'saucenao',
        results: [],
        message: err?.name === 'AbortError' ? 'Hết thời gian chờ phản hồi từ SauceNAO (Timeout).' : 'Lỗi kết nối khi gửi ảnh lên SauceNAO.'
      };
    }
  }

  private async parseResponse(res: Response): Promise<ReverseSearchResult> {
    if (!res.ok) {
      if (res.status === 429) {
        return {
          success: false,
          configured: true,
          provider: 'saucenao',
          results: [],
          message: 'Đã đạt giới hạn tìm kiếm ảnh (Rate limit) của SauceNAO. Vui lòng thử lại sau vài phút.'
        };
      }
      return {
        success: false,
        configured: true,
        provider: 'saucenao',
        results: [],
        message: `Lỗi kết nối đến máy chủ SauceNAO (HTTP ${res.status}).`
      };
    }

    const json = (await res.json()) as SauceNaoResponse;

    if (json.header.status < 0) {
      return {
        success: false,
        configured: true,
        provider: 'saucenao',
        results: [],
        message: json.header.message || 'SauceNAO trả về mã lỗi không xác định.'
      };
    }

    if (!json.results || json.results.length === 0) {
      return {
        success: true,
        configured: true,
        provider: 'saucenao',
        results: [],
        message: 'Không tìm thấy kết quả phù hợp trên cơ sở dữ liệu ảnh.'
      };
    }

    const parsedResults: ReverseSearchItem[] = json.results.map((r) => {
      const similarity = parseFloat(r.header.similarity);
      const data = r.data;
      const authorName = data.author_name || data.member_name || data.creator;
      const sourceUrl = (data.ext_urls && data.ext_urls[0]) || data.source;

      return {
        similarity,
        confidenceLabel: this.getConfidence(similarity),
        title: data.title || data.material,
        series: data.material,
        character: data.characters,
        authorName: authorName,
        authorUrl: data.author_url,
        sourceUrl,
        thumbnailUrl: r.header.thumbnail,
        material: data.material,
        externalUrls: data.ext_urls || []
      };
    });

    return {
      success: true,
      configured: true,
      provider: 'saucenao',
      results: parsedResults,
      quotaRemaining: json.header.short_remaining
    };
  }

  /**
   * Helper to extract best keyword query to find higher resolution wallpapers on Wallhaven
   */
  extractHighResQuery(item: ReverseSearchItem): string | null {
    if (item.series && item.series.trim()) {
      return item.series.trim();
    }
    if (item.title && item.title.trim()) {
      return item.title.trim();
    }
    if (item.character && item.character.trim()) {
      return item.character.trim();
    }
    if (item.authorName && item.authorName.trim()) {
      return item.authorName.trim();
    }
    return null;
  }
}
