/** Voronka qaysi ilovadan. Hozircha faqat yo'lovchi ilovasi yuboradi. */
export const ANALYTICS_APPS = ['passenger', 'driver'] as const;
export type AnalyticsApp = (typeof ANALYTICS_APPS)[number];

/**
 * Ilova yuboradigan bosqichlar — tartib voronka tartibi. Ro'yxatdan
 * tashqaridagi nom 400: jadval ixtiyoriy matn bilan to'lib ketmasin.
 */
export const APP_FUNNEL_STEPS = [
  'app_open',
  'destination_selected',
  'price_shown',
  'order_requested',
] as const;
export type AppFunnelStep = (typeof APP_FUNNEL_STEPS)[number];

/** Server `orders` jadvalidan hisoblanadigan (taksi) bosqichlar. */
export const SERVER_FUNNEL_STEPS = ['order_created', 'driver_assigned', 'trip_completed'] as const;
export type ServerFunnelStep = (typeof SERVER_FUNNEL_STEPS)[number];

export const MAX_FUNNEL_RANGE_DAYS = 92;
