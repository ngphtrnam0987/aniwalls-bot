import { Wallpaper, SearchFilters, ResolutionFilter, OrientationFilter, AspectRatioFilter, ProviderName } from '@/shared/types/wallpaper';

export interface ProviderResult {
  wallpapers: Wallpaper[];
  hasMore: boolean;
}

export interface WallpaperProvider {
  name: ProviderName;
  search(filters: SearchFilters): Promise<ProviderResult>;
  getById(id: string): Promise<Wallpaper | null>;
}

/**
 * Calculates standard aspect ratio label from width and height
 */
export function calculateAspectRatio(width: number, height: number): string {
  if (!width || !height) return '16:9';
  const ratio = width / height;

  if (Math.abs(ratio - 16 / 9) <= 0.06) return '16:9';
  if (Math.abs(ratio - 16 / 10) <= 0.05) return '16:10';
  if (Math.abs(ratio - 21 / 9) <= 0.1) return '21:9';
  if (Math.abs(ratio - 32 / 9) <= 0.15) return '32:9';
  if (Math.abs(ratio - 9 / 16) <= 0.04) return '9:16';
  if (Math.abs(ratio - 9 / 19.5) <= 0.04) return '9:19.5';
  if (Math.abs(ratio - 1) <= 0.05) return '1:1';

  // Fallback to greatest common divisor approximation
  function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
  }
  const divisor = gcd(Math.round(width), Math.round(height));
  const simpW = Math.round(width / divisor);
  const simpH = Math.round(height / divisor);
  if (simpW < 50 && simpH < 50) {
    return `${simpW}:${simpH}`;
  }
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Classifies orientation based on width and height
 */
export function getOrientation(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  const ratio = width / height;
  if (ratio > 1.05) return 'landscape';
  if (ratio < 0.95) return 'portrait';
  return 'square';
}

/**
 * Checks if wallpaper satisfies orientation filter
 */
export function matchesOrientation(wallpaper: Wallpaper, filter?: OrientationFilter): boolean {
  if (!filter || filter === 'all') return true;
  const ratio = wallpaper.width / wallpaper.height;

  switch (filter) {
    case 'landscape':
      return ratio > 1.05;
    case 'portrait':
      return ratio < 0.95;
    case 'ultrawide':
      return ratio >= 2.1;
    case 'square':
      return ratio >= 0.95 && ratio <= 1.05;
    default:
      return true;
  }
}

/**
 * Checks if wallpaper satisfies strict resolution filter
 * Never labels small images as 4K!
 */
export function matchesResolution(wallpaper: Wallpaper, filter?: ResolutionFilter): boolean {
  if (!filter || filter === 'all') return true;
  const { width, height } = wallpaper;
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  const isLandscape = width >= height;

  switch (filter) {
    case '8k':
      // 8K UHD landscape: at least 7680x4320 (or minDim >= 4320)
      return isLandscape ? (width >= 7680 && height >= 4320) : (height >= 7680 && width >= 4320);

    case '4k':
      // 4K UHD landscape: at least 3840x2160
      // 4K portrait: at least 2160x3840
      // For other ratios: total pixels >= 3840*2160 = 8,294,400 or minDim >= 2160
      if (isLandscape) {
        return width >= 3840 && height >= 2160;
      } else {
        return height >= 3840 && width >= 2160;
      }

    case '2k':
      // 2K/QHD landscape: at least 2560x1440
      if (isLandscape) {
        return width >= 2560 && height >= 1440;
      } else {
        return height >= 2560 && width >= 1440;
      }

    case '1080p':
      // 1080p landscape: at least 1920x1080
      if (isLandscape) {
        return width >= 1920 && height >= 1080;
      } else {
        return height >= 1920 && width >= 1080;
      }

    default:
      return true;
  }
}

/**
 * Checks if wallpaper satisfies aspect ratio filter
 */
export function matchesAspectRatio(wallpaper: Wallpaper, filter?: AspectRatioFilter): boolean {
  if (!filter || filter === 'all') return true;
  const ratio = wallpaper.width / wallpaper.height;

  switch (filter) {
    case '16:9':
      return Math.abs(ratio - 16 / 9) <= 0.08;
    case '16:10':
      return Math.abs(ratio - 16 / 10) <= 0.06;
    case '21:9':
      return Math.abs(ratio - 21 / 9) <= 0.12;
    case '32:9':
      return Math.abs(ratio - 32 / 9) <= 0.2;
    case '9:16':
      return Math.abs(ratio - 9 / 16) <= 0.05;
    case '9:19.5':
      return Math.abs(ratio - 9 / 19.5) <= 0.05;
    case '1:1':
      return Math.abs(ratio - 1) <= 0.06;
    default:
      return true;
  }
}
