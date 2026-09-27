/**
 * Pure helpers for the driver document review screen, kept apart from the page
 * so the rules (labels, what a decision must carry) are unit-tested.
 */

export type KycDocumentType = 'license_front' | 'license_back' | 'passport' | 'vehicle_registration';

export const KYC_DOCUMENT_LABEL: Record<KycDocumentType, string> = {
  license_front: 'Haydovchilik guvohnomasi (old)',
  license_back: 'Haydovchilik guvohnomasi (orqa)',
  passport: 'Pasport',
  vehicle_registration: 'Texnik pasport',
};

export function kycDocumentLabel(type: string): string {
  return KYC_DOCUMENT_LABEL[type as KycDocumentType] ?? type;
}

export type ReviewDecision =
  | { approved: true; validUntil?: string }
  | { approved: false; reason: string };

export type ReviewValidation = { ok: true; decision: ReviewDecision } | { ok: false; error: string };

/**
 * Turns the reviewer's form into a decision the backend will accept, or says
 * what is missing. Mirrors the backend rules so the reviewer sees the problem
 * before a round trip: a rejection needs a reason the driver can act on, and
 * an expiry date cannot already be in the past.
 */
export function validateReview(
  input: { approved: boolean; reason: string; validUntil: string },
  today: Date = new Date()
): ReviewValidation {
  if (!input.approved) {
    const reason = input.reason.trim();
    if (reason.length < 3) {
      return { ok: false, error: 'Rad etish sababini yozing — haydovchi nimani tuzatishni bilishi kerak' };
    }
    return { ok: true, decision: { approved: false, reason } };
  }

  if (!input.validUntil) return { ok: true, decision: { approved: true } };

  const todayIso = today.toISOString().slice(0, 10);
  if (input.validUntil < todayIso) {
    return { ok: false, error: 'Muddat o‘tgan sana bo‘lishi mumkin emas' };
  }
  return { ok: true, decision: { approved: true, validUntil: input.validUntil } };
}
