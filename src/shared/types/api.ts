import { Wallpaper, ProviderName, OrientationFilter, ResolutionFilter } from './wallpaper';

export interface UserProfile {
  telegram_user_id: number;
  username?: string;
  display_name?: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: number;
  default_resolution: ResolutionFilter;
  default_orientation: OrientationFilter;
  selected_providers: ProviderName[];
  daily_enabled: boolean;
  daily_time: string; // HH:mm format e.g. "09:00"
  timezone: string; // e.g. "Asia/Ho_Chi_Minh"
  updated_at?: string;
}

export interface FavoriteItem {
  user_id: number;
  wallpaper_id: string;
  created_at: string;
  wallpaper?: Wallpaper;
}

export interface SearchHistoryItem {
  id: number;
  user_id: number;
  query: string;
  filters_json?: string;
  created_at: string;
}

export interface ReverseSearchResult {
  success: boolean;
  configured: boolean;
  results: Array<{
    similarity: number;
    title?: string;
    authorName?: string;
    authorUrl?: string;
    sourceUrl?: string;
    thumbnailUrl?: string;
    material?: string;
  }>;
  message?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
