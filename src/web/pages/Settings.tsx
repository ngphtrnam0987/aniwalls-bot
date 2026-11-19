import React from 'react';
import { Settings as SettingsIcon, Globe, Bell, Sparkles, Monitor, Maximize, Shield, ExternalLink } from 'lucide-react';
import { UserSettings } from '@/shared/types/api';
import { ResolutionFilter, OrientationFilter, ProviderName } from '@/shared/types/wallpaper';
import { Language, I18N } from '../types';

interface SettingsProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenBot: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  language,
  onLanguageChange,
  onOpenBot
}) => {
  const t = I18N[language];

  const handleToggleDaily = () => {
    onUpdateSettings({ daily_enabled: !settings.daily_enabled });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({ daily_time: e.target.value });
  };

  const handleResolutionChange = (r: ResolutionFilter) => {
    onUpdateSettings({ default_resolution: r });
  };

  const handleOrientationChange = (o: OrientationFilter) => {
    onUpdateSettings({ default_orientation: o });
  };

  const handleToggleProvider = (prov: ProviderName) => {
    let list = [...settings.selected_providers];
    if (list.includes(prov)) {
      if (list.length === 1) return;
      list = list.filter((p) => p !== prov);
    } else {
      list.push(prov);
    }
    onUpdateSettings({ selected_providers: list });
  };

  return (
    <div className="space-y-6 pb-24 px-2 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-2 pt-2">
        <SettingsIcon className="w-5 h-5 text-purple-400" />
        <h1 className="text-lg font-bold text-white">{t.settings}</h1>
      </div>

      {/* Language Section */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>{t.language}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onLanguageChange('vi')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
              language === 'vi'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'glass-button text-gray-300'
            }`}
          >
            <span>🇻🇳</span>
            <span>Tiếng Việt</span>
          </button>

          <button
            onClick={() => onLanguageChange('en')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
              language === 'en'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'glass-button text-gray-300'
            }`}
          >
            <span>🇬🇧</span>
            <span>English</span>
          </button>
        </div>
      </div>

      {/* Daily Wallpaper Section */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <Bell className="w-4 h-4 text-pink-400" />
            <span>{t.dailyWallpaper}</span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.daily_enabled}
              onChange={handleToggleDaily}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
          </label>
        </div>

        <p className="text-xs text-gray-400">
          {t.dailyDescription}
        </p>

        {settings.daily_enabled && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs font-medium text-gray-300">{t.deliveryTime}:</span>
            <input
              type="time"
              value={settings.daily_time || '09:00'}
              onChange={handleTimeChange}
              className="bg-[#13131F] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>

      {/* Preferences Section */}
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <Maximize className="w-4 h-4 text-purple-400" />
          <span>Tùy chọn hiển thị mặc định</span>
        </div>

        {/* Default Resolution */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-400">{t.resolution}:</span>
          <div className="grid grid-cols-4 gap-1.5">
            {(['all', '1080p', '2k', '4k'] as const).map((r) => (
              <button
                key={r}
                onClick={() => handleResolutionChange(r)}
                className={`py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                  settings.default_resolution === r
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'glass-button text-gray-400'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Default Orientation */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-400">{t.orientation}:</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['all', 'landscape', 'portrait'] as const).map((o) => (
              <button
                key={o}
                onClick={() => handleOrientationChange(o)}
                className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  settings.default_orientation === o
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'glass-button text-gray-400'
                }`}
              >
                {o === 'all' ? t.all : o === 'landscape' ? t.landscape : t.portrait}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Providers */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-400">{t.providers}:</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['wallhaven', 'konachan', 'safebooru'] as const).map((p) => {
              const active = settings.selected_providers.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => handleToggleProvider(p)}
                  className={`py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                    active
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'glass-button text-gray-500 opacity-60'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* About Box */}
      <div className="glass-card rounded-2xl p-4 text-center space-y-2 border border-white/5">
        <p className="text-xs font-bold text-gray-300">AniWalls v1.0.0</p>
        <p className="text-[11px] text-gray-500">
          Cloudflare Workers & D1 Edge Runtime • Open-Source
        </p>
        <button
          onClick={onOpenBot}
          className="inline-flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 pt-1"
        >
          <span>Trò chuyện trực tiếp với Bot Telegram</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
