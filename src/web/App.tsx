import React, { useState, useEffect, useCallback } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { ApiClient } from './services/api';
import { Wallpaper, SearchFilters, OrientationFilter, ResolutionFilter } from '@/shared/types/wallpaper';
import { UserSettings } from '@/shared/types/api';
import { Language, I18N } from './types';
import { Navbar } from './components/Navbar';
import { BottomNav, NavTab } from './components/BottomNav';
import { WallpaperDetailModal } from './components/WallpaperDetailModal';
import { Home } from './pages/Home';
import { Explore } from './pages/Explore';
import { Favorites } from './pages/Favorites';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  const { isInsideTelegram, initData, user, triggerHaptic, openExternalLink, tg } = useTelegram();

  const [language, setLanguage] = useState<Language>('vi');
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Search exploration props passed to Explore page
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreOrientation, setExploreOrientation] = useState<OrientationFilter>('all');
  const [exploreResolution, setExploreResolution] = useState<ResolutionFilter>('all');

  // Wallpapers data
  const [recommendedWallpapers, setRecommendedWallpapers] = useState<Wallpaper[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<Wallpaper[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Settings
  const [userSettings, setUserSettings] = useState<UserSettings>({
    user_id: user?.id || 0,
    default_resolution: 'all',
    default_orientation: 'all',
    selected_providers: ['wallhaven', 'konachan', 'safebooru'],
    daily_enabled: false,
    daily_time: '09:00',
    timezone: 'Asia/Ho_Chi_Minh'
  });

  // Selected wallpaper modal
  const [selectedWallpaper, setSelectedWallpaper] = useState<Wallpaper | null>(null);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Handle URL hash changes (#favorites, #settings, etc.)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'favorites') setCurrentTab('favorites');
      else if (hash === 'settings') setCurrentTab('settings');
      else if (hash === 'explore') setCurrentTab('explore');
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Sync Telegram BackButton with detail modal
  useEffect(() => {
    if (!tg?.BackButton) return;

    if (selectedWallpaper) {
      tg.BackButton.show();
      const handleBack = () => setSelectedWallpaper(null);
      tg.BackButton.onClick(handleBack);
      return () => {
        tg.BackButton.offClick(handleBack);
        tg.BackButton.hide();
      };
    } else {
      tg.BackButton.hide();
    }
  }, [selectedWallpaper, tg]);

  // Load initial recommended wallpapers
  useEffect(() => {
    async function fetchRecommended() {
      setLoadingRecommended(true);
      try {
        const wallpapers = await ApiClient.getRandomWallpapers('all', 'all');
        setRecommendedWallpapers(wallpapers);
      } catch (err) {
        console.error('Error fetching recommended wallpapers:', err);
      } finally {
        setLoadingRecommended(false);
      }
    }

    fetchRecommended();
  }, []);

  // Load user favorites
  const loadFavorites = useCallback(async () => {
    try {
      const res = await ApiClient.getFavorites(initData);
      setFavorites(res.wallpapers);
      setFavoriteIds(new Set(res.wallpapers.map((w) => w.id)));
    } catch (err) {
      console.warn('Error loading favorites:', err);
    }
  }, [initData]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Load user settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const s = await ApiClient.getSettings(initData);
        setUserSettings(s);
      } catch (err) {
        console.warn('Error loading settings:', err);
      }
    }
    fetchSettings();
  }, [initData]);

  // Toggle favorite handler
  const handleToggleFavorite = async (w: Wallpaper) => {
    triggerHaptic('light');
    const isFav = favoriteIds.has(w.id);

    if (isFav) {
      await ApiClient.removeFavorite(w.id, initData);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(w.id);
        return next;
      });
      setFavorites((prev) => prev.filter((item) => item.id !== w.id));
      showToast(I18N[language].removedFavorite);
    } else {
      await ApiClient.addFavorite(w, initData);
      setFavoriteIds((prev) => new Set(prev).add(w.id));
      setFavorites((prev) => [w, ...prev]);
      showToast(I18N[language].addedFavorite);
    }
  };

  // Search trigger from Home
  const handleHeroSearch = (query: string, orientation?: OrientationFilter, resolution?: ResolutionFilter) => {
    triggerHaptic('light');
    setExploreQuery(query);
    if (orientation) setExploreOrientation(orientation);
    if (resolution) setExploreResolution(resolution);
    setCurrentTab('explore');
  };

  // Update Settings
  const handleUpdateSettings = async (newSettings: Partial<UserSettings>) => {
    triggerHaptic('light');
    setUserSettings((prev) => ({ ...prev, ...newSettings }));
    await ApiClient.updateSettings(newSettings, initData);
    showToast('Đã cập nhật cài đặt!');
  };

  return (
    <div className="min-h-screen bg-[#0B0B12] text-white flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        language={language}
        onLanguageChange={(l) => {
          setLanguage(l);
          triggerHaptic('light');
        }}
        isInsideTelegram={isInsideTelegram}
        userName={user?.first_name}
        userPhoto={user?.photo_url}
      />

      {/* Main Pages */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 animate-fade-in">
        {currentTab === 'home' && (
          <Home
            onSearch={handleHeroSearch}
            recommendedWallpapers={recommendedWallpapers}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onSelectWallpaper={(w) => {
              triggerHaptic('light');
              setSelectedWallpaper(w);
            }}
            loadingRecommended={loadingRecommended}
            onNavigateToExplore={() => {
              triggerHaptic('light');
              setCurrentTab('explore');
            }}
            language={language}
          />
        )}

        {currentTab === 'explore' && (
          <Explore
            initialQuery={exploreQuery}
            initialOrientation={exploreOrientation}
            initialResolution={exploreResolution}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onSelectWallpaper={(w) => {
              triggerHaptic('light');
              setSelectedWallpaper(w);
            }}
            onFetchWallpapers={(filters) => ApiClient.searchWallpapers(filters, initData)}
            language={language}
          />
        )}

        {currentTab === 'favorites' && (
          <Favorites
            favorites={favorites}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onSelectWallpaper={(w) => {
              triggerHaptic('light');
              setSelectedWallpaper(w);
            }}
            onNavigateToHome={() => {
              triggerHaptic('light');
              setCurrentTab('home');
            }}
            language={language}
          />
        )}

        {currentTab === 'settings' && (
          <Settings
            settings={userSettings}
            onUpdateSettings={handleUpdateSettings}
            language={language}
            onLanguageChange={(l) => {
              setLanguage(l);
              triggerHaptic('light');
            }}
            onOpenBot={() => openExternalLink('https://t.me/AniWallsBot')}
          />
        )}
      </main>

      {/* Detail Modal */}
      <WallpaperDetailModal
        wallpaper={selectedWallpaper}
        onClose={() => setSelectedWallpaper(null)}
        isFavorite={selectedWallpaper ? favoriteIds.has(selectedWallpaper.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onTagClick={(tag) => {
          setExploreQuery(tag);
          setCurrentTab('explore');
        }}
        onOpenExternal={openExternalLink}
        language={language}
      />

      {/* Floating Bottom Nav */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          triggerHaptic('light');
          setCurrentTab(tab);
        }}
        language={language}
        favoritesCount={favorites.length}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-2 rounded-full border border-purple-500/40 shadow-xl shadow-purple-900/30 text-xs font-semibold text-white animate-fade-in flex items-center space-x-2">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
