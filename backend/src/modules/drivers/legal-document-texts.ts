/**
 * Taksi huquqiy hujjatlari (VMQ 200) nomlari va izohlari — UZ (migratsiya 025
 * bilan bir xil) va RU. `GET /drivers/me/verification` va `GET
 * /drivers/me/legal` `Accept-Language: ru` bo'lsa ruscha matnni beradi; xato
 * lug'ati (`common/i18n/error-catalogue.ts`) ham nomlarni shu yerdan oladi.
 */
export interface LegalDocumentText {
  label: string;
  hint: string;
  ru: { label: string; hint: string };
}

export const LEGAL_DOCUMENT_TEXTS: Readonly<Record<string, LegalDocumentText>> = {
  taxi_licence: {
    label: 'Taksi litsenziya varaqasi',
    hint: "Litsenziya varaqasi (hudud va amal qilish muddati ko'rinsin)",
    ru: {
      label: 'Лицензионная карточка такси',
      hint: 'Лицензионная карточка (должны быть видны регион и срок действия)',
    },
  },
  medical_check: {
    label: "Tibbiy ko'rik ma'lumotnomasi",
    hint: "Yillik tibbiy ko'rikdan o'tganlik hujjati",
    ru: { label: 'Справка о медосмотре', hint: 'Документ о прохождении ежегодного медосмотра' },
  },
  carrier_insurance: {
    label: "Tashuvchi javobgarlik sug'urtasi",
    hint: "Yo'lovchi tashuvchining fuqarolik javobgarligi polisi",
    ru: {
      label: 'Страхование ответственности перевозчика',
      hint: 'Полис гражданской ответственности перевозчика пассажиров',
    },
  },
  tech_inspection: {
    label: "Texnik ko'rik",
    hint: "Yillik texnik ko'rikdan o'tganlik talon/dalolatnomasi",
    ru: { label: 'Технический осмотр', hint: 'Талон/акт о прохождении ежегодного техосмотра' },
  },
};

/** Tekshiruv elementining nomi/izohi tanlangan tilda (faqat shu 4 ta hujjat uchun). */
export function localizeLegalDocument<T extends { code: string; label: string; hint?: string | null }>(
  item: T,
  language: 'uz' | 'ru',
): T {
  const text = LEGAL_DOCUMENT_TEXTS[item.code];
  if (!text || language !== 'ru') return item;
  return {
    ...item,
    label: text.ru.label,
    ...(item.hint !== undefined ? { hint: text.ru.hint } : {}),
  };
}
