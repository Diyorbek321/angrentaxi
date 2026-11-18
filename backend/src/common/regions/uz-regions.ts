/**
 * O'zbekiston hududlari (ISO 3166-2:UZ) va ularning chegaradoshligi.
 *
 * Taksi litsenziyasi hudud bo'yicha beriladi; buyurtma faqat litsenziya
 * hududida va unga QO'SHNI hududlarda olinadi (docs/LEGAL-COMPLIANCE.md §6).
 *
 * ⚠️ Qo'shnichilik xaritasi geografik chegaralardan tuzilgan va yuridik
 * tekshiruvdan o'tmagan. Ishonch past juftlik: Navoiy — Qashqadaryo (qisqa
 * chegara, kiritilgan). Yurist yoki kartograf tasdiqlagach shu izohni yangilang.
 */
export const UZ_REGION_CODES = [
  'UZ-AN',
  'UZ-BU',
  'UZ-FA',
  'UZ-JI',
  'UZ-NG',
  'UZ-NW',
  'UZ-QA',
  'UZ-QR',
  'UZ-SA',
  'UZ-SI',
  'UZ-SU',
  'UZ-TK',
  'UZ-TO',
  'UZ-XO',
] as const;

export type UzRegionCode = (typeof UZ_REGION_CODES)[number];

export const UZ_REGION_NAMES: Record<UzRegionCode, { uz: string; ru: string }> = {
  'UZ-AN': { uz: 'Andijon viloyati', ru: 'Андижанская область' },
  'UZ-BU': { uz: 'Buxoro viloyati', ru: 'Бухарская область' },
  'UZ-FA': { uz: "Farg'ona viloyati", ru: 'Ферганская область' },
  'UZ-JI': { uz: 'Jizzax viloyati', ru: 'Джизакская область' },
  'UZ-NG': { uz: 'Namangan viloyati', ru: 'Наманганская область' },
  'UZ-NW': { uz: 'Navoiy viloyati', ru: 'Навоийская область' },
  'UZ-QA': { uz: 'Qashqadaryo viloyati', ru: 'Кашкадарьинская область' },
  'UZ-QR': { uz: "Qoraqalpog'iston Respublikasi", ru: 'Республика Каракалпакстан' },
  'UZ-SA': { uz: 'Samarqand viloyati', ru: 'Самаркандская область' },
  'UZ-SI': { uz: 'Sirdaryo viloyati', ru: 'Сырдарьинская область' },
  'UZ-SU': { uz: 'Surxondaryo viloyati', ru: 'Сурхандарьинская область' },
  'UZ-TK': { uz: 'Toshkent shahri', ru: 'город Ташкент' },
  'UZ-TO': { uz: 'Toshkent viloyati', ru: 'Ташкентская область' },
  'UZ-XO': { uz: 'Xorazm viloyati', ru: 'Хорезмская область' },
};

export const UZ_REGION_NEIGHBOURS: Record<UzRegionCode, readonly UzRegionCode[]> = {
  'UZ-AN': ['UZ-NG', 'UZ-FA'],
  'UZ-FA': ['UZ-AN', 'UZ-NG'],
  'UZ-NG': ['UZ-AN', 'UZ-FA', 'UZ-TO'],
  'UZ-TO': ['UZ-TK', 'UZ-SI', 'UZ-NG'],
  'UZ-TK': ['UZ-TO'],
  'UZ-SI': ['UZ-TO', 'UZ-JI'],
  'UZ-JI': ['UZ-SI', 'UZ-SA', 'UZ-NW'],
  'UZ-SA': ['UZ-JI', 'UZ-NW', 'UZ-QA'],
  'UZ-QA': ['UZ-SA', 'UZ-NW', 'UZ-BU', 'UZ-SU'],
  'UZ-SU': ['UZ-QA'],
  'UZ-NW': ['UZ-JI', 'UZ-SA', 'UZ-QA', 'UZ-BU', 'UZ-QR'],
  'UZ-BU': ['UZ-NW', 'UZ-QA', 'UZ-XO'],
  'UZ-XO': ['UZ-BU', 'UZ-QR'],
  'UZ-QR': ['UZ-XO', 'UZ-NW'],
};

