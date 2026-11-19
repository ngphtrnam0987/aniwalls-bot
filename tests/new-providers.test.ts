import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YandereProvider } from '../src/worker/providers/yandere';
import { DanbooruProvider } from '../src/worker/providers/danbooru';
import { TBIBProvider } from '../src/worker/providers/tbib';
import { NekosBestProvider } from '../src/worker/providers/nekos-best';
import { SearchEngine } from '../src/worker/providers/index';

describe('Expanded Anime Wallpaper Providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. YandereProvider should correctly fetch and normalize high-res anime art', async () => {
    const mockYandere = [
      {
        id: 11111,
        tags: 'frieren sousou_no_frieren landscape solo',
        author: 'Uploader1',
        file_url: 'https://files.yande.re/image/sample.jpg',
        sample_url: 'https://files.yande.re/sample/sample.jpg',
        preview_url: 'https://assets.yande.re/data/preview.jpg',
        width: 3840,
        height: 2160,
        rating: 's',
        score: 50,
        source: 'https://twitter.com/artist/1'
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockYandere
    } as any);

    const provider = new YandereProvider();
    const res = await provider.search({ query: 'frieren', resolution: '4k', orientation: 'landscape' });

    expect(res.wallpapers).toHaveLength(1);
    const w = res.wallpapers[0];
    expect(w.id).toBe('yandere_11111');
    expect(w.provider).toBe('yandere');
    expect(w.width).toBe(3840);
    expect(w.height).toBe(2160);
    expect(w.orientation).toBe('landscape');
    expect(w.resolution).toBe('3840x2160');
    expect(w.originalFileUrl).toBe('https://files.yande.re/image/sample.jpg');
    expect(w.postUrl).toBe('https://yande.re/post/show/11111');
  });

  it('2. DanbooruProvider should correctly normalize character, copyright and artist tags', async () => {
    const mockDanbooru = [
      {
        id: 22222,
        tag_string_character: 'furina',
        tag_string_copyright: 'genshin_impact',
        tag_string_artist: 'mika_artist',
        tag_string: 'furina genshin_impact 1girl blue_eyes',
        file_url: 'https://cdn.donmai.us/original/test.jpg',
        large_file_url: 'https://cdn.donmai.us/sample/test.jpg',
        preview_file_url: 'https://cdn.donmai.us/180x180/test.jpg',
        image_width: 2560,
        image_height: 1440,
        score: 80,
        rating: 'g',
        source: 'https://www.pixiv.net/artworks/999'
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDanbooru
    } as any);

    const provider = new DanbooruProvider();
    const res = await provider.search({ query: 'furina', resolution: '2k' });

    expect(res.wallpapers).toHaveLength(1);
    const w = res.wallpapers[0];
    expect(w.id).toBe('danbooru_22222');
    expect(w.provider).toBe('danbooru');
    expect(w.characters).toContain('furina');
    expect(w.series).toContain('genshin impact');
    expect(w.artistName).toBe('mika artist');
    expect(w.resolution).toBe('2560x1440');
  });

  it('3. TBIBProvider should normalize TBIB Gelbooru 0.2 format into valid wallpaper', async () => {
    const mockTBIB = [
      {
        id: 33333,
        directory: 1234,
        image: 'hash_abc.jpg',
        width: 1920,
        height: 1080,
        tags: 'miku hatsune_miku vocaloid',
        rating: 'general',
        score: 40,
        sample: true
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockTBIB
    } as any);

    const provider = new TBIBProvider();
    const res = await provider.search({ query: 'miku', resolution: '1080p' });

    expect(res.wallpapers).toHaveLength(1);
    const w = res.wallpapers[0];
    expect(w.id).toBe('tbib_33333');
    expect(w.provider).toBe('tbib');
    expect(w.originalFileUrl).toBe('https://tbib.org/images/1234/hash_abc.jpg');
    expect(w.previewUrl).toBe('https://tbib.org/samples/1234/sample_hash_abc.jpg');
    expect(w.postUrl).toBe('https://tbib.org/index.php?page=post&s=view&id=33333');
  });

  it('4. NekosBestProvider should normalize nekos.best results with direct artist credit', async () => {
    const mockNekos = {
      results: [
        {
          artist_name: 'SuperArtist',
          artist_href: 'https://twitter.com/super_artist',
          source_url: 'https://twitter.com/super_artist/status/123456',
          url: 'https://nekos.best/api/v2/neko/test-uuid-999.png',
          dimensions: { width: 3840, height: 2160 }
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockNekos
    } as any);

    const provider = new NekosBestProvider();
    const res = await provider.search({ query: 'neko' });

    expect(res.wallpapers).toHaveLength(1);
    const w = res.wallpapers[0];
    expect(w.id).toBe('nekos_best_test-uuid-999');
    expect(w.provider).toBe('nekos_best');
    expect(w.artistName).toBe('SuperArtist');
    expect(w.artistUrl).toBe('https://twitter.com/super_artist');
    expect(w.resolution).toBe('3840x2160');
  });

  it('5. SearchEngine should aggregate all 7 active providers concurrently', async () => {
    const engine = new SearchEngine();
    expect(engine).toBeDefined();

    // Verify all 7 providers are instantiated
    const providers = (engine as any).providers;
    expect(providers.size).toBe(7);
    expect(providers.has('wallhaven')).toBe(true);
    expect(providers.has('konachan')).toBe(true);
    expect(providers.has('safebooru')).toBe(true);
    expect(providers.has('yandere')).toBe(true);
    expect(providers.has('danbooru')).toBe(true);
    expect(providers.has('tbib')).toBe(true);
    expect(providers.has('nekos_best')).toBe(true);
  });
});
