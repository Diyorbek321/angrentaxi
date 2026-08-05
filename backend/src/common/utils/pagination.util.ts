/**
 * Normalises a caller-supplied page size into a safe LIMIT.
 *
 * Used by endpoints that gained pagination after clients were already calling
 * them without any parameters: an absent/garbage value falls back to the
 * endpoint's default rather than erroring, so existing callers keep working,
 * while an over-large value is clamped instead of letting the caller lift the
 * cap the pagination was added to enforce.
 */
export function clampPageSize(
  requested: number | undefined,
  defaultSize: number,
  maxSize: number,
): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) {
    return defaultSize;
  }
  return Math.min(Math.floor(requested), maxSize);
}
