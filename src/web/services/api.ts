import { Wallpaper, SearchFilters, SearchResult } from '@/shared/types/wallpaper';
import { UserSettings, ReverseSearchResult, SceneSearchResult, SmartSearchResult } from '@/shared/types/api';

const API_BASE = '/api';

function getHeaders(initData?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }
  return headers;
}

export const ApiClient = {
  async searchWallpapers(filters: SearchFilters, initData?: string): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (filters.query) params.set('query', filters.query);
    if (filters.providers && filters.providers.length > 0) {
      params.set('providers', JSON.stringify(filters.providers));
    }
    if (filters.orientation && filters.orientation !== 'all') params.set('orientation', filters.orientation);
    if (filters.resolution && filters.resolution !== 'all') params.set('resolution', filters.resolution);
    if (filters.aspectRatio && filters.aspectRatio !== 'all') params.set('aspectRatio', filters.aspectRatio);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    params.set('sfwOnly', 'true');

    const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
      headers: getHeaders(initData)
    });

    if (!res.ok) {
      throw new Error(`Search failed: HTTP ${res.status}`);
    }

    const json = await res.json() as { success: boolean; data: SearchResult; error?: string };
    if (!json.success) {
      throw new Error(json.error || 'Search error');
    }

    return json.data;
  },

  async getRandomWallpapers(orientation = 'all', resolution = 'all'): Promise<Wallpaper[]> {
    const params = new URLSearchParams({ orientation, resolution });
    const res = await fetch(`${API_BASE}/random?${params.toString()}`);
    if (!res.ok) return [];

    const json = await res.json() as { success: boolean; data: SearchResult };
    return json.data?.wallpapers || [];
  },

  async getWallpaperById(id: string): Promise<Wallpaper | null> {
    const res = await fetch(`${API_BASE}/wallpapers/${id}`);
    if (!res.ok) return null;
    const json = await res.json() as { success: boolean; data: Wallpaper };
    return json.data || null;
  },

  // Favorites
  async getFavorites(initData: string, page = 1, limit = 20): Promise<{ wallpapers: Wallpaper[]; total: number }> {
    if (!initData) {
      // Standalone mode: fallback to localStorage
      try {
        const stored = localStorage.getItem('aniwalls_local_favorites');
        const list: Wallpaper[] = stored ? JSON.parse(stored) : [];
        return { wallpapers: list, total: list.length };
      } catch {
        return { wallpapers: [], total: 0 };
      }
    }

    const res = await fetch(`${API_BASE}/favorites?page=${page}&limit=${limit}`, {
      headers: getHeaders(initData)
    });

    if (!res.ok) return { wallpapers: [], total: 0 };
    const json = await res.json() as { success: boolean; data: { wallpapers: Wallpaper[]; total: number } };
    return json.data || { wallpapers: [], total: 0 };
  },

  async addFavorite(wallpaper: Wallpaper, initData?: string): Promise<boolean> {
    if (!initData) {
      try {
        const stored = localStorage.getItem('aniwalls_local_favorites');
        const list: Wallpaper[] = stored ? JSON.parse(stored) : [];
        if (!list.some(w => w.id === wallpaper.id)) {
          list.unshift(wallpaper);
          localStorage.setItem('aniwalls_local_favorites', JSON.stringify(list));
        }
        return true;
      } catch {
        return false;
      }
    }

    const res = await fetch(`${API_BASE}/favorites`, {
      method: 'POST',
      headers: getHeaders(initData),
      body: JSON.stringify({ wallpaper_id: wallpaper.id, wallpaper })
    });
    return res.ok;
  },

  async removeFavorite(wallpaperId: string, initData?: string): Promise<boolean> {
    if (!initData) {
      try {
        const stored = localStorage.getItem('aniwalls_local_favorites');
        let list: Wallpaper[] = stored ? JSON.parse(stored) : [];
        list = list.filter(w => w.id !== wallpaperId);
        localStorage.setItem('aniwalls_local_favorites', JSON.stringify(list));
        return true;
      } catch {
        return false;
      }
    }

    const res = await fetch(`${API_BASE}/favorites/${wallpaperId}`, {
      method: 'DELETE',
      headers: getHeaders(initData)
    });
    return res.ok;
  },

  // Settings
  async getSettings(initData?: string): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      telegram_user_id: 0,
      preferred_resolution: 'all',
      preferred_orientation: 'all',
      enabled_providers: ['wallhaven', 'konachan', 'safebooru'],
      language: 'vi',
      user_id: 0,
      default_resolution: 'all',
      default_orientation: 'all',
      selected_providers: ['wallhaven', 'konachan', 'safebooru'],
      daily_enabled: false,
      daily_time: '09:00',
      timezone: 'Asia/Ho_Chi_Minh'
    };

    if (!initData) {
      try {
        const stored = localStorage.getItem('aniwalls_local_settings');
        return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
      } catch {
        return defaultSettings;
      }
    }

    const res = await fetch(`${API_BASE}/settings`, { headers: getHeaders(initData) });
    if (!res.ok) return defaultSettings;
    const json = await res.json() as { success: boolean; data: UserSettings };
    return json.data || defaultSettings;
  },

  async updateSettings(settings: Partial<UserSettings>, initData?: string): Promise<boolean> {
    if (!initData) {
      try {
        const stored = localStorage.getItem('aniwalls_local_settings');
        const current = stored ? JSON.parse(stored) : {};
        localStorage.setItem('aniwalls_local_settings', JSON.stringify({ ...current, ...settings }));
        return true;
      } catch {
        return false;
      }
    }

    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: getHeaders(initData),
      body: JSON.stringify(settings)
    });
    return res.ok;
  },

  // ==========================================
  // PHASE 4: REVERSE SEARCH, SCENE & SMART SEARCH
  // ==========================================

  async reverseSearchByUrl(imageUrl: string, initData?: string): Promise<ReverseSearchResult> {
    const res = await fetch(`${API_BASE}/reverse-search`, {
      method: 'POST',
      headers: getHeaders(initData),
      body: JSON.stringify({ image_url: imageUrl })
    });
    return res.json();
  },

  async reverseSearchByFile(file: File, initData?: string): Promise<ReverseSearchResult> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (initData) headers['X-Telegram-Init-Data'] = initData;

    const res = await fetch(`${API_BASE}/reverse-search`, {
      method: 'POST',
      headers,
      body: formData
    });
    return res.json();
  },

  async sceneSearchByUrl(imageUrl: string, initData?: string): Promise<SceneSearchResult> {
    const res = await fetch(`${API_BASE}/scene-search`, {
      method: 'POST',
      headers: getHeaders(initData),
      body: JSON.stringify({ image_url: imageUrl })
    });
    return res.json();
  },

  async sceneSearchByFile(file: File, initData?: string): Promise<SceneSearchResult> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (initData) headers['X-Telegram-Init-Data'] = initData;

    const res = await fetch(`${API_BASE}/scene-search`, {
      method: 'POST',
      headers,
      body: formData
    });
    return res.json();
  },

  async smartSearch(
    query: string,
    options?: { page?: number; limit?: number },
    initData?: string
  ): Promise<SmartSearchResult> {
    const res = await fetch(`${API_BASE}/smart-search`, {
      method: 'POST',
      headers: getHeaders(initData),
      body: JSON.stringify({
        query,
        page: options?.page || 1,
        limit: options?.limit || 20
      })
    });
    return res.json();
  },

  async getSearchSuggestions(): Promise<{
    popularTags: string[];
    resolutions: string[];
    orientations: Array<{ id: string; label: string }>;
    sampleSmartPrompts: string[];
  }> {
    try {
      const res = await fetch(`${API_BASE}/search-suggestions`);
      if (!res.ok) throw new Error('Failed to load suggestions');
      const json = await res.json() as any;
      return json.data;
    } catch {
      return {
        popularTags: ['cyberpunk', 'scenery', 'night', 'sakura', 'rain', 'sunset', 'space', 'ocean'],
        resolutions: ['4k', '2k', '1080p', '8k'],
        orientations: [
          { id: 'landscape', label: 'Máy tính (16:9)' },
          { id: 'portrait', label: 'Điện thoại (9:16)' }
        ],
        sampleSmartPrompts: [
          'hình nền cyberpunk thành phố ban đêm 4k cho máy tính',
          'cô gái anime dưới trời mưa hoa anh đào điện thoại'
        ]
      };
    }
  }
};
