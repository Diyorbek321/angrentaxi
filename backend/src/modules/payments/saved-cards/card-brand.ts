import { CardBrand } from '../../../database/entities/saved-card.entity';

/**
 * Niqoblangan raqamning boshidan karta turi (faqat ko'rsatish uchun).
 * 8600 — Uzcard, 9860 — Humo, 4 — Visa, 51–55 / 2221–2720 — Mastercard.
 * 5614 — Uzcard/Mastercard ko'prik kartasi, ilovada Uzcard deb ko'rinadi.
 */
export function detectCardBrand(maskedPan: string): CardBrand {
  const digits = maskedPan.replace(/\D/g, '');
  if (digits.startsWith('8600') || digits.startsWith('5614')) return 'uzcard';
  if (digits.startsWith('9860')) return 'humo';
  if (digits.startsWith('4')) return 'visa';
  const two = Number(digits.slice(0, 2));
  const four = Number(digits.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard';
  return 'unknown';
}

/** `860006******6311` → `8600 **** **** 6311` (oxirgi 4 raqam — ko'rsatish uchun). */
export function formatMaskedPan(raw: string): string {
  const compact = raw.replace(/\s/g, '');
  const head = compact.slice(0, 4);
  const tail = compact.slice(-4);
  return `${head} **** **** ${tail}`;
}
