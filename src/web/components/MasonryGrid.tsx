import React from 'react';
import { Wallpaper } from '@/shared/types/wallpaper';
import { WallpaperCard } from './WallpaperCard';

interface MasonryGridProps {
  wallpapers: Wallpaper[];
  favoriteIds: Set<string>;
  onToggleFavorite: (wallpaper: Wallpaper) => void;
  onSelect: (wallpaper: Wallpaper) => void;
  loading?: boolean;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  wallpapers,
  favoriteIds,
  onToggleFavorite,
  onSelect,
  loading
}) => {
  return (
    <div className="w-full">
      {/* CSS Columns Masonry */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3.5 space-y-3.5">
        {wallpapers.map((wallpaper) => (
          <WallpaperCard
            key={wallpaper.id}
            wallpaper={wallpaper}
            isFavorite={favoriteIds.has(wallpaper.id)}
            onToggleFavorite={onToggleFavorite}
            onSelect={onSelect}
          />
        ))}

        {/* Skeleton Shimmer Loaders */}
        {loading && (
          <>
            {[140, 220, 180, 260, 160, 200].map((h, idx) => (
              <div
                key={`skel-${idx}`}
                className="w-full rounded-2xl overflow-hidden glass-card mb-4 break-inside-avoid skeleton-shimmer"
                style={{ height: `${h}px` }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
