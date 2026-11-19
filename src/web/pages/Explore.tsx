import React, { useState, useEffect } from 'react';
import { Search, Loader2, Frown, X } from 'lucide-react';
import { Wallpaper, SearchFilters, OrientationFilter, ResolutionFilter, ProviderName, SortFilter } from '@/shared/types/wallpaper';
import { FilterBar } from '../components/FilterBar';
import { MasonryGrid } from '../components/MasonryGrid';
import { Language, I18N } from '../types';

interface ExploreProps {
  initialQuery?: string;
  initialOrientation?: OrientationFilter;
  initialResolution?: ResolutionFilter;
  favoriteIds: Set<string>;
  onToggleFavorite: (w: Wallpaper) => void;
  onSelectWallpaper: (w: Wallpaper) => void;
  onFetchWallpapers: (filters: SearchFilters) => Promise<{ wallpapers: Wallpaper[]; hasMore: boolean }>;
  language: Language;
}

export const Explore: React.FC<ExploreProps> = ({
  initialQuery = '',
  initialOrientation = 'all',
  initialResolution = 'all',
  favoriteIds,
  onToggleFavorite,
  onSelectWallpaper,
  onFetchWallpapers,
  language
}) => {
  const t = I18N[language];

  const [query, setQuery] = useState(initialQuery);
  const [orientation, setOrientation] = useState<OrientationFilter>(initialOrientation);
  const [resolution, setResolution] = useState<ResolutionFilter>(initialResolution);
  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>(['wallhaven', 'konachan', 'safebooru']);
  const [sort, setSort] = useState<SortFilter>('relevance');

  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Sync initial props
  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery);
    if (initialOrientation !== undefined) setOrientation(initialOrientation);
    if (initialResolution !== undefined) setResolution(initialResolution);
  }, [initialQuery, initialOrientation, initialResolution]);

  // Load first page whenever filters change
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      setPage(1);

      try {
        const res = await onFetchWallpapers({
          query: query.trim(),
          orientation,
          resolution,
          providers: selectedProviders,
          sort,
          page: 1,
          limit: 20
        });

        if (!isCancelled) {
          setWallpapers(res.wallpapers);
          setHasMore(res.hasMore);
        }
      } catch (err) {
        console.error('Failed to load explore wallpapers:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [query, orientation, resolution, selectedProviders, sort]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const res = await onFetchWallpapers({
        query: query.trim(),
        orientation,
        resolution,
        providers: selectedProviders,
        sort,
        page: nextPage,
        limit: 20
      });

      setWallpapers((prev) => [...prev, ...res.wallpapers]);
      setPage(nextPage);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('Failed to load more wallpapers:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleProvider = (p: ProviderName) => {
    setSelectedProviders((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((item) => item !== p);
      } else {
        return [...prev, p];
      }
    });
  };

  return (
    <div className="space-y-4 pb-24 px-2">
      {/* Sticky Search & Filter Header */}
      <div className="sticky top-14 z-30 pt-2 pb-1 glass-panel rounded-2xl p-3 border border-white/10 shadow-xl space-y-2">
        {/* Search bar */}
        <div className="relative flex items-center bg-[#13131F] rounded-xl border border-white/10 focus-within:border-purple-500/50">
          <Search className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full py-2.5 px-2.5 bg-transparent text-white text-xs sm:text-sm focus:outline-none placeholder:text-gray-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 mr-2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter controls */}
        <FilterBar
          orientation={orientation}
          onOrientationChange={setOrientation}
          resolution={resolution}
          onResolutionChange={setResolution}
          selectedProviders={selectedProviders}
          onToggleProvider={handleToggleProvider}
          sort={sort}
          onSortChange={setSort}
          language={language}
        />
      </div>

      {/* Main Wallpaper Grid */}
      <MasonryGrid
        wallpapers={wallpapers}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
        onSelect={onSelectWallpaper}
        loading={loading}
      />

      {/* Empty State */}
      {!loading && wallpapers.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-gray-400">
            <Frown className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-gray-200">{t.noResults}</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            {t.tryDifferentQuery}
          </p>
        </div>
      )}

      {/* Load More Button / Infinite Trigger */}
      {hasMore && wallpapers.length > 0 && !loading && (
        <div className="text-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 rounded-full glass-button text-xs font-semibold text-gray-200 hover:text-white hover:border-purple-500/40 inline-flex items-center space-x-2"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>{t.loading}</span>
              </>
            ) : (
              <span>{t.loadMore}</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
