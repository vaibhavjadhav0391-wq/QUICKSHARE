import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically random URL-safe token.
 * Uses Node.js crypto.randomBytes which is CSPRNG-backed.
 * @param bytes - Number of random bytes (default 24 → 32-char base64url)
 */
export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Generates a short human-readable fallback code (6 alphanumeric characters).
 * Used when QR scanning isn't available.
 */
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (O,0,I,1)
  let code = '';
  const randomBuf = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[randomBuf[i] % chars.length];
  }
  return code;
}
