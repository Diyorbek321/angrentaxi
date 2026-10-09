/**
 * Naqd nizoni yopish izohi — backend `ResolveCashDisputeDto` bilan bir xil
 * chegaralar (3–500 belgi). Panelda oldindan tekshiriladi, shunda dispetcher
 * server xatosini emas, aniq sababni ko'radi.
 */
export const RESOLUTION_MIN = 3;
export const RESOLUTION_MAX = 500;

/** Xato matni yoki `null` (izoh yaroqli). */
export function validateResolution(value: string): string | null {
  const text = value.trim();
  if (text.length < RESOLUTION_MIN) return 'Nizo qanday hal qilinganini yozing';
  if (text.length > RESOLUTION_MAX) return `Izoh ${RESOLUTION_MAX} belgidan oshmasin`;
  return null;
}
