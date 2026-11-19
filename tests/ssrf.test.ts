import { describe, it, expect } from 'vitest';
import { isAllowedUrl } from '@/worker/security/ssrf';

describe('SSRF Protection & URL Allowlist', () => {
  it('should allow valid URLs from authorized providers', () => {
    expect(isAllowedUrl('https://w.wallhaven.cc/full/gp/wallhaven-gpl8d3.jpg')).toBe(true);
    expect(isAllowedUrl('https://th.wallhaven.cc/lg/gp/gpl8d3.jpg')).toBe(true);
    expect(isAllowedUrl('https://konachan.net/image/test.jpg')).toBe(true);
    expect(isAllowedUrl('https://safebooru.donmai.us/posts.json')).toBe(true);
    expect(isAllowedUrl('https://safebooru.org/images/3930/test.jpg')).toBe(true);
    expect(isAllowedUrl('https://files.yande.re/image/test.png')).toBe(true);
  });

  it('should block local loopback, private IPs, and AWS/Cloud metadata', () => {
    expect(isAllowedUrl('http://localhost:8080/test.png')).toBe(false);
    expect(isAllowedUrl('http://127.0.0.1:8787/secrets')).toBe(false);
    expect(isAllowedUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedUrl('http://192.168.1.1/admin')).toBe(false);
    expect(isAllowedUrl('http://10.0.0.1/internal')).toBe(false);
    expect(isAllowedUrl('http://172.16.0.1/')).toBe(false);
    expect(isAllowedUrl('http://service.internal/')).toBe(false);
  });

  it('should block non-whitelisted external domains', () => {
    expect(isAllowedUrl('https://evil-hacker.com/malware.exe')).toBe(false);
    expect(isAllowedUrl('https://random-site.xyz/image.jpg')).toBe(false);
  });

  it('should reject invalid or non-http protocols', () => {
    expect(isAllowedUrl('ftp://wallhaven.cc/file.jpg')).toBe(false);
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedUrl('not-a-url')).toBe(false);
  });
});
