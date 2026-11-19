import React, { useState } from 'react';
import { Heart, Download, Maximize2 } from 'lucide-react';
import { Wallpaper } from '@/shared/types/wallpaper';

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  isFavorite: boolean;
  onToggleFavorite: (wallpaper: Wallpaper) => void;
  onSelect: (wallpaper: Wallpaper) => void;
}

export const WallpaperCard: React.FC<WallpaperCardProps> = ({
  wallpaper,
  isFavorite,
  onToggleFavorite,
  onSelect
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Compute resolution badge label
  let resBadge = 'HD';
  let resColor = 'bg-gray-800/80 text-gray-300 border-gray-700';
  const maxDim = Math.max(wallpaper.width, wallpaper.height);

  if (maxDim >= 7680 || (wallpaper.width >= 7680 && wallpaper.height >= 4320)) {
    resBadge = '8K UHD';
    resColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  } else if (maxDim >= 3840 || (wallpaper.width >= 3840 && wallpaper.height >= 2160)) {
    resBadge = '4K UHD';
    resColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  } else if (maxDim >= 2560) {
    resBadge = '2K QHD';
    resColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  } else if (maxDim >= 1920) {
    resBadge = '1080p';
    resColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }

  // Provider badge color
  let providerColor = 'text-gray-400';
  if (wallpaper.provider === 'wallhaven') providerColor = 'text-green-400';
  if (wallpaper.provider === 'konachan') providerColor = 'text-orange-400';
  if (wallpaper.provider === 'safebooru') providerColor = 'text-sky-400';

  return (
    <div
      onClick={() => onSelect(wallpaper)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl glass-card transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-purple-900/10 mb-4 break-inside-avoid"
    >
      {/* Aspect Ratio Box / Image Container */}
      <div className="relative w-full overflow-hidden bg-[#13131F]">
        {!imageLoaded && (
          <div
            className="w-full skeleton-shimmer"
            style={{
              paddingTop: `${Math.min(180, Math.max(56, (wallpaper.height / wallpaper.width) * 100))}%`
            }}
          />
        )}

        <img
          src={wallpaper.thumbnailUrl || wallpaper.previewUrl}
          alt={wallpaper.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageLoaded(true)}
          className={`w-full object-cover transition-all duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
          }`}
          style={{
            maxHeight: '480px'
          }}
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border ${resColor}`}>
            {resBadge}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(wallpaper);
            }}
            className={`pointer-events-auto p-1.5 rounded-full backdrop-blur-md border transition-all ${
              isFavorite
                ? 'bg-pink-500/80 border-pink-400 text-white shadow-lg shadow-pink-500/40 scale-105'
                : 'bg-black/40 border-white/10 text-white/80 hover:text-white hover:bg-black/60'
            }`}
            title="Yêu thích"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Metadata Overlay on Hover/Touch */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-6 flex flex-col justify-end opacity-90 transition-opacity">
          <p className="text-xs font-bold text-white truncate drop-shadow-sm">
            {wallpaper.title}
          </p>
          <div className="flex items-center justify-between text-[10px] text-gray-300 mt-0.5">
            <span className={`font-semibold uppercase tracking-wider ${providerColor}`}>
              {wallpaper.provider}
            </span>
            <span className="text-gray-400">
              {wallpaper.resolution}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
