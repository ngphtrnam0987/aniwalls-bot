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
  'i.pximg.net',
  'pbs.twimg.com',
  'saucenao.com',
  'api.telegram.org'
];

/**
 * Validates if an image/file URL is safe to fetch (SSRF prevention)
 */
export function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);

    // Require HTTPS
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
