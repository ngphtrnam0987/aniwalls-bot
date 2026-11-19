import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  Link as LinkIcon,
  Sparkles,
  Film,
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Play,
  Clock,
  Layers,
  User,
  Hash,
  DownloadCloud,
  Heart,
  Eye
} from 'lucide-react';
import { ApiClient } from '../services/api';
import { Language, I18N } from '../types';
import { ReverseSearchResult, SceneSearchResult, ReverseSearchItem, SceneSearchItem } from '@/shared/types/api';
import { Wallpaper } from '@/shared/types/wallpaper';

interface ImageSearchProps {
  language: Language;
  initData?: string;
  triggerHaptic?: () => void;
  onExploreQuery: (query: string) => void;
  onSelectWallpaper?: (w: Wallpaper) => void;
  onToggleFavorite?: (w: Wallpaper) => void;
  favoriteIds?: Set<string>;
}

type SearchMode = 'saucenao' | 'tracemoe';

interface ImageMeta {
  width?: number;
  height?: number;
  sizeFormatted?: string;
  aspectRatio?: string;
}

const SAMPLE_IMAGES = [
  {
    label: 'Sousou no Frieren (Artwork)',
    url: 'https://files.yande.re/sample/52fdcd6a06f3e54c7a372a063586a54c/yande.re%201272820%20sample%20ao_no_hako%20chouno_hina%20dress%20headphones%20kano_chinatsu%20kido_yumeka%20moriya_ayame%20pantyhose%20sweater%20tagme.jpg',
    mode: 'saucenao' as SearchMode
  },
  {
    label: 'Cyberpunk Scenery (Artwork)',
    url: 'https://w.wallhaven.cc/full/m3/wallhaven-m3z9y1.jpg',
    mode: 'saucenao' as SearchMode
  },
  {
    label: 'Kimetsu no Yaiba (Screenshot)',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200',
    mode: 'tracemoe' as SearchMode
  }
];

