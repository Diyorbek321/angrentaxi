// Sayt ikonalari — 24×24, 1.75 qalinlikdagi chiziq, `currentColor`.
// Tashqi kutubxona yo'q: har biri inline SVG bo'lib HTML ichiga tushadi.

const P = {
  doc: '<path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13.5 3v5h5M8.5 12.5h7M8.5 16h7"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z"/><path d="m8.75 12 2.25 2.25 4.25-4.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  car: '<path d="M5 16.5h14M6.5 16.5v2M17.5 16.5v2"/><path d="M4 16.5v-4l2-5.5h12l2 5.5v4z"/><circle cx="8" cy="13.25" r=".9" fill="currentColor"/><circle cx="16" cy="13.25" r=".9" fill="currentColor"/><path d="M6.6 9.5h10.8"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/><path d="m7.75 5.25 8.5 4.5"/>',
  food: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M12 7V4M8.5 7.5 7.5 5M15.5 7.5l1-2.5"/><path d="M9 21h6"/>',
  bag: '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  truck: '<path d="M2.5 6.5h11v10h-11zM13.5 10h4l3 3.5v3h-7"/><circle cx="6.5" cy="17.5" r="1.75"/><circle cx="17" cy="17.5" r="1.75"/>',
  route: '<circle cx="6" cy="18" r="2.25"/><circle cx="18" cy="6" r="2.25"/><path d="M8.25 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.75"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M5.75 16a3.5 3.5 0 0 1 6.5 0M14.5 10h3.5M14.5 13.5h3.5"/>',
  sos: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z"/><path d="M12 8v4.5M12 15.75v.25"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.25 10.8 7.5-4M8.25 13.2l7.5 4"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.25a11 11 0 0 0 6.25 6.25L16.5 13l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.9 12.1 8.6-8.6M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  nav: '<path d="M20.5 3.5 3.5 10.75l7 2.75 2.75 7z"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v2.5"/><rect x="4" y="7.5" width="16.5" height="12" rx="2.5"/><path d="M16 13.5h1.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  store: '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.65 2.65 0 0 0 5.33 0 2.65 2.65 0 0 0 5.34 0 2.65 2.65 0 0 0 5.33 0"/><path d="M5.5 12v8h13v-8M10 20v-4.5h4V20"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="5" cy="6.5" r=".9" fill="currentColor"/><circle cx="5" cy="12" r=".9" fill="currentColor"/><circle cx="5" cy="17.5" r=".9" fill="currentColor"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5 9 9.5h5.5l4 7M9 9.5 7.75 6.5H6M14.5 9.5 12 16.5H5.5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.75 6.5 8.25 6.25 8.25-6.25"/>',
  send: '<path d="M21 3.5 3 10.75l6.75 2.5L12.25 20z"/><path d="m9.75 13.25 5-5"/>',
  play: '<path d="M5 3.75v16.5a.75.75 0 0 0 1.13.65L20.5 12.65a.75.75 0 0 0 0-1.3L6.13 3.1A.75.75 0 0 0 5 3.75z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5S9.6 6.1 12 3.5z"/>',
};

export function icon(name, cls = 'ic') {
  const body = P[name];
  if (!body) throw new Error(`Noma'lum ikona: ${name}`);
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
