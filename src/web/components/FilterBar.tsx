import React from 'react';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { OrientationFilter, ResolutionFilter, ProviderName, SortFilter } from '@/shared/types/wallpaper';
import { Language, I18N } from '../types';

interface FilterBarProps {
  orientation: OrientationFilter;
  onOrientationChange: (o: OrientationFilter) => void;
  resolution: ResolutionFilter;
  onResolutionChange: (r: ResolutionFilter) => void;
  selectedProviders: ProviderName[];
  onToggleProvider: (p: ProviderName) => void;
  sort: SortFilter;
  onSortChange: (s: SortFilter) => void;
  language: Language;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  orientation,
  onOrientationChange,
  resolution,
  onResolutionChange,
  selectedProviders,
  onToggleProvider,
  sort,
  onSortChange,
  language
}) => {
  const t = I18N[language];

  const orientations: Array<{ id: OrientationFilter; label: string }> = [
    { id: 'all', label: t.all },
    { id: 'portrait', label: t.portrait },
    { id: 'landscape', label: t.landscape },
    { id: 'ultrawide', label: t.ultrawide }
  ];

  const resolutions: Array<{ id: ResolutionFilter; label: string }> = [
    { id: 'all', label: t.all },
    { id: '4k', label: '4K UHD' },
    { id: '2k', label: '2K QHD' },
    { id: '1080p', label: '1080p FHD' },
    { id: '8k', label: '8K UHD' }
  ];

  const allProviders: ProviderName[] = [
    'wallhaven',
    'konachan',
    'safebooru',
    'yandere',
    'danbooru',
    'tbib',
    'nekos_best'
  ];

  const providerLabels: Record<ProviderName, string> = {
    wallhaven: 'Wallhaven',
    konachan: 'Konachan',
    safebooru: 'Safebooru',
    yandere: 'Yande.re',
    danbooru: 'Danbooru',
    tbib: 'TBIB',
    nekos_best: 'Nekos.best'
  };

  const sorts: Array<{ id: SortFilter; label: string }> = [
    { id: 'relevance', label: t.relevance },
    { id: 'favorites', label: t.popular },
    { id: 'resolution', label: t.highestRes },
    { id: 'newest', label: t.newest },
    { id: 'random', label: t.random }
  ];

  return (
    <div className="w-full space-y-2.5 py-2">
      {/* Row 1: Orientation Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
        <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap px-1">
          {t.orientation}:
        </span>
        {orientations.map((item) => (
          <button
            key={item.id}
            onClick={() => onOrientationChange(item.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              orientation === item.id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'glass-button text-gray-300 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Row 2: Resolution & Provider Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
        <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap px-1">
          {t.resolution}:
        </span>
        {resolutions.map((res) => (
          <button
            key={res.id}
            onClick={() => onResolutionChange(res.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              resolution === res.id
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'glass-button text-gray-300 hover:text-white'
            }`}
          >
            {res.label}
          </button>
        ))}

        <div className="h-4 w-[1px] bg-white/10 mx-1 flex-shrink-0" />

        {/* Providers */}
        {allProviders.map((p) => {
          const isSelected = selectedProviders.includes(p);
          return (
            <button
              key={p}
              onClick={() => onToggleProvider(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'glass-button text-gray-400 opacity-60'
              }`}
            >
              {providerLabels[p] || p}
            </button>
          );
        })}
      </div>

      {/* Row 3: Sort selector */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap px-1">
          {t.sort}:
        </span>
        {sorts.map((s) => (
          <button
            key={s.id}
            onClick={() => onSortChange(s.id)}
            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
              sort === s.id
                ? 'bg-white/15 text-white font-semibold'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};