export const ImageSearch: React.FC<ImageSearchProps> = ({
  language,
  initData,
  triggerHaptic,
  onExploreQuery,
  onSelectWallpaper,
  onToggleFavorite,
  favoriteIds = new Set()
}) => {
  const t = I18N[language];

  const [mode, setMode] = useState<SearchMode>('saucenao');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sauceResults, setSauceResults] = useState<ReverseSearchItem[]>([]);
  const [sceneResults, setSceneResults] = useState<SceneSearchItem[]>([]);

  // Related Wallpapers Preview
  const [relatedWallpapers, setRelatedWallpapers] = useState<Wallpaper[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImageUrl('');
      setError(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        setImageMeta({
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeFormatted: formatFileSize(file.size),
          aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2) + ':1'
        });
      };
      img.src = url;

      triggerHaptic?.();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImageUrl('');
      setError(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        setImageMeta({
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeFormatted: formatFileSize(file.size),
          aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2) + ':1'
        });
      };
      img.src = url;

      triggerHaptic?.();
    }
  };

  const handleUrlChange = (val: string) => {
    setImageUrl(val);
    if (val.trim().startsWith('http')) {
      setSelectedFile(null);
      setPreviewUrl(val.trim());
      setError(null);

      const img = new Image();
      img.onload = () => {
        setImageMeta({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2) + ':1'
        });
      };
      img.src = val.trim();
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setImageUrl('');
    setPreviewUrl(null);
    setImageMeta(null);
    setSauceResults([]);
    setSceneResults([]);
    setRelatedWallpapers([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    triggerHaptic?.();
  };

  const handleSearch = async () => {
    if (!selectedFile && !imageUrl.trim()) {
      setError('Vui lòng chọn một file ảnh hoặc dán đường dẫn ảnh.');
      return;
    }

    setLoading(true);
    setError(null);
    setSauceResults([]);
    setSceneResults([]);
    setRelatedWallpapers([]);
    triggerHaptic?.();

    try {
      if (mode === 'saucenao') {
        let res: ReverseSearchResult;
        if (selectedFile) {
          res = await ApiClient.reverseSearchByFile(selectedFile, initData);
        } else {
          res = await ApiClient.reverseSearchByUrl(imageUrl.trim(), initData);
        }

        if (!res.success) {
          setError(res.message || 'Không thể tìm kiếm nguồn ảnh.');
        } else if (res.results.length === 0) {
          setError('Không tìm thấy kết quả phù hợp trên cơ sở dữ liệu ảnh.');
        } else {
          setSauceResults(res.results);
          // Auto load related wallpapers from top match
          const top = res.results[0];
          const query = top.series || top.title || top.character || top.authorName;
          if (query) {
            loadRelatedWallpapers(query);
          }
        }
      } else {
        let res: SceneSearchResult;
        if (selectedFile) {
          res = await ApiClient.sceneSearchByFile(selectedFile, initData);
        } else {
          res = await ApiClient.sceneSearchByUrl(imageUrl.trim(), initData);
        }

        if (!res.success) {
          setError(res.message || 'Không thể nhận diện cảnh phim anime.');
        } else if (res.results.length === 0) {
          setError('Không tìm thấy cảnh phim anime trùng khớp.');
        } else {
          setSceneResults(res.results);
          // Auto load related wallpapers
          const top = res.results[0];
          const query = top.animeTitle.english || top.animeTitle.romaji;
          if (query) {
            loadRelatedWallpapers(query);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedWallpapers = async (query: string) => {
    setLoadingRelated(true);
    try {
      const searchRes = await ApiClient.searchWallpapers({
        query: query.trim(),
        limit: 6,
        sort: 'relevance'
      }, initData);
      setRelatedWallpapers(searchRes.wallpapers || []);
    } catch (err) {
      console.warn('Could not load related wallpapers:', err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_IMAGES[0]) => {
    setMode(sample.mode);
    handleUrlChange(sample.url);
    triggerHaptic?.();
  };

  return (
    <div className="pb-28 pt-4 px-3 sm:px-4 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          {language === 'vi' ? 'Nhận Diện Ảnh & Nguồn Gốc Chi Tiết' : 'Deep Reverse Image Search'}
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          {language === 'vi'
            ? 'Xác minh họa sĩ minh họa, bài đăng gốc Pixiv/Twitter và nhận diện tập phim anime từ ảnh chụp màn hình'
            : 'Find original artist, Pixiv/Twitter posts and recognize anime episodes with exact timestamps'}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="glass-panel p-1.5 rounded-2xl flex border border-white/10 gap-1">
        <button
          onClick={() => {
            setMode('saucenao');
            triggerHaptic?.();
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm transition-all ${
            mode === 'saucenao'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-purple-300" />
          <span>{language === 'vi' ? 'Nguồn Tranh Vẽ (SauceNAO)' : 'Artwork Sauce (SauceNAO)'}</span>
        </button>

        <button
          onClick={() => {
            setMode('tracemoe');
            triggerHaptic?.();
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm transition-all ${
            mode === 'tracemoe'
              ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4 text-cyan-300" />
          <span>{language === 'vi' ? 'Cảnh Phim Anime (trace.moe)' : 'Anime Scene (trace.moe)'}</span>
        </button>
      </div>

      {/* Upload Zone & URL Input */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl shadow-black/40">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {previewUrl ? (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/60 group">
              <img
                src={previewUrl}
                alt="Selected preview"
                className="w-full max-h-80 object-contain mx-auto"
              />
              <button
                onClick={clearSelection}
                className="absolute top-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-medium rounded-full backdrop-blur-md border border-white/20 transition-all shadow-lg"
              >
                {language === 'vi' ? 'Đổi ảnh khác' : 'Change image'}
              </button>
            </div>

            {/* Inspector Pill Bar */}
            {imageMeta && (
              <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] text-gray-300 bg-white/5 py-2 px-3 rounded-xl border border-white/10">
                {imageMeta.width && imageMeta.height && (
                  <span className="font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md">
                    📐 {imageMeta.width} × {imageMeta.height} px
                  </span>
                )}
                {imageMeta.aspectRatio && (
                  <span className="font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md">
                    🖥 {imageMeta.aspectRatio}
                  </span>
                )}
                {imageMeta.sizeFormatted && (
                  <span className="font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">
                    💾 {imageMeta.sizeFormatted}
                  </span>
                )}
                <span className="text-gray-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {language === 'vi' ? 'Sẵn sàng phân tích' : 'Ready'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/20 hover:border-cyan-400/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.05]"
          >
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <UploadCloud className="w-7 h-7 text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-gray-200">
              {language === 'vi' ? 'Chạm để tải ảnh lên hoặc kéo thả vào đây' : 'Tap to upload or drag & drop'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG, WEBP (Tối đa 10MB)
            </p>
          </div>
        )}

        {/* Or Image URL */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <LinkIcon className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder={language === 'vi' ? 'Hoặc dán URL hình ảnh trực tiếp...' : 'Or paste direct image URL...'}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSearch}
          disabled={loading || (!selectedFile && !imageUrl.trim())}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{language === 'vi' ? 'Đang phân tích hình ảnh sâu...' : 'Analyzing deep metadata...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {mode === 'saucenao'
                  ? (language === 'vi' ? 'Tìm Nguồn Tranh Vẽ Chi Tiết' : 'Analyze Artwork Source')
                  : (language === 'vi' ? 'Nhận Diện Tập Phim Anime' : 'Recognize Anime Scene')}
              </span>
            </>
          )}
        </button>

        {/* Quick Sample Try */}
        {!previewUrl && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-[11px] font-semibold text-gray-400 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              {language === 'vi' ? 'Ảnh mẫu thử nhanh:' : 'Quick sample test:'}
            </p>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              {SAMPLE_IMAGES.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSample(sample)}
                  className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-gray-300 hover:text-white whitespace-nowrap transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-panel p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      {/* Results: SauceNAO */}
      {sauceResults.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {language === 'vi' ? `Tìm thấy ${sauceResults.length} kết quả nguồn tranh` : `Found ${sauceResults.length} artwork matches`}
            </h2>
          </div>

          <div className="space-y-4">
            {sauceResults.map((r, idx) => {
              const confidenceColor =
                r.confidenceLabel === 'high'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : r.confidenceLabel === 'medium'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

              const barPercentage = Math.min(100, Math.max(0, r.similarity));
              const bestQuery = r.series || r.title || r.character || r.authorName || '';

              return (
                <div
                  key={idx}
                  className="glass-panel p-5 rounded-3xl border border-white/15 hover:border-cyan-400/40 transition-all space-y-4 shadow-xl"
                >
                  {/* Top Bar: Platform & Similarity */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/40 text-purple-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {r.platformName || 'Tranh Vẽ'}
                      </span>
                      {r.character && (
                        <span className="text-xs bg-pink-500/20 text-pink-300 px-2.5 py-0.5 rounded-md border border-pink-500/30 font-medium">
                          {r.character}
                        </span>
                      )}
                    </div>

                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${confidenceColor}`}>
                      {r.similarity.toFixed(1)}% khớp ({r.confidenceLabel.toUpperCase()})
                    </span>
                  </div>

                  {/* Similarity Progress Bar */}
                  <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/10">
                    <div
                      className={`h-full transition-all duration-500 ${
                        r.confidenceLabel === 'high'
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                          : r.confidenceLabel === 'medium'
                          ? 'bg-gradient-to-r from-yellow-500 to-amber-400'
                          : 'bg-gradient-to-r from-red-500 to-rose-400'
                      }`}
                      style={{ width: `${barPercentage}%` }}
                    />
                  </div>

                  {/* Artwork & Info Content */}
                  <div className="flex flex-col sm:flex-row gap-5">
                    {r.thumbnailUrl && (
                      <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-black/60 border border-white/20 shrink-0 self-center sm:self-start shadow-md">
                        <img
                          src={r.thumbnailUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-2">
                      <h3 className="font-extrabold text-white text-base leading-snug">
                        {r.title || r.series || 'Anime Artwork'}
                      </h3>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        {r.series && (
                          <div className="flex items-start gap-1.5 text-gray-300">
                            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                            <span className="text-gray-400">Series:</span>
                            <span className="font-semibold text-white">{r.series}</span>
                          </div>
                        )}

                        {r.authorName && (
                          <div className="flex items-start gap-1.5 text-gray-300">
                            <User className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                            <span className="text-gray-400">Tác giả:</span>
                            <span className="font-semibold text-white">{r.authorName}</span>
                          </div>
                        )}

                        {r.pixivId && (
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="text-gray-400">Pixiv ID:</span>
                            <code className="text-cyan-300 font-mono">{r.pixivId}</code>
                          </div>
                        )}

                        {r.danbooruId && (
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <Hash className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <span className="text-gray-400">Danbooru ID:</span>
                            <code className="text-cyan-300 font-mono">{r.danbooruId}</code>
                          </div>
                        )}

                        {r.twitterHandle && (
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <span className="text-gray-400">Twitter:</span>
                            <span className="text-sky-300 font-mono">@{r.twitterHandle}</span>
                          </div>
                        )}
                      </div>

                      {/* External Action Links */}
                      <div className="pt-3 flex items-center gap-2 flex-wrap">
                        {r.sourceUrl && (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-white/10"
                          >
                            <span>Mở bài đăng gốc</span>
                            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                          </a>
                        )}

                        {r.authorUrl && (
                          <a
                            href={r.authorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-white/10"
                          >
                            <span>Hồ sơ tác giả</span>
                            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                          </a>
                        )}

                        {bestQuery && (
                          <button
                            onClick={() => onExploreQuery(bestQuery)}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                            <span>Khám phá thêm trên kho hình nền</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results: trace.moe */}
      {sceneResults.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              {language === 'vi' ? `Nhận diện ${sceneResults.length} cảnh anime trùng khớp` : `Recognized ${sceneResults.length} scenes`}
            </h2>
          </div>

          <div className="space-y-4">
            {sceneResults.map((r, idx) => {
              const confidenceColor =
                r.confidenceLabel === 'high'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : r.confidenceLabel === 'medium'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

              const animeQuery = r.animeTitle.english || r.animeTitle.romaji;

              return (
                <div
                  key={idx}
                  className="glass-panel p-5 rounded-3xl border border-white/15 hover:border-cyan-400/40 transition-all space-y-4 shadow-xl"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${confidenceColor}`}>
                      {r.similarity.toFixed(1)}% khớp ({r.confidenceLabel.toUpperCase()})
                    </span>

                    <div className="flex items-center gap-2">
                      {r.episode !== null && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-lg border border-cyan-500/30 font-bold">
                          Tập {r.episode}
                        </span>
                      )}
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1 rounded-lg border border-purple-500/30 font-mono font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {r.timeRangeFormatted || r.timestampFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Media Preview: Video or Image */}
                  <div className="rounded-2xl overflow-hidden border border-white/15 bg-black/60 shadow-lg">
                    {r.videoPreviewUrl ? (
                      <video
                        src={r.videoPreviewUrl}
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full max-h-72 object-contain mx-auto"
                      />
                    ) : (
                      <img
                        src={r.imagePreviewUrl}
                        alt="Scene frame"
                        className="w-full max-h-72 object-contain mx-auto"
                      />
                    )}
                  </div>

                  {/* Anime Titles & Filename Info */}
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-white text-lg">
                      {r.animeTitle.romaji}
                    </h3>
                    {r.animeTitle.english && (
                      <p className="text-sm text-cyan-300 font-semibold">
                        {r.animeTitle.english}
                      </p>
                    )}
                    {r.animeTitle.native && (
                      <p className="text-xs text-gray-400 font-medium">
                        {r.animeTitle.native}
                      </p>
                    )}
                    {r.filename && (
                      <p className="text-[11px] text-gray-400 font-mono bg-white/5 py-1 px-2.5 rounded-lg border border-white/5 truncate">
                        📁 {r.filename}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <a
                      href={r.anilistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-white/10"
                    >
                      <span>Chi tiết phim trên AniList</span>
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    </a>

                    {animeQuery && (
                      <button
                        onClick={() => onExploreQuery(animeQuery)}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        <span>Xem hình nền 4K phim này</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Embedded Related 4K Wallpapers Preview Section */}
      {relatedWallpapers.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-white/10 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>Hình nền 4K & 2K liên quan</span>
            </h2>
            <span className="text-xs text-gray-400 font-mono">
              {relatedWallpapers.length} hình nền
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {relatedWallpapers.map((w) => {
              const isFav = favoriteIds.has(w.id);

              return (
                <div
                  key={w.id}
                  className="group relative rounded-2xl overflow-hidden glass-panel border border-white/10 hover:border-cyan-400/50 transition-all shadow-md"
                >
                  <img
                    src={w.previewUrl}
                    alt={w.title}
                    className="w-full h-36 sm:h-44 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Resolution Badge */}
                  <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-white border border-white/20">
                    {w.resolution}
                  </span>

                  {/* Favorite Button */}
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(w);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:text-pink-400 transition-colors"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? 'fill-pink-500 text-pink-500' : ''}`}
                      />
                    </button>
                  )}

                  {/* Bottom Info & Action */}
                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-1">
                    <p className="text-[11px] font-semibold text-white truncate drop-shadow-md">
                      {w.title}
                    </p>

                    {onSelectWallpaper && (
                      <button
                        onClick={() => onSelectWallpaper(w)}
                        className="p-1 rounded-lg bg-white/20 hover:bg-white/40 text-white backdrop-blur-md shrink-0 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
