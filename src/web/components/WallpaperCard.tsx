import React, { useState } from 'react';
import { Heart, Download, ExternalLink, Maximize2, Ratio, HardDrive, Palette, Film, User } from 'lucide-react';
import { Wallpaper } from '@/shared/types/wallpaper';

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  isFavorite: boolean;
  onToggleFavorite: (wallpaper: Wallpaper) => void;
  onSelect: (wallpaper: Wallpaper) => void;
  viewMode?: 'masonry' | 'detailed';
}

export const WallpaperCard: React.FC<WallpaperCardProps> = ({
  wallpaper,
  isFavorite,
  onToggleFavorite,
  onSelect,
  viewMode = 'masonry'
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Compute resolution badge label & style
  let resBadge = 'HD';
  let resColor = 'bg-gray-800/80 text-gray-300 border-gray-700';
  const maxDim = Math.max(wallpaper.width, wallpaper.height);

  if (maxDim >= 7680 || (wallpaper.width >= 7680 && wallpaper.height >= 4320)) {
    resBadge = '8K UHD';
    resColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/20';
  } else if (maxDim >= 3840 || (wallpaper.width >= 3840 && wallpaper.height >= 2160)) {
    resBadge = '4K UHD';
    resColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/20';
  } else if (maxDim >= 2560) {
    resBadge = '2K QHD';
    resColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  } else if (maxDim >= 1920) {
    resBadge = '1080p';
    resColor = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  }

  // Provider badge color
  let providerColor = 'text-gray-400';
  if (wallpaper.provider === 'wallhaven') providerColor = 'text-emerald-400';
  if (wallpaper.provider === 'zerochan') providerColor = 'text-indigo-400';
  if (wallpaper.provider === 'konachan') providerColor = 'text-amber-400';
  if (wallpaper.provider === 'safebooru') providerColor = 'text-sky-400';
  if (wallpaper.provider === 'yandere') providerColor = 'text-pink-400';
  if (wallpaper.provider === 'danbooru') providerColor = 'text-blue-400';
  if (wallpaper.provider === 'nekosapi') providerColor = 'text-fuchsia-400';

  // Compute file size display
  let sizeText = '';
  if (wallpaper.fileSize) {
    sizeText = `${(wallpaper.fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Format extension
  let fileExt = 'JPG';
  if (wallpaper.mimeType) {
    fileExt = wallpaper.mimeType.replace('image/', '').toUpperCase();
  } else if (wallpaper.originalFileUrl) {
    const match = wallpaper.originalFileUrl.match(/\.(png|jpg|jpeg|webp|avif)/i);
    if (match) fileExt = match[1].toUpperCase();
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = wallpaper.originalFileUrl;
    a.download = `AniWalls_${wallpaper.provider}_${wallpaper.providerPostId}.${fileExt.toLowerCase()}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ==========================================
  // VIEW MODE: DETAILED LIST CARD
  // ==========================================
  if (viewMode === 'detailed') {
    return (
      <div
        onClick={() => onSelect(wallpaper)}
        className="group cursor-pointer rounded-2xl glass-card border border-white/10 p-3 sm:p-4 hover:border-purple-500/40 transition-all hover:shadow-xl hover:shadow-purple-950/20 mb-3 flex flex-col sm:flex-row gap-4 items-start"
      >
        {/* Thumbnail on Left */}
        <div className="relative w-full sm:w-48 sm:h-36 h-48 rounded-xl overflow-hidden bg-[#13131F] flex-shrink-0">
          <img
            src={wallpaper.thumbnailUrl || wallpaper.previewUrl}
            alt={wallpaper.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-2 left-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border ${resColor}`}>
              {resBadge}
            </span>
          </div>
        </div>

        {/* Specs on Right */}
        <div className="flex-1 w-full space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider ${providerColor}`}>
                  {wallpaper.provider}
                </span>
                {wallpaper.dominantColor && (
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/20"
                    style={{ backgroundColor: wallpaper.dominantColor }}
                    title={`Màu chủ đạo: ${wallpaper.dominantColor}`}
                  />
                )}
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                {wallpaper.title}
              </h3>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(wallpaper);
                }}
                className={`p-2 rounded-xl border transition-all ${
                  isFavorite
                    ? 'bg-pink-500/80 border-pink-400 text-white'
                    : 'glass-button text-gray-300 hover:text-white'
                }`}
                title="Yêu thích"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleDownload}
                className="p-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-500/30 transition-all"
                title="Tải ảnh gốc"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metadata Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-300 py-1">
            <div className="flex items-center space-x-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
              <span>{wallpaper.resolution}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Ratio className="w-3.5 h-3.5 text-cyan-400" />
              <span>{wallpaper.aspectRatio}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{fileExt} {sizeText ? `• ${sizeText}` : ''}</span>
            </div>
            {wallpaper.artistName && (
              <div className="flex items-center space-x-1.5 truncate">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span className="truncate">{wallpaper.artistName}</span>
              </div>
            )}
          </div>

          {/* Character & Series Badges */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {wallpaper.characters && wallpaper.characters.slice(0, 3).map((char) => (
              <span
                key={char}
                className="px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-300 border border-pink-500/20 text-[10px] font-medium"
              >
                👤 {char}
              </span>
            ))}
            {wallpaper.series && wallpaper.series.slice(0, 2).map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-medium"
              >
                <Film className="w-2.5 h-2.5 inline mr-1 text-purple-400" />
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW MODE: MASONRY PINTEREST CARD (DEFAULT)
  // ==========================================
  return (
    <div
      onClick={() => onSelect(wallpaper)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl glass-card transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-purple-900/15 mb-4 break-inside-avoid border border-white/5 hover:border-purple-500/30"
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
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center space-x-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border ${resColor}`}>
              {resBadge}
            </span>
            {fileExt && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md bg-black/50 text-gray-300 border border-white/10 uppercase">
                {fileExt}
              </span>
            )}
          </div>

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
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-7 flex flex-col justify-end opacity-95 transition-opacity">
          {/* Characters / Series Chips if available */}
          <div className="flex items-center space-x-1 overflow-hidden mb-1">
            {wallpaper.characters && wallpaper.characters.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 text-[9px] font-semibold truncate border border-pink-500/30">
                👤 {wallpaper.characters[0]}
              </span>
            )}
            {wallpaper.series && wallpaper.series.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-semibold truncate border border-purple-500/30">
                {wallpaper.series[0]}
              </span>
            )}
          </div>

          <p className="text-xs font-bold text-white truncate drop-shadow-sm">
            {wallpaper.title}
          </p>

          <div className="flex items-center justify-between text-[10px] text-gray-300 mt-1">
            <span className={`font-semibold uppercase tracking-wider ${providerColor}`}>
              {wallpaper.provider}
            </span>
            <div className="flex items-center space-x-1.5 text-gray-400">
              {sizeText && <span>{sizeText}</span>}
              <span>{wallpaper.resolution}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
