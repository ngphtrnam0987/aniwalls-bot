import React, { useState } from 'react';
import { Heart, Sparkles, Filter } from 'lucide-react';
import { Wallpaper, ProviderName } from '@/shared/types/wallpaper';
import { MasonryGrid } from '../components/MasonryGrid';
import { Language, I18N } from '../types';

interface FavoritesProps {
  favorites: Wallpaper[];
  favoriteIds: Set<string>;
  onToggleFavorite: (w: Wallpaper) => void;
  onSelectWallpaper: (w: Wallpaper) => void;
  onNavigateToHome: () => void;
  language: Language;
}

export const Favorites: React.FC<FavoritesProps> = ({
  favorites,
  favoriteIds,
  onToggleFavorite,
  onSelectWallpaper,
  onNavigateToHome,
  language
}) => {
  const t = I18N[language];
  const [selectedProvider, setSelectedProvider] = useState<ProviderName | 'all'>('all');

  const filtered = selectedProvider === 'all'
    ? favorites
    : favorites.filter((w) => w.provider === selectedProvider);

  return (
    <div className="space-y-4 pb-24 px-2">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <Heart className="w-5 h-5 text-pink-500 fill-current" />
          <h1 className="text-lg font-bold text-white">
            {t.favorites}{' '}
            <span className="text-xs text-gray-400 font-normal">
              ({favorites.length})
            </span>
          </h1>
        </div>

        {/* Source Filter */}
        {favorites.length > 0 && (
          <div className="flex items-center space-x-1 glass-card p-1 rounded-xl">
            {(['all', 'wallhaven', 'konachan', 'safebooru'] as const).map((prov) => (
              <button
                key={prov}
                onClick={() => setSelectedProvider(prov)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold uppercase transition-all ${
                  selectedProvider === prov
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {prov}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Favorites Masonry Grid */}
      {filtered.length > 0 ? (
        <MasonryGrid
          wallpapers={filtered}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          onSelect={onSelectWallpaper}
        />
      ) : (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto text-pink-400">
            <Heart className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-gray-200">{t.emptyFavorites}</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {t.emptyFavoritesSub}
            </p>
          </div>
          <button
            onClick={onNavigateToHome}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-xs font-bold shadow-lg shadow-purple-600/30 hover:opacity-95"
          >
            {t.explore} ngay
          </button>
        </div>
      )}
    </div>
  );
};
