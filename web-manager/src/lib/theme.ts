export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'angren-dispatch-theme';

/**
 * Runs as a blocking inline script in <head>, before React hydrates, so the
 * correct theme class is already on <html> when the first paint happens.
 *
 * Doing this in a component instead is the trap the layout comment warns
 * about: reading localStorage during render gives one value on the server
 * (none) and another on the client, which is a hydration mismatch. Here the
 * DOM is mutated before React ever looks at it, and <html> carries
 * suppressHydrationWarning so React ignores the extra class.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var e=document.documentElement;e.classList.toggle('dark',t==='dark');e.style.colorScheme=t;}catch(_){}})();`;

/** Reads the theme that the init script (or a previous toggle) applied. */
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
    /* private mode — the theme still applies for this session */
  }
}
