import type {
  IncidentOutcomeType,
  IncidentPartyRole,
  IncidentVertical,
} from '../../database/entities/incident.entity';
import type { IncidentSettings } from '../settings/incident-settings';

/**
 * Shikoyat qoidalari — sof funksiyalar (docs/INCIDENT-POLICY.md §3).
 * Servislar faqat shu yerdagi qoidalarga tayanadi, shunda mobil/panel
 * ro'yxatlari bilan bitta manba bo'ladi.
 */

/** Sabab ro'yxati (§3) + ikki tizim toifasi (foydalanuvchi tanlamaydi). */
export const INCIDENT_CATEGORIES = [
  'rude',
  'dangerous_driving',
  'detour',
  'overcharge',
  'smoking',
  'dirty_car',
  'harassment',
  'safety',
  'drunk_passenger',
  'vehicle_damage',
  'did_not_pay',
  'no_show',
  'damaged_goods',
  'wrong_items',
  'cold_food',
  'lost_cargo',
  'other',
  'rating_signal',
  'low_rating',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/** Tizim toifalari — `POST /incidents` ularni qabul qilmaydi. */
export const SYSTEM_CATEGORIES: readonly IncidentCategory[] = ['rating_signal', 'low_rating'];

/**
 * Bezorilik / ta'qib / xavfsizlik — subyekt DARHOL to'xtatiladi, admin
 * qaror qiladi (§3 jadvalidagi yagona avtomatik amal).
 */
export const SAFETY_CATEGORIES: readonly IncidentCategory[] = ['harassment', 'safety'];

/** Xabarchi tomoni: kim kim haqida yozadi. */
export type ReporterSide = 'customer' | 'driver' | 'vendor';

/** Har tomon tanlay oladigan toifalar (ilovadagi ro'yxat ham shu). */
export const CATEGORIES_BY_SIDE: Record<ReporterSide, readonly IncidentCategory[]> = {
  customer: [
    'rude',
    'dangerous_driving',
    'detour',
    'overcharge',
    'smoking',
    'dirty_car',
    'harassment',
    'safety',
    'damaged_goods',
    'wrong_items',
    'cold_food',
    'lost_cargo',
    'other',
  ],
  driver: ['drunk_passenger', 'vehicle_damage', 'did_not_pay', 'no_show', 'rude', 'harassment', 'safety', 'other'],
  vendor: ['rude', 'no_show', 'did_not_pay', 'damaged_goods', 'harassment', 'safety', 'other'],
};

/** Ovqat/marketda sotuvchiga tegishli toifalar (subyekt — sotuvchi egasi). */
export const VENDOR_FAULT_CATEGORIES: readonly IncidentCategory[] = ['wrong_items', 'cold_food'];

/** Ovqat/market buyurtmasida subyekt: kuryer, sotuvchi yoki mijoz. */
export type IncidentSubjectChoice = 'courier' | 'vendor' | 'customer';

export function isUserCategory(raw: unknown): raw is IncidentCategory {
  return (
    typeof raw === 'string' &&
    (INCIDENT_CATEGORIES as readonly string[]).includes(raw) &&
    !SYSTEM_CATEGORIES.includes(raw as IncidentCategory)
  );
}

export function categoryAllowedFor(side: ReporterSide, category: IncidentCategory): boolean {
  return CATEGORIES_BY_SIDE[side].includes(category);
}

export function isSafetyCategory(category: string): boolean {
  return SAFETY_CATEGORIES.includes(category as IncidentCategory);
}

/**
 * Mijoz ovqat/market buyurtmasida kim haqida yozyapti. Aniq tanlanmasa —
 * toifadan: noto'g'ri/kam tovar va sovuq ovqat — sotuvchi, qolgani — kuryer.
 */
export function customerSubjectChoice(
  category: IncidentCategory,
  explicit?: IncidentSubjectChoice,
): 'courier' | 'vendor' {
  if (explicit === 'courier' || explicit === 'vendor') return explicit;
  return VENDOR_FAULT_CATEGORIES.includes(category) ? 'vendor' : 'courier';
}

/** Muddat: buyurtma tugaganidan `windowDays` kun ichida. Tugamagan — `false`. */
export function withinReportWindow(endedAt: Date | null, now: Date, windowDays: number): boolean {
  if (!endedAt) return false;
  return now.getTime() - new Date(endedAt).getTime() <= windowDays * 86_400_000;
}

/** Jarima zinapoyasi taklifi (§3). Tizim faqat TAKLIF qiladi — menejer hal qiladi. */
export type StrikeSuggestion = 'none' | 'warning' | 'suspension' | 'escalate_block';

/**
 * `confirmedCount` — oynadagi tasdiqlangan shikoyatlar soni, SHU hodisa
 * ham tasdiqlansa (ya'ni +1 bilan) chaqiriladi.
 */
export function strikeSuggestion(
  confirmedCount: number,
  s: Pick<IncidentSettings, 'strikeWarningAt' | 'strikeSuspensionAt' | 'strikeBlockAt'>,
): StrikeSuggestion {
  if (confirmedCount >= s.strikeBlockAt) return 'escalate_block';
  if (confirmedCount >= s.strikeSuspensionAt) return 'suspension';
  if (confirmedCount >= s.strikeWarningAt) return 'warning';
  return 'none';
}

/** Natija kirishi (DTO'dan). */
export interface OutcomeInput {
  type: IncidentOutcomeType;
  amount?: number;
  days?: number;
  refundMethod?: 'wallet' | 'card';
}

export interface OutcomeContext {
  isAdmin: boolean;
  /** Menejerda `drivers_finance` ruxsati bor (pul natijalari uchun). */
  canMoveMoney: boolean;
  subjectRole: IncidentPartyRole | null;
  hasSubject: boolean;
  /** Mijoz (yo'lovchi) — qaytarish/jarima uchun. */
  hasCustomer: boolean;
  /** Haydovchi/kuryer — kompensatsiya uchun. */
  hasDriver: boolean;
  vertical: IncidentVertical | null;
  /** Bir martada pul chegarasi: menejer — `manualAdjustmentManagerLimit`, admin — mutlaq. */
  amountLimit: number;
  maxSuspensionDays: number;
}

export interface OutcomeProblem {
  code: string;
  message: string;
}

const MONEY_OUTCOMES: readonly IncidentOutcomeType[] = ['refund', 'compensation', 'penalty'];

/**
 * Natijalar ro'yxati qoidaga mosmi — barcha muammolar birdaniga (`reasons[]`).
 * Bo'sh ro'yxat = hammasi to'g'ri.
 */
export function validateOutcomes(outcomes: readonly OutcomeInput[], ctx: OutcomeContext): OutcomeProblem[] {
  const problems: OutcomeProblem[] = [];
  const types = outcomes.map((o) => o.type);
  if (types.includes('no_action') && types.length > 1) {
    problems.push({ code: 'no_action_alone', message: "«Harakatsiz» boshqa natija bilan birga bo'lmaydi" });
  }
  if (new Set(types).size !== types.length) {
    problems.push({ code: 'duplicate', message: 'Har bir natija turi bir marta tanlanadi' });
  }
  for (const o of outcomes) {
    const needsSubject = o.type === 'warning' || o.type === 'suspension' || o.type === 'block';
    if (needsSubject && !ctx.hasSubject) {
      problems.push({ code: 'no_subject', message: "Bu hodisada shikoyat qilingan shaxs yo'q" });
    }
    if (o.type === 'block' && !ctx.isAdmin) {
      problems.push({ code: 'block_admin_only', message: 'Bloklashni faqat admin qiladi' });
    }
    if (o.type === 'suspension') {
      if (ctx.subjectRole !== 'driver' && ctx.subjectRole !== 'passenger') {
        problems.push({ code: 'suspension_role', message: "Faqat haydovchi yoki yo'lovchini to'xtatish mumkin" });
      }
      const days = o.days ?? 0;
      if (!Number.isInteger(days) || days < 1 || days > ctx.maxSuspensionDays) {
        problems.push({ code: 'suspension_days', message: `To'xtatish 1–${ctx.maxSuspensionDays} kun bo'lishi kerak` });
      }
    }
    if (MONEY_OUTCOMES.includes(o.type)) {
      if (!ctx.isAdmin && !ctx.canMoveMoney) {
        problems.push({ code: 'money_permission', message: "Pul natijasi uchun «Haydovchi moliyasi» ruxsati kerak" });
      }
      const amount = o.amount ?? 0;
      if (!Number.isInteger(amount) || amount <= 0) {
        problems.push({ code: 'amount_invalid', message: "Summa musbat butun son bo'lishi kerak" });
      } else if (amount > ctx.amountLimit) {
        problems.push({ code: 'amount_limit', message: `Summa ${ctx.amountLimit} so'mdan oshmasligi kerak` });
      }
    }
    if (o.type === 'refund') {
      if (!ctx.hasCustomer) problems.push({ code: 'no_customer', message: "Qaytarish uchun mijoz yo'q" });
      if (o.refundMethod === 'card' && ctx.vertical !== 'food' && ctx.vertical !== 'market') {
        problems.push({ code: 'card_refund_vertical', message: 'Kartaga qaytarish faqat ovqat/market buyurtmasida' });
      }
    }
    if (o.type === 'compensation' && !ctx.hasDriver) {
      problems.push({ code: 'no_driver', message: "Kompensatsiya uchun haydovchi yo'q" });
    }
    if (o.type === 'penalty' && ctx.subjectRole !== 'driver' && ctx.subjectRole !== 'passenger') {
      problems.push({ code: 'penalty_role', message: "Jarima faqat haydovchi yoki yo'lovchiga" });
    }
  }
  return problems;
}

/** Natija subyektga qarshimi (e'tiroz huquqi shundan). */
export function hasSanctionAgainstSubject(outcomes: ReadonlyArray<{ type: IncidentOutcomeType }>): boolean {
  return outcomes.some((o) => o.type === 'warning' || o.type === 'suspension' || o.type === 'block' || o.type === 'penalty');
}
