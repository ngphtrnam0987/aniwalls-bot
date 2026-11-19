import React from 'react';
import { Sparkles, Zap, LayoutGrid, ListFilter, Users, Film, Layers } from 'lucide-react';
import { SearchInsight } from '@/shared/types/wallpaper';
import { Language, I18N } from '../types';

interface SearchInsightBarProps {
  insight?: SearchInsight;
  executionTimeMs?: number;
  totalCount: number;
  viewMode: 'masonry' | 'detailed';
  onViewModeChange: (mode: 'masonry' | 'detailed') => void;
  onFilterTag?: (tag: string) => void;
  language: Language;
}

export const SearchInsightBar: React.FC<SearchInsightBarProps> = ({
  insight,
  executionTimeMs,
  totalCount,
  viewMode,
  onViewModeChange,
  onFilterTag,
  language
}) => {
  if (totalCount === 0 && !insight) return null;

  const t = I18N[language];

  const providerLabels: Record<string, string> = {
    wallhaven: 'Wallhaven',
    zerochan: 'Zerochan',
    konachan: 'Konachan',
    safebooru: 'Safebooru',
    yandere: 'Yande.re',
    danbooru: 'Danbooru',
    tbib: 'TBIB',
    nekos_best: 'Nekos.best',
    nekosapi: 'NekosAPI'
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-3 border border-white/10 shadow-lg space-y-2.5 animate-fade-in text-xs">
      {/* Top Header Row: Metrics & View Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 flex-wrap">
          {/* Total Count Badge */}
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{totalCount} {language === 'vi' ? 'kết quả' : 'wallpapers'}</span>
          </span>

          {/* Highest Resolution Badge */}
          {insight?.maxResolution && (
            <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold">
              <span>Độ nét cao nhất:</span>
              <strong className="text-white">{insight.maxResolution}</strong>
            </span>
          )}

          {/* Execution Time */}
          {executionTimeMs !== undefined && (
            <span className="hidden sm:flex items-center space-x-1 text-gray-400 text-[11px]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{executionTimeMs}ms</span>
            </span>
          )}
        </div>

        {/* View Mode Toggle: Masonry vs Detailed */}
        <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10">
          <button
            onClick={() => onViewModeChange('masonry')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all ${
              viewMode === 'masonry'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Lưới Pinterest"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden xs:inline">Lưới</span>
          </button>

          <button
            onClick={() => onViewModeChange('detailed')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg transition-all ${
              viewMode === 'detailed'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Chi tiết thông số"
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden xs:inline">Chi tiết</span>
          </button>
        </div>
      </div>

      {/* Provider Contributions Row */}
      {insight && Object.keys(insight.providerCounts).length > 0 && (
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap flex items-center">
            <Layers className="w-3 h-3 mr-1 text-indigo-400" /> Nguồn:
          </span>
          {Object.entries(insight.providerCounts).map(([prov, count]) => (
            <span
              key={prov}
              className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-[11px] text-gray-300 whitespace-nowrap"
            >
              {providerLabels[prov] || prov}: <strong className="text-white">{count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Suggested Top Characters & Anime Series Row */}
      {insight && (insight.topCharacters.length > 0 || insight.topSeries.length > 0) && (
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/5">
          <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap flex items-center">
            <Users className="w-3 h-3 mr-1 text-pink-400" /> Nhân vật hot:
          </span>

          {insight.topCharacters.map((char) => (
            <button
              key={char}
              onClick={() => onFilterTag && onFilterTag(char)}
              className="px-2.5 py-0.5 rounded-full bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 hover:text-white border border-pink-500/20 text-[11px] whitespace-nowrap transition-all"
            >
              👤 {char}
            </button>
          ))}

          {insight.topSeries.map((s) => (
            <button
              key={s}
              onClick={() => onFilterTag && onFilterTag(s)}
              className="px-2.5 py-0.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/20 text-[11px] whitespace-nowrap transition-all"
            >
              <Film className="w-2.5 h-2.5 inline mr-1 text-purple-400" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
