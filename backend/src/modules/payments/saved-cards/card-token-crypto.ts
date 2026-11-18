import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Provayder karta tokenini saqlash uchun AES-256-GCM.
 *
 * Token — pul yechish huquqi: baza sizib chiqsa ham ochiq token
 * qolmasligi kerak. Kalit (`CARD_TOKEN_ENCRYPTION_KEY`, 64 belgi hex =
 * 32 bayt) faqat muhitda. Kalit yo'q/noto'g'ri — fail closed: xato,
 * hech qachon ochiq matn saqlanmaydi.
 *
 * Format: `iv:tag:ciphertext` (hex). IV har safar tasodifiy, shuning uchun
 * dublikatni aniqlash `fingerprintCardToken` (sha256) orqali.
 */
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_HEX_PATTERN = /^[0-9a-fA-F]{64}$/;

function keyFromHex(keyHex: string | undefined): Buffer {
  if (!keyHex || !KEY_HEX_PATTERN.test(keyHex)) {
    throw new Error('CARD_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

/** Kalit to'g'ri formatdami — konfiguratsiya tekshiruvi uchun (xato otmaydi). */
export function isValidCardTokenKey(keyHex: string | undefined): boolean {
  return Boolean(keyHex && KEY_HEX_PATTERN.test(keyHex));
}

export function encryptCardToken(raw: string, keyHex: string | undefined): string {
  if (!raw) throw new Error('Card token is empty');
  const key = keyFromHex(keyHex);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decryptCardToken(stored: string, keyHex: string | undefined): string {
  const key = keyFromHex(keyHex);
  const parts = stored.split(':');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error('Stored card token is malformed');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

export function fingerprintCardToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
