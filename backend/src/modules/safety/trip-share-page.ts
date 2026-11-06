import { OrderStatus } from '../../database/entities/order.entity';
import { PublicTripView, TRIP_SHARE_PAGE_REFRESH_SECONDS } from './trip-share-policy';

export type SharePageLang = 'uz' | 'ru';

const TEXT: Record<SharePageLang, Record<string, string>> = {
  uz: {
    title: 'Safar kuzatuvi',
    driver: 'Haydovchi',
    car: 'Mashina',
    to: 'Manzil',
    location: 'Joriy joylashuv',
    openMap: 'Xaritada ochish',
    noLocation: "Joylashuv hali ma'lum emas",
    expires: 'Havola amal qiladi',
    refresh: 'Sahifa har {0} soniyada yangilanadi.',
    goneTitle: 'Havola muddati tugagan',
    goneBody: 'Bu safar tugagan va kuzatuv havolasi endi ishlamaydi.',
    notFoundTitle: 'Havola topilmadi',
    notFoundBody: "Havola noto'g'ri yoki bekor qilingan.",
    [OrderStatus.ACCEPTED]: "Haydovchi yo'lda",
    [OrderStatus.ARRIVED]: 'Haydovchi yetib keldi',
    [OrderStatus.IN_PROGRESS]: 'Safar davom etmoqda',
    [OrderStatus.COMPLETED]: 'Safar tugadi',
    [OrderStatus.CANCELLED]: 'Safar bekor qilindi',
  },
  ru: {
    title: 'Отслеживание поездки',
    driver: 'Водитель',
    car: 'Автомобиль',
    to: 'Куда',
    location: 'Текущее местоположение',
    openMap: 'Открыть на карте',
    noLocation: 'Местоположение пока неизвестно',
    expires: 'Ссылка действует до',
    refresh: 'Страница обновляется каждые {0} с.',
    goneTitle: 'Срок ссылки истёк',
    goneBody: 'Поездка завершена, ссылка для отслеживания больше не работает.',
    notFoundTitle: 'Ссылка не найдена',
    notFoundBody: 'Ссылка неверна или отозвана.',
    [OrderStatus.ACCEPTED]: 'Водитель в пути',
    [OrderStatus.ARRIVED]: 'Водитель на месте',
    [OrderStatus.IN_PROGRESS]: 'Поездка идёт',
    [OrderStatus.COMPLETED]: 'Поездка завершена',
    [OrderStatus.CANCELLED]: 'Поездка отменена',
  },
};

export function pickShareLang(query?: string, acceptLanguage?: string): SharePageLang {
  if (query === 'ru' || query === 'uz') return query;
  return (acceptLanguage ?? '').trim().toLowerCase().startsWith('ru') ? 'ru' : 'uz';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(lang: SharePageLang, title: string, body: string, refresh: boolean): string {
  // JS YO'Q (helmet CSP inline skriptni to'sadi) — yangilanish meta refresh bilan.
  const meta = refresh ? `<meta http-equiv="refresh" content="${TRIP_SHARE_PAGE_REFRESH_SECONDS}">` : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">${meta}
<title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#111;background:#fff}
h1{font-size:22px;margin:0 0 4px}.status{font-size:18px;font-weight:700;color:#0a7;margin:0 0 16px}
dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0 0 16px}dt{color:#666}dd{margin:0;font-weight:600}
a{color:#0a7}.muted{color:#666;font-size:13px}
@media (prefers-color-scheme:dark){body{color:#eee;background:#111}dt,.muted{color:#aaa}}</style></head>
<body>${body}</body></html>`;
}

export function renderSharePage(lang: SharePageLang, view: PublicTripView): string {
  const t = TEXT[lang];
  const rows: string[] = [
    `<dt>${esc(t.driver)}</dt><dd>${esc(view.driverName)}</dd>`,
    `<dt>${esc(t.car)}</dt><dd>${esc([view.carModel, view.carNumber].filter(Boolean).join(' · ') || '—')}</dd>`,
  ];
  if (view.dropoffAddress) rows.push(`<dt>${esc(t.to)}</dt><dd>${esc(view.dropoffAddress)}</dd>`);
  const active = view.location !== null;
  const location = view.location
    ? `<p>${esc(t.location)}: <a rel="noopener" href="https://www.openstreetmap.org/?mlat=${view.location.lat}&amp;mlon=${view.location.lng}#map=17/${view.location.lat}/${view.location.lng}">${esc(t.openMap)}</a></p>`
    : view.expiresAt
      ? ''
      : `<p class="muted">${esc(t.noLocation)}</p>`;
  const expires = view.expiresAt
    ? `<p class="muted">${esc(t.expires)}: ${esc(new Date(view.expiresAt).toISOString().replace('T', ' ').slice(0, 16))} UTC</p>`
    : '';
  const refresh = view.expiresAt ? '' : `<p class="muted">${esc(t.refresh.replace('{0}', String(TRIP_SHARE_PAGE_REFRESH_SECONDS)))}</p>`;
  const body = `<h1>${esc(t.title)}</h1><p class="status">${esc(t[view.status] ?? view.status)}</p>
<dl>${rows.join('')}</dl>${location}${expires}${refresh}`;
  return shell(lang, t.title, body, active || !view.expiresAt);
}

export function renderShareErrorPage(lang: SharePageLang, kind: 'gone' | 'not_found'): string {
  const t = TEXT[lang];
  const title = kind === 'gone' ? t.goneTitle : t.notFoundTitle;
  const body = kind === 'gone' ? t.goneBody : t.notFoundBody;
  return shell(lang, title, `<h1>${esc(title)}</h1><p>${esc(body)}</p>`, false);
}
