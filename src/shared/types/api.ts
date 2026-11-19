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
  telegram_user_id: number;
  preferred_resolution: ResolutionFilter;
  preferred_orientation: OrientationFilter;
  enabled_providers: ProviderName[];
  language: string;
  updated_at?: string;

  // Compatibility fields for web clients
  user_id: number;
  default_resolution: ResolutionFilter;
  default_orientation: OrientationFilter;
  selected_providers: ProviderName[];
  daily_enabled: boolean;
  daily_time: string;
  timezone: string;
}

export interface FavoriteRecord {
  id: string;
  telegram_user_id: number;
  provider: ProviderName;
  wallpaper_id: string;
  metadata_json: string;
  created_at: string;
  wallpaper?: Wallpaper;
}

export interface SearchHistoryRecord {
  id: number;
  telegram_user_id: number;
  query: string;
  filters_json?: string;
  created_at: string;
}

export interface TelegramFileCacheRecord {
  provider: ProviderName;
  wallpaper_id: string;
  telegram_file_id: string;
  created_at: string;
}

export interface SearchSessionRecord {
  session_id: string;
  telegram_user_id: number;
  query: string;
  filters_json: string;
  current_page: number;
  expires_at: number;
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
