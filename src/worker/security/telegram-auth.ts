export interface ValidatedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

/**
 * Validates Telegram WebApp initData string using Web Crypto HMAC-SHA-256
 * @param initData Raw initData query string from Telegram.WebApp.initData
 * @param botToken Bot token from environment
 * @param maxAgeSeconds Maximum allowed age for auth_date (default 86400 = 24h)
 */
export async function validateTelegramWebAppData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): Promise<{ valid: boolean; user?: ValidatedTelegramUser; error?: string }> {
  if (!initData || !botToken) {
    return { valid: false, error: 'Missing initData or botToken' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Missing hash parameter' };
    }

    // Verify auth_date freshness
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'Missing auth_date' };
    }
    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSeconds) {
      return { valid: false, error: 'initData has expired' };
    }

    // Collect all parameters except 'hash' and sort alphabetically
    const keys: string[] = [];
    params.forEach((_, key) => {
      if (key !== 'hash') keys.push(key);
    });
    keys.sort();

    const dataCheckString = keys.map((key) => `${key}=${params.get(key)}`).join('\n');

    // 1. Secret key = HMAC_SHA256("WebAppData", botToken)
    const encoder = new TextEncoder();
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

    // 2. Calculated hash = HMAC_SHA256(secretKeyBytes, dataCheckString)
    const secretKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const calculatedSigBytes = await crypto.subtle.sign(
      'HMAC',
      secretKey,
      encoder.encode(dataCheckString)
    );

    const calculatedHash = Array.from(new Uint8Array(calculatedSigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (calculatedHash.toLowerCase() !== hash.toLowerCase()) {
      return { valid: false, error: 'Invalid HMAC signature' };
    }

    const userStr = params.get('user');
    let user: ValidatedTelegramUser | undefined;
    if (userStr) {
      user = JSON.parse(userStr);
    }

    return { valid: true, user };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification exception' };
  }
}
