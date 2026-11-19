import { Wallpaper, SearchFilters, SearchResult, ProviderName } from '@/shared/types/wallpaper';
import { WallpaperProvider } from './base';
import { WallhavenProvider } from './wallhaven';
import { KonachanProvider } from './konachan';
import { SafebooruProvider } from './safebooru';
import { YandereProvider } from './yandere';
import { DanbooruProvider } from './danbooru';
import { TBIBProvider } from './tbib';
import { NekosBestProvider } from './nekos-best';

const ALL_PROVIDERS: ProviderName[] = [
  'wallhaven',
  'konachan',
  'safebooru',
  'yandere',
  'danbooru',
  'tbib',
  'nekos_best'
];

export class SearchEngine {
  private providers: Map<ProviderName, WallpaperProvider> = new Map();

  constructor(options?: { wallhavenApiKey?: string }) {
    this.providers.set('wallhaven', new WallhavenProvider(options?.wallhavenApiKey));
    this.providers.set('konachan', new KonachanProvider());
    this.providers.set('safebooru', new SafebooruProvider());
    this.providers.set('yandere', new YandereProvider());
    this.providers.set('danbooru', new DanbooruProvider());
    this.providers.set('tbib', new TBIBProvider());
    this.providers.set('nekos_best', new NekosBestProvider());
  }

  async search(filters: SearchFilters): Promise<SearchResult> {
    const startTime = Date.now();
    const activeProviders = (filters.providers && filters.providers.length > 0)
      ? filters.providers
      : ALL_PROVIDERS;

    const targetProviders = activeProviders
      .map((p) => this.providers.get(p))
      .filter((p): p is WallpaperProvider => Boolean(p));

    // Request from providers in parallel with individual error resilience
    const results = await Promise.allSettled(
      targetProviders.map((p) => p.search(filters))
    );

    const providerWallpapers: Wallpaper[][] = [];
    const usedProviderNames: ProviderName[] = [];
    let hasMoreOverall = false;

    results.forEach((res, index) => {
      const pName = targetProviders[index].name;
      if (res.status === 'fulfilled' && res.value) {
        if (res.value.wallpapers.length > 0) {
          providerWallpapers.push(res.value.wallpapers);
          usedProviderNames.push(pName);
        }
        if (res.value.hasMore) {
          hasMoreOverall = true;
        }
      } else {
        console.warn(`Provider ${pName} failed:`, res.status === 'rejected' ? res.reason : 'unknown');
      }
    });

    // Interleave & deduplicate results
    const merged = this.interleaveAndDeduplicate(providerWallpapers, filters.sort);

    // Apply sorting if needed
    if (filters.sort === 'resolution') {
      merged.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } else if (filters.sort === 'random') {
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]];
      }
    }

    const limit = filters.limit || 20;
    const paginated = merged.slice(0, limit);

    return {
      wallpapers: paginated,
      page: filters.page || 1,
      hasMore: hasMoreOverall || merged.length > limit,
      totalEstimate: merged.length,
      query: filters.query || '',
      providersUsed: usedProviderNames,
      executionTimeMs: Date.now() - startTime
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
