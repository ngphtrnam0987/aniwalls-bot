const ALLOWED_HOSTS = [
  'wallhaven.cc',
  'w.wallhaven.cc',
  'th.wallhaven.cc',
  'konachan.net',
  'konachan.com',
  'safebooru.donmai.us',
  'safebooru.org',
  'yande.re',
  'files.yande.re',
  'assets.yande.re',
  'danbooru.donmai.us',
  'cdn.donmai.us',
  'tbib.org',
  'nekos.best',
  'i.pximg.net',
  'pbs.twimg.com',
  'saucenao.com',
  'api.telegram.org',
  'api.trace.moe',
  'media.trace.moe'
];

/**
 * Validates if an image/file URL is safe to fetch (SSRF prevention)
 */
export function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);

    // Require HTTPS or HTTP
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Prevent loopback, private networks, and cloud metadata
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }

    // Check allowlist
    const isAllowed = ALLOWED_HOSTS.some((allowed) => {
      if (hostname === allowed) return true;
      if (hostname.endsWith(`.${allowed}`)) return true;
      return false;
    });

    return isAllowed;
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is safe from SSRF attacks without restrictively requiring the wallpaper provider allowlist
 */
export function isSafePublicImageUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
