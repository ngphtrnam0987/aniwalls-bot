import React, { useState } from 'react';
import { Search, Sparkles, Smartphone, Monitor, Flame, Shuffle, ArrowRight } from 'lucide-react';
import { Wallpaper, OrientationFilter, ResolutionFilter } from '@/shared/types/wallpaper';
import { MasonryGrid } from '../components/MasonryGrid';
import { Language, I18N } from '../types';

interface HomeProps {
  onSearch: (query: string, orientation?: OrientationFilter, resolution?: ResolutionFilter) => void;
  recommendedWallpapers: Wallpaper[];
  favoriteIds: Set<string>;
  onToggleFavorite: (w: Wallpaper) => void;
  onSelectWallpaper: (w: Wallpaper) => void;
  loadingRecommended: boolean;
  onNavigateToExplore: () => void;
  language: Language;
}

export const Home: React.FC<HomeProps> = ({
  onSearch,
  recommendedWallpapers,
  favoriteIds,
  onToggleFavorite,
  onSelectWallpaper,
  loadingRecommended,
  onNavigateToExplore,
  language
}) => {
  const t = I18N[language];
  const [searchInput, setSearchInput] = useState('');

  const trendingTags = [
    { label: 'Furina', query: 'furina' },
    { label: 'Hatsune Miku', query: 'miku' },
    { label: 'Carlotta', query: 'carlotta' },
    { label: 'Frieren', query: 'frieren' },
    { label: 'Genshin Impact', query: 'genshin' },
    { label: 'WuWa', query: 'wuthering waves' },
    { label: 'Evangelion', query: 'evangelion' },
    { label: 'Cyberpunk', query: 'cyberpunk edgerunners' }
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Hero Search Section */}
      <div className="relative pt-2 pb-4 text-center space-y-4">
        {/* Glow backdrop effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Anime Wallpapers{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              4K & Ultra HD
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
            Hàng triệu hình nền anime đỉnh cao từ Wallhaven, Konachan & Safebooru.
          </p>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto px-2">
          <div className="relative flex items-center glass-panel rounded-2xl border border-white/10 shadow-xl overflow-hidden focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
            <Search className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full py-3.5 px-3 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-500"
            />
            <button
              type="submit"
              className="m-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs shadow-md shadow-purple-600/30 hover:opacity-90 active:scale-95 transition-all"
            >
              {t.explore}
            </button>
          </div>
        </form>

        {/* Trending Tags Pills */}
        <div className="flex items-center justify-center flex-wrap gap-1.5 max-w-xl mx-auto px-2">
          <span className="text-[11px] font-semibold text-gray-400 flex items-center mr-1">
            <Flame className="w-3.5 h-3.5 text-pink-500 mr-0.5" /> {t.trending}:
          </span>
          {trendingTags.map((tag) => (
            <button
              key={tag.query}
              onClick={() => onSearch(tag.query)}
              className="px-2.5 py-1 rounded-full text-xs glass-button text-gray-300 hover:text-white hover:border-purple-500/30 transition-all"
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-2">
        {/* 4K UHD */}
        <button
          onClick={() => onSearch('', undefined, '4k')}
          className="p-3.5 rounded-2xl glass-card flex flex-col items-center justify-center text-center space-y-1.5 hover:border-purple-500/40 hover:bg-white/[0.04] transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">4K Ultra HD</span>
          <span className="text-[10px] text-gray-400">Chuẩn 3840x2160</span>
        </button>

        {/* Mobile Portrait */}
        <button
          onClick={() => onSearch('', 'portrait')}
          className="p-3.5 rounded-2xl glass-card flex flex-col items-center justify-center text-center space-y-1.5 hover:border-cyan-500/40 hover:bg-white/[0.04] transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">Hình nền Điện thoại</span>
          <span className="text-[10px] text-gray-400">Tỷ lệ 9:16 dọc</span>
        </button>

        {/* Desktop Landscape */}
        <button
          onClick={() => onSearch('', 'landscape')}
          className="p-3.5 rounded-2xl glass-card flex flex-col items-center justify-center text-center space-y-1.5 hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
            <Monitor className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">Hình nền Máy tính</span>
          <span className="text-[10px] text-gray-400">Tỷ lệ 16:9 ngang</span>
        </button>

        {/* Random */}
        <button
          onClick={() => onSearch('', undefined, undefined)}
          className="p-3.5 rounded-2xl glass-card flex flex-col items-center justify-center text-center space-y-1.5 hover:border-pink-500/40 hover:bg-white/[0.04] transition-all group"
        >
          <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform">
            <Shuffle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">{t.random}</span>
          <span className="text-[10px] text-gray-400">Tuyển chọn ngẫu nhiên</span>
        </button>
      </div>

      {/* Recommended Section */}
      <div className="space-y-3 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t.recommended}
            </h2>
          </div>

          <button
            onClick={onNavigateToExplore}
            className="flex items-center space-x-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
          >
            <span>{t.explore}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recommended Masonry Grid */}
        <MasonryGrid
          wallpapers={recommendedWallpapers}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          onSelect={onSelectWallpaper}
          loading={loadingRecommended}
        />
      </div>
    </div>
  );
};
