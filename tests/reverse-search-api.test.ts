import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/worker/index';

describe('Phase 4 API Endpoints', () => {
  const mockEnv: any = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ meta: { changes: 1 } })
        })
      })
    },
    TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    TELEGRAM_WEBHOOK_SECRET: 'test_secret',
    SAUCENAO_API_KEY: 'test_saucenao_key',
    WALLHAVEN_API_KEY: 'test_wallhaven_key'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. GET /api/search-suggestions should return tags, resolutions and sample prompts', async () => {
    const mockCtx: any = { waitUntil: () => {}, passThroughOnException: () => {} };
    const res = await app.fetch(new Request('http://localhost/api/search-suggestions'), mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.popularTags).toContain('cyberpunk');
    expect(json.data.sampleSmartPrompts.length).toBeGreaterThan(0);
  });

  it('2. POST /api/smart-search should interpret query and return search results', async () => {
    // Mock Wallhaven response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: 'wall_123',
            url: 'https://wallhaven.cc/w/wall_123',
            path: 'https://w.wallhaven.cc/full/wall_123.jpg',
            thumbs: {
              large: 'https://th.wallhaven.cc/lg/wall_123.jpg',
              small: 'https://th.wallhaven.cc/sm/wall_123.jpg'
            },
            dimension_x: 3840,
            dimension_y: 2160,
            ratio: '1.78',
            category: 'anime',
            purity: 'sfw',
            file_size: 2048000,
            file_type: 'image/jpeg'
          }
        ],
        meta: {
          current_page: 1,
          last_page: 5,
          total: 100
        }
      })
    } as any);

    const req = new Request('http://localhost/api/smart-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'phong cảnh thành phố cyberpunk 4k cho máy tính'
      })
    });

    const mockCtx: any = { waitUntil: () => {}, passThroughOnException: () => {} };
    const res = await app.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.parsed.resolution).toBe('4k');
    expect(json.parsed.orientation).toBe('landscape');
    expect(json.wallpapers).toHaveLength(1);
    expect(json.wallpapers[0].width).toBe(3840);
  });

  it('3. POST /api/reverse-search should block internal SSRF IP addresses', async () => {
    const maliciousUrls = [
      'http://127.0.0.1:8080/secret.jpg',
      'http://localhost/admin.png',
      'http://169.254.169.254/latest/meta-data/',
      'http://192.168.1.1/router.jpg'
    ];

    for (const url of maliciousUrls) {
      const req = new Request('http://localhost/api/reverse-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url })
      });

      const mockCtx: any = { waitUntil: () => {}, passThroughOnException: () => {} };
      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error).toContain('chặn');
    }
  });

  it('4. POST /api/scene-search should block invalid protocols or local hostnames', async () => {
    const req = new Request('http://localhost/api/scene-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: 'file:///etc/passwd' })
    });

    const mockCtx: any = { waitUntil: () => {}, passThroughOnException: () => {} };
    const res = await app.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(400);
  });
});
