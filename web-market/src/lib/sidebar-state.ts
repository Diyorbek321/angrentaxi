export const SIDEBAR_STORAGE_KEY = 'angren-market-sidebar';

/**
 * Xuddi tema kabi: yig'ilgan holat <html> ga GIDRATSIYADAN OLDIN yoziladi.
 * `localStorage` ni useEffect ichida o'qish har yuklanishda keng→tor
 * "sakrash" (flash) beradi; render tanasida o'qish esa hydration mismatch.
 * Shuning uchun blokirovka qiluvchi inline skript DOM'ga atribut qo'yadi,
 * kenglikni esa CSS hal qiladi (globals.css, panel-spetsifik bo'lim) —
 * React klasslari ikkala holatda ham bir xil qoladi.
 */
export const SIDEBAR_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='collapsed'){document.documentElement.setAttribute('data-sidebar','collapsed');}}catch(_){}})();`;

export function getSidebarCollapsed(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-sidebar') === 'collapsed';
}

export function setSidebarCollapsed(collapsed: boolean): void {
  const el = document.documentElement;
  if (collapsed) el.setAttribute('data-sidebar', 'collapsed');
  else el.removeAttribute('data-sidebar');
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    /* private mode — holat shu sessiya uchun baribir amal qiladi */
  }
}
