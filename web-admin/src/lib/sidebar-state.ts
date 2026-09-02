export const SIDEBAR_COLLAPSED_KEY = 'angren-admin-sidebar-collapsed';

/** <html> ga qo'yiladigan klass — auth skeleti kengligi CSS orqali moslashadi. */
export const SIDEBAR_COLLAPSED_CLASS = 'sidebar-collapsed';

/**
 * Xuddi THEME_INIT_SCRIPT kabi <head> da, React gidratatsiyasidan OLDIN
 * ishlaydi: saqlangan rail holatini <html> klassiga yozadi. localStorage'ni
 * useEffect'da o'qish har yuklanishda "ochiq → yig'ilgan" miltillash berardi —
 * pre-paint skript bilan birinchi chizilgan kadr ham to'g'ri kenglikda bo'ladi.
 */
export const SIDEBAR_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('${SIDEBAR_COLLAPSED_KEY}')==='1'){document.documentElement.classList.add('${SIDEBAR_COLLAPSED_CLASS}');}}catch(_){}})();`;

/** Skript (yoki oldingi toggle) qo'ygan holatni o'qiydi. */
export function getStoredSidebarCollapsed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains(SIDEBAR_COLLAPSED_CLASS);
}

export function applySidebarCollapsed(collapsed: boolean): void {
  document.documentElement.classList.toggle(SIDEBAR_COLLAPSED_CLASS, collapsed);
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* private rejim — holat shu sessiya uchun baribir qo'llanadi */
  }
}
