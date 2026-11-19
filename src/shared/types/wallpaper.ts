export type ProviderName =
  | 'wallhaven'
  | 'konachan'
  | 'safebooru'
  | 'yandere'
  | 'danbooru'
  | 'tbib'
  | 'nekos_best'
  | 'zerochan'
  | 'nekosapi';

export type WallpaperRating = 'safe' | 'questionable' | 'explicit';

export type OrientationFilter = 'all' | 'landscape' | 'portrait' | 'ultrawide' | 'square';

export type ResolutionFilter = 'all' | '1080p' | '2k' | '4k' | '8k';

export type AspectRatioFilter = 'all' | '16:9' | '16:10' | '21:9' | '32:9' | '9:16' | '9:19.5' | '1:1';

export type SortFilter = 'relevance' | 'favorites' | 'newest' | 'random' | 'resolution';

export interface Wallpaper {
  id: string; // provider_postId e.g. wallhaven_gpl8d3, zerochan_4737210
  provider: ProviderName;
  providerPostId: string;
  title: string;
  tags: string[];
  characters: string[];
  series: string[];
  artistName?: string;
  artistUrl?: string;
  uploaderName?: string;
  width: number;
  height: number;
  resolution: string; // e.g. "3840x2160"
  aspectRatio: string; // e.g. "16:9"
  orientation: 'landscape' | 'portrait' | 'square';
  fileSize?: number; // bytes
  mimeType?: string; // image/jpeg, image/png, image/webp
  thumbnailUrl: string;
  previewUrl: string;
  originalFileUrl: string;
  postUrl: string;
  externalSourceUrl?: string;
  dominantColor?: string; // hex string e.g. "#4E7F8E"
  colorPalette?: string[]; // hex strings e.g. ["#ECE8E9", "#376B7D"]
  rating: WallpaperRating;
  sourceMetadata: Record<string, unknown>;
  createdAt?: string;
}

export interface SearchFilters {
  query?: string;
  providers?: ProviderName[];
  orientation?: OrientationFilter;
  resolution?: ResolutionFilter;
  aspectRatio?: AspectRatioFilter;
  sort?: SortFilter;
  color?: string; // 'all' | 'black' | 'purple' | 'blue' | 'pink' | 'red' | 'green' | 'white' | 'yellow'
  page?: number;
  limit?: number;
  sfwOnly?: boolean;
}

export interface SearchInsight {
  totalFound: number;
  providerCounts: Record<string, number>;
  topCharacters: string[];
  topSeries: string[];
  topArtists: string[];
  maxResolution: string;
  has4kOrHigher: boolean;
}

export interface SearchResult {
  wallpapers: Wallpaper[];
  page: number;
  hasMore: boolean;
  totalEstimate?: number;
  query: string;
  providersUsed: ProviderName[];
  executionTimeMs: number;
  insights?: SearchInsight;
}
