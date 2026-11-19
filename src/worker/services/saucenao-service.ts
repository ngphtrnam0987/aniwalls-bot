import { ReverseSearchResult } from '@/shared/types/api';

interface SauceNaoResponse {
  header: {
    status: number;
    results_returned: number;
    message?: string;
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

  async searchByImageUrl(imageUrl: string): Promise<ReverseSearchResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        configured: false,
        results: [],
        message: 'Tính năng tìm nguồn ảnh bằng SauceNAO chưa được cấu hình API Key trên máy chủ. Bạn vẫn có thể tìm kiếm theo từ khóa hoặc xem các hình nền có sẵn.'
      };
    }

    try {
      const url = new URL('https://saucenao.com/search.php');
      url.searchParams.set('db', '999');
      url.searchParams.set('output_type', '2');
      url.searchParams.set('numres', '3');
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

      if (!res.ok) {
        if (res.status === 429) {
          return {
            success: false,
            configured: true,
            results: [],
            message: 'Đã đạt giới hạn tìm kiếm ảnh (Rate limit) của SauceNAO. Vui lòng thử lại sau vài phút.'
          };
        }
        return {
          success: false,
          configured: true,
          results: [],
          message: `Lỗi kết nối đến SauceNAO (HTTP ${res.status}).`
        };
      }

      const json = await res.json() as SauceNaoResponse;
      if (!json.results || json.results.length === 0) {
        return {
          success: true,
          configured: true,
          results: [],
          message: 'Không tìm thấy kết quả phù hợp trên cơ sở dữ liệu ảnh.'
        };
      }

      const parsedResults = json.results.map((r) => {
        const similarity = parseFloat(r.header.similarity);
        const data = r.data;
        const authorName = data.author_name || data.member_name || data.creator;
        const sourceUrl = (data.ext_urls && data.ext_urls[0]) || data.source;

        return {
          similarity,
          title: data.title || data.material,
          authorName: authorName,
          authorUrl: data.author_url,
          sourceUrl,
          thumbnailUrl: r.header.thumbnail,
          material: data.material
        };
      });

      return {
        success: true,
        configured: true,
        results: parsedResults
      };
    } catch (err: any) {
      console.error('SauceNAO search error:', err);
      return {
        success: false,
        configured: true,
        results: [],
        message: err?.name === 'AbortError' ? 'Hết thời gian chờ phản hồi từ máy chủ nhận dạng ảnh.' : 'Lỗi kết nối khi tìm kiếm ảnh.'
      };
    }
  }
}
