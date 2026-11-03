import { UserRole } from '../../database/entities/user.entity';

/**
 * Huquqiy hujjatlar va ularning JORIY versiyasi (docs/INCIDENT-POLICY.md,
 * 6-bosqich; migratsiya 048).
 *
 * ⚠️ Matn MAZMUNAN o'zgarsa (yangi qoida, raqam, majburiyat) — versiyani
 * oshiring va `summary` ga nima o'zgarganini yozing: shu lahzadan barcha
 * foydalanuvchilar ilovani ochganda qayta rozilik so'raladi, haydovchi esa
 * qayta qabul qilmaguncha onlayn chiqa olmaydi. Imlo tuzatish — versiya
 * oshirilmaydi.
 *
 * Format: `YYYY-MM-DD.N` (sana + shu kundagi tartib raqami).
 */
export const LEGAL_DOCUMENTS = ['terms', 'driver-terms', 'vendor-terms', 'privacy'] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export interface LegalVersionInfo {
  version: string;
  /** Qisqa "nima o'zgardi" — rozilik oynasida ko'rsatiladi. */
  summary: { uz: string; ru: string };
}

export const LEGAL_VERSIONS: Readonly<Record<LegalDocument, LegalVersionInfo>> = {
  terms: {
    version: '2026-11-03.1',
    summary: {
      uz: "Birinchi tahrir: platforma vositachi; narx, to'lov, bekor qilish va kelmaslik jarimalari; posilka qiymati va kompensatsiya chegarasi; taqiqlangan narsalar; shikoyat tartibi.",
      ru: 'Первая редакция: платформа — посредник; цена, оплата, штрафы за отмену и неявку; объявленная ценность посылки и предел компенсации; запрещённые вложения; порядок жалоб.',
    },
  },
  'driver-terms': {
    version: '2026-11-03.1',
    summary: {
      uz: "Birinchi tahrir: komissiya, naqd pul tartibi, yuk uchun javobgarlik, xulq kodeksi, jarima zinapoyasi, to'xtatish va e'tiroz tartibi.",
      ru: 'Первая редакция: комиссия, порядок работы с наличными, ответственность за груз, кодекс поведения, лестница санкций, приостановка и обжалование.',
    },
  },
  'vendor-terms': {
    version: '2026-11-03.1',
    summary: {
      uz: "Birinchi tahrir: komissiya, tovar sifati, rad etish va qaytarish, kartali buyurtma faqat to'langandan keyin.",
      ru: 'Первая редакция: комиссия, качество товара, отказ и возврат, заказ с оплатой картой — только после оплаты.',
    },
  },
  privacy: {
    version: '2026-10-29.1',
    summary: {
      uz: "Qanday ma'lumot yig'amiz, kimga beriladi, qancha saqlanadi va hisobni qanday o'chirish mumkin.",
      ru: 'Какие данные мы собираем, кому передаём, сколько храним и как удалить аккаунт.',
    },
  },
};

/** Rol bo'yicha rozilik talab qilinadigan hujjatlar (tartib — oynada ko'rsatish tartibi). */
export function requiredLegalDocuments(role: UserRole): LegalDocument[] {
  switch (role) {
    case UserRole.PASSENGER:
      return ['terms', 'privacy'];
    case UserRole.DRIVER:
      return ['driver-terms', 'privacy'];
    // Sotuvchi ham yo'lovchi ilovasida taksi chaqira oladi (USER_ROLES_PASSENGER_APP).
    case UserRole.RESTAURANT:
    case UserRole.MARKET:
      return ['vendor-terms', 'terms', 'privacy'];
    // Xodimlar — mehnat/xizmat shartnomasi bilan, ilova ofertasi bilan emas.
    default:
      return [];
  }
}

export interface LegalDocumentState {
  document: LegalDocument;
  version: string;
  acceptedVersion: string | null;
  mustAccept: boolean;
  summary: { uz: string; ru: string };
}

export interface LegalStatus {
  mustAccept: boolean;
  documents: LegalDocumentState[];
}

/**
 * Sof funksiya: rol + har hujjat bo'yicha OXIRGI qabul qilingan versiya →
 * nimani (qayta) qabul qilish kerak. Versiya aniq tenglik bilan solishtiriladi:
 * joriydan boshqa har qanday versiya — eskirgan.
 */
export function legalDocumentStatus(role: UserRole, accepted: ReadonlyMap<string, string>): LegalStatus {
  const documents = requiredLegalDocuments(role).map((document) => {
    const info = LEGAL_VERSIONS[document];
    const acceptedVersion = accepted.get(document) ?? null;
    return {
      document,
      version: info.version,
      acceptedVersion,
      mustAccept: acceptedVersion !== info.version,
      summary: info.summary,
    };
  });
  return { mustAccept: documents.some((d) => d.mustAccept), documents };
}

export function isLegalDocument(value: unknown): value is LegalDocument {
  return typeof value === 'string' && (LEGAL_DOCUMENTS as readonly string[]).includes(value);
}