export function isUzRegionCode(value: unknown): value is UzRegionCode {
  return typeof value === 'string' && (UZ_REGION_CODES as readonly string[]).includes(value);
}

/** Ildizlar apostrof va bo'shliqsiz, kichik harfda (lotin, kirill, inglizcha). */
const REGION_STEMS: ReadonlyArray<[UzRegionCode, readonly string[]]> = [
  ['UZ-AN', ['andijon', 'andijan', 'андижан']],
  ['UZ-BU', ['buxoro', 'bukhara', 'buhoro', 'бухар']],
  ['UZ-FA', ['fargona', 'fergana', 'ферган']],
  ['UZ-JI', ['jizzax', 'jizzakh', 'jizax', 'джизак']],
  ['UZ-NG', ['namangan', 'наманган']],
  ['UZ-NW', ['navoiy', 'navoi', 'навои']],
  ['UZ-QA', ['qashqadaryo', 'kashkadarya', 'кашкадар']],
  ['UZ-QR', ['qoraqalpog', 'karakalpak', 'каракалпак', 'nukus', 'нукус']],
  ['UZ-SA', ['samarqand', 'samarkand', 'самарканд']],
  ['UZ-SI', ['sirdaryo', 'syrdarya', 'сырдар', 'guliston']],
  ['UZ-SU', ['surxondaryo', 'surkhandarya', 'сурхандар', 'termiz']],
  ['UZ-XO', ['xorazm', 'khorezm', 'horazm', 'хорезм', 'urganch']],
  // Toshkent viloyati shaharlari — haydovchilar ko'pincha shaharni yozadi.
  ['UZ-TO', ['angren', 'ангрен', 'olmaliq', 'chirchiq', 'ohangaron', 'bekobod', 'yangiyol']],
];

const TASHKENT_STEMS = ['toshkent', 'tashkent', 'ташкент'];
const PROVINCE_MARKERS = ['vil', 'обл', 'region', 'province'];

/**
 * Hudud kodi yoki eski erkin matn ("Toshkent viloyati", "Ташкент", "Angren")
 * → ISO kod. Tanilmasa `null`.
 *
 * Yolg'iz "Toshkent" — shahar: viloyat bo'lsa odatda "viloyati" deb yoziladi.
 */
export function normalizeRegion(value: string | null | undefined): UzRegionCode | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (isUzRegionCode(upper)) return upper;

  const text = value.toLowerCase().replace(/[''`ʻʼ‘’]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  if (TASHKENT_STEMS.some((s) => text.includes(s))) {
    return PROVINCE_MARKERS.some((m) => text.includes(m)) ? 'UZ-TO' : 'UZ-TK';
  }
  for (const [code, stems] of REGION_STEMS) {
    if (stems.some((s) => text.includes(s))) return code;
  }
  return null;
}

/**
 * Litsenziya hududidagi haydovchi shu hududdan buyurtma ola oladimi.
 *
 * Hudud NOMA'LUM bo'lsa (haydovchi kiritmagan, matn tanilmagan yoki zakaz
 * nuqtasining shahriga hudud berilmagan) — cheklanmaydi: mahsulot qarori,
 * pilotda dispetcherlik to'xtab qolmasin. Panel bunday haydovchini belgilaydi.
 */
export function isPickupAllowedForLicence(
  licenceRegion: string | null | undefined,
  pickupRegion: string | null | undefined,
): boolean {
  const licence = normalizeRegion(licenceRegion);
  const pickup = normalizeRegion(pickupRegion);
  if (!licence || !pickup) return true;
  return licence === pickup || UZ_REGION_NEIGHBOURS[licence].includes(pickup);
}
