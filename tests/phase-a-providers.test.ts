import { describe, it, expect } from 'vitest';
import { ZerochanProvider } from '@/worker/providers/zerochan';
import { NekosApiProvider } from '@/worker/providers/nekosapi';
import { SearchEngine } from '@/worker/providers';
import { SearchQuerySchema, ProviderEnum } from '@/shared/schemas/search';

describe('Phase A: Zerochan & NekosAPI Providers & Rich Search Insights', () => {
  it('1. should validate all 9 providers in SearchQuerySchema and ProviderEnum', () => {
    const validProviders = [
      'wallhaven',
      'zerochan',
      'konachan',
      'safebooru',
      'yandere',
      'danbooru',
      'tbib',
      'nekos_best',
      'nekosapi'
    ];

    for (const p of validProviders) {
      expect(ProviderEnum.safeParse(p).success).toBe(true);
    }

    const parsed = SearchQuerySchema.parse({
      query: 'frieren',
      providers: ['zerochan', 'nekosapi'],
      color: 'purple'
    });

    expect(parsed.providers).toEqual(['zerochan', 'nekosapi']);
    expect(parsed.color).toBe('purple');
  });

  it('2. Zerochan provider should parse and normalize character, series and Pixiv source metadata', () => {
    const provider = new ZerochanProvider();
    const rawZerochanItem = {
      id: 4737210,
      width: '1920',
      height: '1080',
      thumbnail: 'https://s3.zerochan.net/240/10/44/4737210.avif',
      source: 'https://www.pixiv.net/en/artworks/151363748',
      tag: 'Genshin Impact',
      tags: [
        'Danica (Genshin Impact)',
        'Vesna (Genshin Impact)',
        'korusakku (Artist)',
        'Fanart'
      ]
    };

    // Access normalize via any for isolated unit testing
    const normalized = (provider as any).normalize(rawZerochanItem);

    expect(normalized.id).toBe('zerochan_4737210');
    expect(normalized.provider).toBe('zerochan');
    expect(normalized.width).toBe(1920);
    expect(normalized.height).toBe(1080);
    expect(normalized.resolution).toBe('1920x1080');
    expect(normalized.aspectRatio).toBe('16:9');
    expect(normalized.orientation).toBe('landscape');
    expect(normalized.characters).toContain('Danica');
    expect(normalized.characters).toContain('Vesna');
    expect(normalized.series).toContain('Genshin Impact');
    expect(normalized.externalSourceUrl).toBe('https://www.pixiv.net/en/artworks/151363748');
    expect(normalized.artistUrl).toBe('https://www.pixiv.net/en/artworks/151363748');
    expect(normalized.rating).toBe('safe');
  });

  it('3. Zerochan provider should clean unescaped outer braces and trailing HTML', () => {
    const provider = new ZerochanProvider();
    const malformedText = `{
{
    "items": [
        {
            "id": 12345,
            "width": 3840,
            "height": 2160,
            "tag": "Frieren"
        }
    ]
}<p id="browse-filters" aria-labelledby="sort-label">`;

    const items = (provider as any).parseZerochanJson(malformedText);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(12345);
    expect(items[0].tag).toBe('Frieren');
  });

  it('4. NekosAPI provider should convert RGB dominant colors & palettes to hex and normalize metadata', () => {
    const provider = new NekosApiProvider();
    const rawNekosItem = {
      id: 29813,
      url: 'https://cdn.nekosapi.com/nekos-api/images/original/sample.webp',
      rating: 'safe',
      color_dominant: [78, 127, 142],
      color_palette: [
        [236, 232, 233],
        [55, 107, 125]
      ],
      artist_name: 'Mika Pikazo',
      tags: ['girl', 'cyberpunk', 'neon'],
      source_url: 'https://twitter.com/sample'
    };

    const normalized = (provider as any).normalize(rawNekosItem);

    expect(normalized.id).toBe('nekosapi_29813');
    expect(normalized.provider).toBe('nekosapi');
    expect(normalized.dominantColor).toBe('#4E7F8E');
    expect(normalized.colorPalette).toEqual(['#ECE8E9', '#376B7D']);
    expect(normalized.artistName).toBe('Mika Pikazo');
    expect(normalized.mimeType).toBe('image/webp');
    expect(normalized.rating).toBe('safe');
  });

  it('5. SearchEngine should calculate rich search insights including top characters, series and provider counts', async () => {
    const engine = new SearchEngine();

    const mockWallpapers = [
      {
        id: 'wallhaven_1',
        provider: 'wallhaven' as const,
        providerPostId: '1',
        title: 'Furina Wallpaper',
        tags: ['furina', 'genshin_impact', 'blue'],
        characters: ['Furina'],
        series: ['Genshin Impact'],
        artistName: 'Mika Pikazo',
        width: 3840,
        height: 2160,
        resolution: '3840x2160',
        aspectRatio: '16:9',
        orientation: 'landscape' as const,
        thumbnailUrl: 'https://sample/thumb.jpg',
        previewUrl: 'https://sample/prev.jpg',
        originalFileUrl: 'https://sample/orig.jpg',
        postUrl: 'https://sample/post',
        dominantColor: '#3B82F6',
        rating: 'safe' as const,
        sourceMetadata: {}
      },
      {
        id: 'zerochan_2',
        provider: 'zerochan' as const,
        providerPostId: '2',
        title: 'Furina & Neuvillette',
        tags: ['furina', 'genshin_impact'],
        characters: ['Furina', 'Neuvillette'],
        series: ['Genshin Impact'],
        artistName: 'Ask',
        width: 7680,
        height: 4320,
        resolution: '7680x4320',
        aspectRatio: '16:9',
        orientation: 'landscape' as const,
        thumbnailUrl: 'https://sample/thumb2.jpg',
        previewUrl: 'https://sample/prev2.jpg',
        originalFileUrl: 'https://sample/orig2.jpg',
        postUrl: 'https://sample/post2',
        dominantColor: '#1E40AF',
        rating: 'safe' as const,
        sourceMetadata: {}
      }
    ];

    const insights = (engine as any).calculateInsights(mockWallpapers, { wallhaven: 1, zerochan: 1 });

    expect(insights.totalFound).toBe(2);
    expect(insights.maxResolution).toBe('7680x4320');
    expect(insights.has4kOrHigher).toBe(true);
    expect(insights.topCharacters[0]).toBe('Furina');
    expect(insights.topSeries[0]).toBe('Genshin Impact');
    expect(insights.providerCounts).toEqual({ wallhaven: 1, zerochan: 1 });
  });

  it('6. SearchEngine should filter wallpapers by dominant color accurately', () => {
    const engine = new SearchEngine();

    const blueWallpaper = {
      id: 'w_blue',
      tags: ['sky', 'water'],
      dominantColor: '#0055FF'
    } as any;

    const darkWallpaper = {
      id: 'w_black',
      tags: ['night', 'dark', 'monochrome'],
      dominantColor: '#121212'
    } as any;

    const redWallpaper = {
      id: 'w_red',
      tags: ['fire', 'flame'],
      dominantColor: '#FF2200'
    } as any;

    const list = [blueWallpaper, darkWallpaper, redWallpaper];

    const blueFiltered = (engine as any).filterByColor(list, 'blue');
    expect(blueFiltered).toHaveLength(1);
    expect(blueFiltered[0].id).toBe('w_blue');

    const blackFiltered = (engine as any).filterByColor(list, 'black');
    expect(blackFiltered).toHaveLength(1);
    expect(blackFiltered[0].id).toBe('w_black');
  });
});
