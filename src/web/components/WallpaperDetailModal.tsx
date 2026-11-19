import React, { useState } from 'react';
import { X, Heart, Download, ExternalLink, Copy, Check, Eye, Palette, User, HardDrive, Maximize, Ratio } from 'lucide-react';
import { Wallpaper } from '@/shared/types/wallpaper';
import { Language, I18N } from '../types';

interface WallpaperDetailModalProps {
  wallpaper: Wallpaper | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (w: Wallpaper) => void;
  onTagClick?: (tag: string) => void;
  onOpenExternal: (url: string) => void;
  language: Language;
}

export const WallpaperDetailModal: React.FC<WallpaperDetailModalProps> = ({
  wallpaper,
  onClose,
  isFavorite,
  onToggleFavorite,
  onTagClick,
  onOpenExternal,
  language
}) => {
  if (!wallpaper) return null;

  const t = I18N[language];
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopyLink = () => {
    if (wallpaper.originalFileUrl) {
      navigator.clipboard.writeText(wallpaper.originalFileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadOriginal = () => {
    setDownloading(true);
    // Trigger direct download of the original file
    const a = document.createElement('a');
    a.href = wallpaper.originalFileUrl;
    a.download = `AniWalls_${wallpaper.provider}_${wallpaper.id}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 1500);
  };

  // Compute file size display
  let sizeText = 'N/A';
  if (wallpaper.fileSize) {
    sizeText = `${(wallpaper.fileSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Click outside to close backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card / Bottom Sheet on mobile */}
      <div className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto glass-panel rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col z-10 animate-slide-up">
        {/* Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-4 glass-panel border-b border-white/10">
          <div className="flex items-center space-x-2 truncate pr-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {wallpaper.provider}
            </span>
            <h2 className="text-sm sm:text-base font-bold text-white truncate">
              {wallpaper.title}
            </h2>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              onClick={() => onToggleFavorite(wallpaper)}
              className={`p-2 rounded-full glass-button transition-all ${
                isFavorite ? 'text-pink-400 bg-pink-500/20 border-pink-500/40' : 'text-gray-300'
              }`}
              title="Yêu thích"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full glass-button text-gray-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 sm:p-5 space-y-5">
          {/* Main High-Res Image Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-[#13131F] flex items-center justify-center border border-white/5">
            <img
              src={wallpaper.previewUrl || wallpaper.originalFileUrl}
              alt={wallpaper.title}
              className="w-full max-h-[55vh] object-contain rounded-2xl"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Download Original Button */}
            <button
              onClick={handleDownloadOriginal}
              className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Đang mở link...' : t.downloadOriginal}</span>
            </button>

            {/* Copy Direct URL Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center space-x-2 py-3 px-4 rounded-xl glass-button text-gray-200 hover:text-white font-medium text-xs sm:text-sm active:scale-[0.98] transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t.copied : t.directUrl}</span>
            </button>
          </div>

          {/* Source Links */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onOpenExternal(wallpaper.postUrl)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-gray-300 hover:text-white"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.sourcePost} ({wallpaper.provider})</span>
            </button>

            {(wallpaper.artistUrl || wallpaper.externalSourceUrl) && (
              <button
                onClick={() => onOpenExternal(wallpaper.artistUrl || wallpaper.externalSourceUrl!)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-purple-300 hover:text-white"
              >
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>{t.artistSource}</span>
              </button>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
            {/* Resolution */}
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Maximize className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{t.resolution}</p>
                <p className="text-xs font-bold text-gray-200">{wallpaper.resolution}</p>
              </div>
            </div>

            {/* Ratio */}
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Ratio className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{t.ratio}</p>
                <p className="text-xs font-bold text-gray-200">{wallpaper.aspectRatio}</p>
              </div>
            </div>

            {/* File Size */}
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{t.fileSize}</p>
                <p className="text-xs font-bold text-gray-200">{sizeText}</p>
              </div>
            </div>

            {/* Artist */}
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{t.artist}</p>
                <p className="text-xs font-bold text-gray-200 truncate max-w-[120px]">
                  {wallpaper.artistName || t.unspecified}
                </p>
              </div>
            </div>

            {/* Uploader */}
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{t.uploader}</p>
                <p className="text-xs font-bold text-gray-200 truncate max-w-[120px]">
                  {wallpaper.uploaderName || t.unspecified}
                </p>
              </div>
            </div>

            {/* Provider */}
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{t.providers}</p>
                <p className="text-xs font-bold text-gray-200 uppercase">{wallpaper.provider}</p>
              </div>
            </div>
          </div>

          {/* Dominant Color & Color Palette Swatches */}
          {(wallpaper.dominantColor || (wallpaper.colorPalette && wallpaper.colorPalette.length > 0)) && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold text-gray-400">Bảng màu:</span>
                {wallpaper.dominantColor && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(wallpaper.dominantColor!);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-white/10 hover:border-white/30 text-[11px] font-mono text-gray-200 transition-all"
                    title="Sao chép mã màu HEX"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: wallpaper.dominantColor }}
                    />
                    <span>{wallpaper.dominantColor}</span>
                  </button>
                )}
                {wallpaper.colorPalette && wallpaper.colorPalette.slice(0, 5).map((hex) => (
                  <button
                    key={hex}
                    onClick={() => {
                      navigator.clipboard.writeText(hex);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform"
                    style={{ backgroundColor: hex }}
                    title={`Bấm để sao chép ${hex}`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-gray-500">1-click copy HEX</span>
            </div>
          )}

          {/* Characters & Series Section */}
          {((wallpaper.characters && wallpaper.characters.length > 0) || (wallpaper.series && wallpaper.series.length > 0)) && (
            <div className="space-y-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-xs">
              {wallpaper.characters && wallpaper.characters.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[11px] text-pink-400 font-semibold mr-1">Nhân vật:</span>
                  {wallpaper.characters.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        if (onTagClick) onTagClick(c);
                        onClose();
                      }}
                      className="px-2.5 py-0.5 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-200 text-xs font-medium hover:bg-pink-500/25 transition-colors"
                    >
                      👤 {c}
                    </button>
                  ))}
                </div>
              )}
              {wallpaper.series && wallpaper.series.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[11px] text-purple-400 font-semibold mr-1">Tác phẩm / Anime:</span>
                  {wallpaper.series.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        if (onTagClick) onTagClick(s);
                        onClose();
                      }}
                      className="px-2.5 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-medium hover:bg-purple-500/25 transition-colors"
                    >
                      📺 {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags Section */}
          {wallpaper.tags && wallpaper.tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400">{t.tags}:</p>
              <div className="flex flex-wrap gap-1.5">
                {wallpaper.tags.slice(0, 15).map((tag, idx) => (
                  <button
                    key={`${tag}-${idx}`}
                    onClick={() => {
                      if (onTagClick) onTagClick(tag);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] glass-button text-gray-300 hover:text-white hover:border-purple-500/40 transition-all"
                  >
                    #{tag.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
