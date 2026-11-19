import { Wallpaper, ResolutionFilter, OrientationFilter, ProviderName, SortFilter } from '@/shared/types/wallpaper';

export type Language = 'vi' | 'en';

export interface Translations {
  appName: string;
  appSlogan: string;
  searchPlaceholder: string;
  trending: string;
  recommended: string;
  random: string;
  explore: string;
  favorites: string;
  settings: string;
  home: string;
  all: string;
  resolution: string;
  orientation: string;
  providers: string;
  sort: string;
  landscape: string;
  portrait: string;
  ultrawide: string;
  square: string;
  relevance: string;
  popular: string;
  newest: string;
  highestRes: string;
  downloadOriginal: string;
  directUrl: string;
  sourcePost: string;
  artistSource: string;
  artist: string;
  uploader: string;
  unspecified: string;
  fileSize: string;
  ratio: string;
  tags: string;
  noResults: string;
  tryDifferentQuery: string;
  emptyFavorites: string;
  emptyFavoritesSub: string;
  dailyWallpaper: string;
  dailyDescription: string;
  deliveryTime: string;
  language: string;
  previewModeNotice: string;
  copied: string;
  addedFavorite: string;
  removedFavorite: string;
  loadMore: string;
  loading: string;
  close: string;
  apply: string;
  reset: string;
  reverseSearch: string;
}

export const I18N: Record<Language, Translations> = {
  vi: {
    appName: 'AniWalls',
    appSlogan: 'Hình nền Anime 4K & Đa nguồn',
    searchPlaceholder: 'Tìm nhân vật, anime (vd: Furina, Miku, Frieren)...',
    trending: '🔥 Xu hướng tìm kiếm',
    recommended: '✨ Tuyển chọn chất lượng cao',
    random: '🎲 Khám phá ngẫu nhiên',
    explore: 'Khám phá',
    favorites: 'Yêu thích',
    settings: 'Cài đặt',
    home: 'Trang chủ',
    all: 'Tất cả',
    resolution: 'Độ phân giải',
    orientation: 'Chiều ảnh',
    providers: 'Nguồn ảnh',
    sort: 'Sắp xếp',
    landscape: 'Ngang (PC)',
    portrait: 'Dọc (Phone)',
    ultrawide: 'Siêu rộng (21:9)',
    square: 'Vuông (1:1)',
    relevance: 'Liên quan nhất',
    popular: 'Nổi bật nhất',
    newest: 'Mới nhất',
    highestRes: 'Độ phân giải cao',
    downloadOriginal: 'Tải ảnh gốc (Gốc 100%)',
    directUrl: 'Sao chép link ảnh',
    sourcePost: 'Mở trang nguồn',
    artistSource: 'Trang tác giả',
    artist: 'Tác giả',
    uploader: 'Người đăng',
    unspecified: 'Chưa xác định',
    fileSize: 'Dung lượng',
    ratio: 'Tỷ lệ',
    tags: 'Thẻ liên quan',
    noResults: 'Không tìm thấy hình nền phù hợp',
    tryDifferentQuery: 'Hãy thử tìm bằng từ khóa đơn giản hơn hoặc chọn nguồn khác.',
    emptyFavorites: 'Chưa có hình nền yêu thích nào',
    emptyFavoritesSub: 'Bấm biểu tượng trái tim hoặc ngôi sao trên bất kỳ hình nền nào để lưu vào đây.',
    dailyWallpaper: 'Hình nền mỗi ngày',
    dailyDescription: 'Tự động gửi 1 hình nền anime chất lượng cao đến Telegram của bạn mỗi ngày.',
    deliveryTime: 'Giờ gửi thông báo',
    language: 'Ngôn ngữ hiển thị',
    previewModeNotice: 'Đang xem trước ngoài Telegram (Dữ liệu thật).',
    copied: 'Đã sao chép link ảnh vào clipboard!',
    addedFavorite: 'Đã lưu vào danh sách yêu thích! ⭐',
    removedFavorite: 'Đã bỏ khỏi danh sách yêu thích.',
    loadMore: 'Xem thêm hình nền...',
    loading: 'Đang tải hình nền...',
    close: 'Đóng',
    apply: 'Áp dụng',
    reset: 'Đặt lại',
    reverseSearch: 'Tìm nguồn ảnh'
  },
  en: {
    appName: 'AniWalls',
    appSlogan: '4K Anime Wallpapers & Multi-Source',
    searchPlaceholder: 'Search character, anime (e.g. Furina, Miku, Frieren)...',
    trending: '🔥 Trending Searches',
    recommended: '✨ Recommended Wallpapers',
    random: '🎲 Random Discovery',
    explore: 'Explore',
    favorites: 'Favorites',
    settings: 'Settings',
    home: 'Home',
    all: 'All',
    resolution: 'Resolution',
    orientation: 'Orientation',
    providers: 'Sources',
    sort: 'Sort by',
    landscape: 'Landscape (Desktop)',
    portrait: 'Portrait (Mobile)',
    ultrawide: 'Ultrawide (21:9)',
    square: 'Square (1:1)',
    relevance: 'Most Relevant',
    popular: 'Most Popular',
    newest: 'Newest',
    highestRes: 'Highest Resolution',
    downloadOriginal: 'Download Original (Full Res)',
    directUrl: 'Copy Direct URL',
    sourcePost: 'View Source Post',
    artistSource: 'Artist Profile',
    artist: 'Artist',
    uploader: 'Uploader',
    unspecified: 'Unknown',
    fileSize: 'File Size',
    ratio: 'Aspect Ratio',
    tags: 'Tags',
    noResults: 'No wallpapers found',
    tryDifferentQuery: 'Try using simpler keywords or select more providers.',
    emptyFavorites: 'No favorites saved yet',
    emptyFavoritesSub: 'Tap the star or heart button on any wallpaper to save it here.',
    dailyWallpaper: 'Daily Wallpaper',
    dailyDescription: 'Receive a fresh anime wallpaper on Telegram every morning.',
    deliveryTime: 'Notification Time',
    language: 'Display Language',
    previewModeNotice: 'Browser preview mode (Live real data).',
    copied: 'Image link copied to clipboard!',
    addedFavorite: 'Saved to favorites! ⭐',
    removedFavorite: 'Removed from favorites.',
    loadMore: 'Load more wallpapers...',
    loading: 'Loading wallpapers...',
    close: 'Close',
    apply: 'Apply',
    reset: 'Reset',
    reverseSearch: 'Reverse Search'
  }
};
