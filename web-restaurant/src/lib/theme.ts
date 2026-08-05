export type Theme = 'light' | 'dark';

/** Har bir panel o'z kalitini ishlatadi — bitta domenda ular to'qnashmaydi. */
export const THEME_STORAGE_KEY = 'angren-restaurant-theme';

/**
 * <head> ichida, React hidratsiyasidan OLDIN bloklab ishlaydigan skript.
 * Birinchi bo'yashda <html> da to'g'ri tema klassi turadi.
 *
 * Buni komponent ichida qilish — tuzoq: render paytida localStorage o'qilsa,
 * serverda bir qiymat (yo'q), klientda boshqasi chiqadi va hidratsiya
 * mos kelmaydi. Bu yerda DOM React unga qaramasidan oldin o'zgartiriladi,
 * <html> esa `suppressHydrationWarning` bilan belgilanadi.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var e=document.documentElement;e.classList.toggle('dark',t==='dark');e.style.colorScheme=t;}catch(_){}})();`;

/** Init skripti (yoki oldingi almashtirish) qo'ygan temani o'qiydi. */
export function getAppliedTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  el.classList.toggle('dark', theme === 'dark');
  el.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private rejim — tema shu sessiya uchun baribir qo'llanadi */
  }
}
