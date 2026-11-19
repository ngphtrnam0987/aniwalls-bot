import { Wallpaper, SearchFilters, SearchResult, ProviderName, SearchInsight } from '@/shared/types/wallpaper';
import { WallpaperProvider, ProviderResult } from './base';
import { WallhavenProvider } from './wallhaven';
import { KonachanProvider } from './konachan';
import { SafebooruProvider } from './safebooru';
import { YandereProvider } from './yandere';
import { DanbooruProvider } from './danbooru';
import { TBIBProvider } from './tbib';
import { NekosBestProvider } from './nekos-best';
import { ZerochanProvider } from './zerochan';
import { NekosApiProvider } from './nekosapi';

const ALL_PROVIDERS: ProviderName[] = [
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

/**
 * Timeout helper to enforce a maximum latency budget per provider
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

export class SearchEngine {
  private providers: Map<ProviderName, WallpaperProvider> = new Map();

  constructor(options?: { wallhavenApiKey?: string }) {
    this.providers.set('wallhaven', new WallhavenProvider(options?.wallhavenApiKey));
    this.providers.set('zerochan', new ZerochanProvider());
    this.providers.set('konachan', new KonachanProvider());
    this.providers.set('safebooru', new SafebooruProvider());
    this.providers.set('yandere', new YandereProvider());
    this.providers.set('danbooru', new DanbooruProvider());
    this.providers.set('tbib', new TBIBProvider());
    this.providers.set('nekos_best', new NekosBestProvider());
    this.providers.set('nekosapi', new NekosApiProvider());
  }

  async search(filters: SearchFilters): Promise<SearchResult> {
    const startTime = Date.now();
    const activeProviders = (filters.providers && filters.providers.length > 0)
      ? filters.providers
      : ALL_PROVIDERS;

    const targetProviders = activeProviders
      .map((p) => this.providers.get(p))
      .filter((p): p is WallpaperProvider => Boolean(p));

    // Request from providers in parallel with timeout budget (2500ms max per provider)
    const emptyResult: ProviderResult = { wallpapers: [], hasMore: false };
    const results = await Promise.allSettled(
      targetProviders.map((p) => withTimeout(p.search(filters), 2500, emptyResult))
    );

    const providerWallpapers: Wallpaper[][] = [];
    const usedProviderNames: ProviderName[] = [];
    const providerCounts: Record<string, number> = {};
    let hasMoreOverall = false;

    results.forEach((res, index) => {
      const pName = targetProviders[index].name;
      if (res.status === 'fulfilled' && res.value) {
        const list = res.value.wallpapers;
        if (list.length > 0) {
          providerWallpapers.push(list);
          usedProviderNames.push(pName);
          providerCounts[pName] = list.length;
        }
        if (res.value.hasMore) {
          hasMoreOverall = true;
        }
      } else {
        console.warn(`Provider ${pName} failed:`, res.status === 'rejected' ? res.reason : 'timeout');
      }
    });

    // Interleave & deduplicate results
    let merged = this.interleaveAndDeduplicate(providerWallpapers, filters.sort);

    // Filter by dominant color if requested
    if (filters.color && filters.color !== 'all') {
      merged = this.filterByColor(merged, filters.color);
    }

    // Apply sorting if needed
    if (filters.sort === 'resolution') {
      merged.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } else if (filters.sort === 'random') {
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]];
      }
    }

    // Calculate Search Insights for rich metadata density
    const insights = this.calculateInsights(merged, providerCounts);

    const limit = filters.limit || 20;
    const paginated = merged.slice(0, limit);

    return {
      wallpapers: paginated,
      page: filters.page || 1,
      hasMore: hasMoreOverall || merged.length > limit,
      totalEstimate: merged.length,
      query: filters.query || '',
      providersUsed: usedProviderNames,
      executionTimeMs: Date.now() - startTime,
      insights
    };
  }

  async getById(id: string): Promise<Wallpaper | null> {
    for (const provider of this.providers.values()) {
      if (id.startsWith(provider.name)) {
        return provider.getById(id);
      }
    }
    return null;
  }

  private filterByColor(wallpapers: Wallpaper[], color: string): Wallpaper[] {
    const c = color.toLowerCase();
    return wallpapers.filter((w) => {
      // Check dominantColor if available
      if (w.dominantColor) {
        const hex = w.dominantColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.substring(4, 6), 16) || 0;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        if (c === 'black') return brightness < 60;
        if (c === 'white') return brightness > 200;
        if (c === 'red') return r > g + 40 && r > b + 40;
        if (c === 'blue') return b > r + 30 && b > g + 20;
        if (c === 'purple') return r > 100 && b > 100 && g < Math.min(r, b);
        if (c === 'pink') return r > 180 && b > 140 && g < 180;
        if (c === 'green') return g > r + 20 && g > b + 20;
        if (c === 'yellow') return r > 180 && g > 180 && b < 120;
      }

      // Check tags
      const tagStr = (w.tags || []).join(' ').toLowerCase();
      if (c === 'black') return tagStr.includes('black') || tagStr.includes('dark') || tagStr.includes('monochrome') || tagStr.includes('night');
      if (c === 'purple') return tagStr.includes('purple') || tagStr.includes('violet') || tagStr.includes('neon') || tagStr.includes('cyberpunk');
      if (c === 'blue') return tagStr.includes('blue') || tagStr.includes('sky') || tagStr.includes('ocean') || tagStr.includes('water');
      if (c === 'pink') return tagStr.includes('pink') || tagStr.includes('sakura') || tagStr.includes('cherry_blossom');
      if (c === 'green') return tagStr.includes('green') || tagStr.includes('forest') || tagStr.includes('nature');
      if (c === 'red') return tagStr.includes('red') || tagStr.includes('crimson') || tagStr.includes('fire');
      if (c === 'white') return tagStr.includes('white') || tagStr.includes('snow') || tagStr.includes('bright');
      if (c === 'yellow') return tagStr.includes('yellow') || tagStr.includes('golden') || tagStr.includes('sun');

      return true;
    });
  }

  private calculateInsights(wallpapers: Wallpaper[], providerCounts: Record<string, number>): SearchInsight {
    const characterMap: Record<string, number> = {};
    const seriesMap: Record<string, number> = {};
    const artistMap: Record<string, number> = {};
    let maxArea = 0;
    let maxResolution = '1920x1080';
    let has4kOrHigher = false;

    for (const w of wallpapers) {
      const area = w.width * w.height;
      if (area > maxArea) {
        maxArea = area;
        maxResolution = w.resolution;
      }
      if (w.width >= 3840 || w.height >= 3840) {
        has4kOrHigher = true;
      }

      for (const char of w.characters || []) {
        const clean = char.trim();
        if (clean && clean.length > 1) {
          characterMap[clean] = (characterMap[clean] || 0) + 1;
        }
      }

      for (const s of w.series || []) {
        const clean = s.trim();
        if (clean && clean.length > 1) {
          seriesMap[clean] = (seriesMap[clean] || 0) + 1;
        }
      }

      if (w.artistName && w.artistName !== 'Chưa xác định') {
        artistMap[w.artistName] = (artistMap[w.artistName] || 0) + 1;
      }
    }

    const topCharacters = Object.entries(characterMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    const topSeries = Object.entries(seriesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    const topArtists = Object.entries(artistMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    return {
      totalFound: wallpapers.length,
      providerCounts,
      topCharacters,
      topSeries,
      topArtists,
      maxResolution,
      has4kOrHigher
    };
  }

  private interleaveAndDeduplicate(groups: Wallpaper[][], sort?: string): Wallpaper[] {
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenSources = new Set<string>();
    const result: Wallpaper[] = [];

    const maxLen = Math.max(0, ...groups.map((g) => g.length));

    for (let i = 0; i < maxLen; i++) {
      for (const group of groups) {
        if (i < group.length) {
          const item = group[i];
          if (seenIds.has(item.id)) continue;
          if (item.originalFileUrl && seenUrls.has(item.originalFileUrl)) continue;
          if (item.externalSourceUrl && seenSources.has(item.externalSourceUrl)) continue;

          seenIds.add(item.id);
          if (item.originalFileUrl) seenUrls.add(item.originalFileUrl);
          if (item.externalSourceUrl) seenSources.add(item.externalSourceUrl);
          result.push(item);
        }
      }
    }

    return result;
  }
}
