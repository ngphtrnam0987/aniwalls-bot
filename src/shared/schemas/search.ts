import { z } from 'zod';

export const ProviderEnum = z.enum(['wallhaven', 'konachan', 'safebooru']);
export const OrientationEnum = z.enum(['all', 'landscape', 'portrait', 'ultrawide', 'square']);
export const ResolutionEnum = z.enum(['all', '1080p', '2k', '4k', '8k']);
export const AspectRatioEnum = z.enum(['all', '16:9', '16:10', '21:9', '32:9', '9:16', '9:19.5', '1:1']);
export const SortEnum = z.enum(['relevance', 'favorites', 'newest', 'random', 'resolution']);

export const SearchQuerySchema = z.object({
  query: z.string().default(''),
  providers: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val.split(',').map((s) => s.trim());
      }
    }
    return val;
  }, z.array(ProviderEnum).default(['wallhaven', 'konachan', 'safebooru'])),
  orientation: OrientationEnum.default('all'),
  resolution: ResolutionEnum.default('all'),
  aspectRatio: AspectRatioEnum.default('all'),
  sort: SortEnum.default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sfwOnly: z.preprocess((val) => {
    if (typeof val === 'string') return val === 'true' || val === '1';
    return Boolean(val ?? true);
  }, z.boolean().default(true))
});

export const UserSettingsSchema = z.object({
  default_resolution: ResolutionEnum.default('all'),
  default_orientation: OrientationEnum.default('all'),
  selected_providers: z.array(ProviderEnum).default(['wallhaven', 'konachan', 'safebooru']),
  daily_enabled: z.boolean().default(false),
  daily_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default('09:00'),
  timezone: z.string().default('Asia/Ho_Chi_Minh')
});

export const FavoriteActionSchema = z.object({
  wallpaper_id: z.string().min(1),
  wallpaper: z.any().optional()
});
