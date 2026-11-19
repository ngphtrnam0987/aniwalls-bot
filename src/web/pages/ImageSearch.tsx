import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, Sparkles, Film, Image as ImageIcon, ExternalLink, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ApiClient } from '../services/api';
import { Language, I18N } from '../types';
import { ReverseSearchResult, SceneSearchResult, ReverseSearchItem, SceneSearchItem } from '@/shared/types/api';

interface ImageSearchProps {
  language: Language;
  initData?: string;
  triggerHaptic?: () => void;
  onExploreQuery: (query: string) => void;
}

type SearchMode = 'saucenao' | 'tracemoe';

export const ImageSearch: React.FC<ImageSearchProps> = ({
  language,
  initData,
  triggerHaptic,
  onExploreQuery
}) => {
  const t = I18N[language];

  const [mode, setMode] = useState<SearchMode>('saucenao');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sauceResults, setSauceResults] = useState<ReverseSearchItem[]>([]);
  const [sceneResults, setSceneResults] = useState<SceneSearchItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImageUrl('');
      setError(null);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
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
      triggerHaptic?.();
    }
  };

  const handleUrlChange = (val: string) => {
    setImageUrl(val);
    if (val.trim().startsWith('http')) {
      setSelectedFile(null);
      setPreviewUrl(val.trim());
      setError(null);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setImageUrl('');
    setPreviewUrl(null);
    setSauceResults([]);
    setSceneResults([]);
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
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleFindHighRes = (query: string) => {
    triggerHaptic?.();
    onExploreQuery(query);
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          {language === 'vi' ? 'Nhận Diện & Tìm Nguồn Ảnh' : 'Reverse Image Search'}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {language === 'vi'
            ? 'Xác minh tác giả tranh vẽ minh họa hoặc nhận diện tên phim anime từ ảnh chụp màn hình'
            : 'Identify illustration artists or recognize anime scenes from screenshots'}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="glass-panel p-1 rounded-2xl flex border border-white/10">
        <button
          onClick={() => {
            setMode('saucenao');
            triggerHaptic?.();
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-medium text-xs transition-all ${
            mode === 'saucenao'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>{language === 'vi' ? 'Nguồn Tranh Vẽ (SauceNAO)' : 'Artwork Source (SauceNAO)'}</span>
        </button>

        <button
          onClick={() => {
            setMode('tracemoe');
            triggerHaptic?.();
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-medium text-xs transition-all ${
            mode === 'tracemoe'
              ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>{language === 'vi' ? 'Cảnh Phim Anime (trace.moe)' : 'Anime Scene (trace.moe)'}</span>
        </button>
      </div>

      {/* Upload Zone & URL Input */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />

        {previewUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/40">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-72 object-contain mx-auto"
            />
            <button
              onClick={clearSelection}
              className="absolute top-3 right-3 px-3 py-1 bg-black/70 hover:bg-black/90 text-white text-xs rounded-full backdrop-blur-md border border-white/20 transition-all"
            >
              {language === 'vi' ? 'Đổi ảnh khác' : 'Change image'}
            </button>
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
            <p className="text-sm font-medium text-gray-200">
              {language === 'vi' ? 'Chạm để tải ảnh lên hoặc kéo thả vào đây' : 'Tap to upload or drag & drop'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG, WEBP (tối đa 10MB)
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
            placeholder={language === 'vi' ? 'Hoặc dán URL hình ảnh trực tiếp...' : 'Or paste image URL directly...'}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSearch}
          disabled={loading || (!selectedFile && !imageUrl.trim())}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm shadow-xl shadow-purple-600/25 flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{language === 'vi' ? 'Đang phân tích hình ảnh...' : 'Analyzing image...'}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>
                {mode === 'saucenao'
                  ? (language === 'vi' ? 'Tìm nguồn tác giả (SauceNAO)' : 'Identify Artist (SauceNAO)')
                  : (language === 'vi' ? 'Nhận diện Anime (trace.moe)' : 'Recognize Anime (trace.moe)')}
              </span>
            </>
          )}
        </button>
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
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {language === 'vi' ? 'Kết quả tìm kiếm tranh vẽ' : 'Artwork Source Results'}
          </h2>

          <div className="space-y-3">
            {sauceResults.map((r, idx) => {
              const confidenceColor =
                r.confidenceLabel === 'high'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : r.confidenceLabel === 'medium'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

              const bestQuery = r.series || r.title || r.character || r.authorName || '';

              return (
                <div
                  key={idx}
                  className="glass-panel p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row gap-4"
                >
                  {r.thumbnailUrl && (
                    <img
                      src={r.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-24 h-24 object-cover rounded-xl bg-black/40 border border-white/10 shrink-0 self-center sm:self-start"
                    />
                  )}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
                        {r.similarity.toFixed(1)}% khớp
                      </span>
                      {r.character && (
                        <span className="text-[11px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                          {r.character}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-sm truncate">
                      {r.title || r.series || 'Artwork Match'}
                    </h3>

                    {r.series && (
                      <p className="text-xs text-gray-300">
                        <span className="text-gray-400">Series:</span> {r.series}
                      </p>
                    )}

                    {r.authorName && (
                      <p className="text-xs text-gray-300">
                        <span className="text-gray-400">Tác giả:</span> {r.authorName}
                      </p>
                    )}

                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      {r.sourceUrl && (
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>{language === 'vi' ? 'Trang bài đăng' : 'Source Post'}</span>
                          <ExternalLink className="w-3 h-3 text-cyan-400" />
                        </a>
                      )}

                      {bestQuery && (
                        <button
                          onClick={() => handleFindHighRes(bestQuery)}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600/80 to-cyan-600/80 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20"
                        >
                          <Sparkles className="w-3 h-3 text-yellow-300" />
                          <span>{language === 'vi' ? 'Tìm hình nền 4K liên quan' : 'Find 4K Wallpapers'}</span>
                        </button>
                      )}
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
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            {language === 'vi' ? 'Kết quả nhận diện anime' : 'Anime Scene Results'}
          </h2>

          <div className="space-y-3">
            {sceneResults.map((r, idx) => {
              const confidenceColor =
                r.confidenceLabel === 'high'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : r.confidenceLabel === 'medium'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

              const animeQuery = r.animeTitle.english || r.animeTitle.romaji;

              return (
                <div
                  key={idx}
                  className="glass-panel p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
                      {r.similarity.toFixed(1)}% khớp ({r.confidenceLabel.toUpperCase()})
                    </span>
                    {r.episode !== null && (
                      <span className="text-[11px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-semibold">
                        Tập {r.episode} • {r.timestampFormatted}
                      </span>
                    )}
                  </div>

                  {r.imagePreviewUrl && (
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/50">
                      <img
                        src={r.imagePreviewUrl}
                        alt="Anime Scene"
                        className="w-full max-h-56 object-contain mx-auto"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-base">
                      {r.animeTitle.romaji}
                    </h3>
                    {r.animeTitle.english && (
                      <p className="text-xs text-gray-300 font-medium">
                        {r.animeTitle.english}
                      </p>
                    )}
                    {r.animeTitle.native && (
                      <p className="text-xs text-gray-500">
                        {r.animeTitle.native}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <a
                      href={r.anilistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Thông tin AniList</span>
                      <ExternalLink className="w-3 h-3 text-cyan-400" />
                    </a>

                    {animeQuery && (
                      <button
                        onClick={() => handleFindHighRes(animeQuery)}
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20"
                      >
                        <Sparkles className="w-3 h-3 text-yellow-300" />
                        <span>Tìm hình nền Anime này</span>
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
