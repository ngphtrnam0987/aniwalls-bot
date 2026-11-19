import { describe, it, expect } from 'vitest';
import { validateTelegramWebAppData } from '@/worker/security/telegram-auth';

// Helper to generate valid Telegram initData for tests
async function createValidInitData(params: Record<string, string>, botToken: string): Promise<string> {
  const encoder = new TextEncoder();

  // Sort keys alphabetically
  const keys = Object.keys(params).sort();
  const dataCheckString = keys.map((k) => `${k}=${params[k]}`).join('\n');

  // Secret key = HMAC_SHA256("WebAppData", botToken)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const secretKeyBytes = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(botToken)
  );

  const secretKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBytes = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(dataCheckString)
  );

  const hash = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const searchParams = new URLSearchParams(params);
  searchParams.set('hash', hash);
  return searchParams.toString();
}

describe('Telegram WebApp initData HMAC-SHA-256 Validation', () => {
  const testBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

  it('should validate valid Telegram initData with authentic signature', async () => {
    const now = Math.floor(Date.now() / 1000);
    const userPayload = JSON.stringify({
      id: 987654321,
      first_name: 'Nam',
      username: 'nam_dev'
    });

    const initData = await createValidInitData(
      {
        auth_date: String(now),
        query_id: 'AAHdF6IQAAAAAN0XohD9w7u1',
        user: userPayload
      },
      testBotToken
    );

    const res = await validateTelegramWebAppData(initData, testBotToken);
    expect(res.valid).toBe(true);
    expect(res.user?.id).toBe(987654321);
    expect(res.user?.first_name).toBe('Nam');
    expect(res.user?.username).toBe('nam_dev');
  });

  it('should reject tampered initData hash', async () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = await createValidInitData(
      {
        auth_date: String(now),
        user: JSON.stringify({ id: 123, first_name: 'Alice' })
      },
      testBotToken
    );

    // Tamper with data
    const tampered = initData.replace('Alice', 'Bob');
    const res = await validateTelegramWebAppData(tampered, testBotToken);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Invalid HMAC signature');
  });

  it('should reject expired initData (> 24 hours old)', async () => {
    const expiredTime = Math.floor(Date.now() / 1000) - (86400 * 2); // 2 days ago
    const initData = await createValidInitData(
      {
        auth_date: String(expiredTime),
        user: JSON.stringify({ id: 123, first_name: 'Alice' })
      },
      testBotToken
    );

    const res = await validateTelegramWebAppData(initData, testBotToken);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('initData has expired');
  });

  it('should reject missing hash or missing botToken', async () => {
    const res1 = await validateTelegramWebAppData('auth_date=123', testBotToken);
    expect(res1.valid).toBe(false);

    const res2 = await validateTelegramWebAppData('', testBotToken);
    expect(res2.valid).toBe(false);

    const res3 = await validateTelegramWebAppData('hash=123', '');
    expect(res3.valid).toBe(false);
  });
});
