import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SauceNaoService } from '../src/worker/services/saucenao-service';

describe('SauceNAO Reverse Search Provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should report not configured if API key is missing', async () => {
    const service = new SauceNaoService();
    expect(service.isConfigured()).toBe(false);

    const res = await service.searchByImageUrl('https://example.com/test.jpg');
    expect(res.success).toBe(false);
    expect(res.configured).toBe(false);
    expect(res.results).toHaveLength(0);
  });

  it('2. should correctly normalize real SauceNAO JSON format and assign confidence levels', async () => {
    const mockResponse = {
      header: {
        status: 0,
        results_returned: 1,
        short_remaining: 5
      },
      results: [
        {
          header: {
            similarity: '94.28',
            thumbnail: 'https://img1.saucenao.com/thumb/123.jpg',
            index_name: 'Pixiv'
          },
          data: {
            title: 'Starry Sky Landscape',
            material: 'Original Work',
            characters: '',
            author_name: 'ArtistName123',
            author_url: 'https://www.pixiv.net/users/99999',
            ext_urls: ['https://www.pixiv.net/artworks/123456']
          }
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    } as any);

    const service = new SauceNaoService('mock_api_key_123');
    expect(service.isConfigured()).toBe(true);

    const res = await service.searchByImageUrl('https://example.com/anime.jpg');
    expect(res.success).toBe(true);
    expect(res.provider).toBe('saucenao');
    expect(res.results).toHaveLength(1);

    const match = res.results[0];
    expect(match.similarity).toBe(94.28);
    expect(match.confidenceLabel).toBe('high');
    expect(match.title).toBe('Starry Sky Landscape');
    expect(match.series).toBe('Original Work');
    expect(match.authorName).toBe('ArtistName123');
    expect(match.sourceUrl).toBe('https://www.pixiv.net/artworks/123456');
    expect(match.authorUrl).toBe('https://www.pixiv.net/users/99999');
    expect(match.thumbnailUrl).toBe('https://img1.saucenao.com/thumb/123.jpg');

    // High res query extraction
    const hires = service.extractHighResQuery(match);
    expect(hires).toBe('Original Work');
  });

  it('3. should handle 429 rate limit error gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429
    } as any);

    const service = new SauceNaoService('mock_api_key_123');
    const res = await service.searchByImageUrl('https://example.com/test.jpg');

    expect(res.success).toBe(false);
    expect(res.message).toContain('giới hạn');
  });

  it('4. should support image buffer search with multipart form data', async () => {
    const mockResponse = {
      header: {
        status: 0,
        results_returned: 1
      },
      results: [
        {
          header: {
            similarity: '65.5',
            thumbnail: 'https://img.saucenao.com/t.jpg',
            index_name: 'Danbooru'
          },
          data: {
            title: 'Sample Artwork',
            material: 'Scenery',
            creator: 'Illustrator99'
          }
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    } as any);

    const service = new SauceNaoService('mock_key');
    const dummyBuffer = new Uint8Array([1, 2, 3, 4, 5]);

    const res = await service.searchByImageBuffer(dummyBuffer, 'image/jpeg');
    expect(res.success).toBe(true);
    expect(res.results[0].confidenceLabel).toBe('medium');
    expect(res.results[0].similarity).toBe(65.5);
    expect(res.results[0].authorName).toBe('Illustrator99');
  });
});
