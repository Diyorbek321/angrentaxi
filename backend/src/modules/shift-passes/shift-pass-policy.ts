import { ERROR_CODES, codedBadRequest, codedConflict } from '../../common/errors/coded-error';

/**
 * Smena (kunlik obuna) qoidalari — sof funksiyalar.
 *
 * Biznes qarori: haydovchi har safar uchun komissiya (standart 10%) YOKI
 * kunlik smena (standart 25 000 so'm / 24 soat) ni tanlaydi. Smena davomida
 * qamralgan xizmat turlaridagi safarlardan komissiya olinmaydi
 * (`orders/commission-policy.ts`), 1% soliq esa baribir ushlanadi.
 */
export type ShiftPassStatus = 'active' | 'expired' | 'cancelled';

export interface ShiftPassLike {
  startsAt: Date;
  endsAt: Date;
  status: ShiftPassStatus;
  serviceTypes: readonly string[];
}

export interface ShiftPassComparison {
  periodDays: number;
  /** Davr ichida qamraladigan xizmatlar uchun to'langan komissiya, so'm. */
  commissionPaid: number;
  /** Shu xizmatlarda kamida bitta safar yakunlangan kunlar soni. */
  workingDays: number;
  /** Har ish kuniga bitta smena olinganda jami narx, so'm. */
  passCost: number;
  cheaperOption: 'shift_pass' | 'commission' | 'equal';
  /** Arzonroq variant bilan tejaladigan summa, so'm. */
  savings: number;
}

const HOUR_MS = 60 * 60 * 1000;

export function shiftPassWindow(now: Date, durationHours: number): { startsAt: Date; endsAt: Date } {
  return { startsAt: now, endsAt: new Date(now.getTime() + durationHours * HOUR_MS) };
}

/** Yarim ochiq oraliq: `startsAt <= at < endsAt`. */
export function shiftPassCovers(pass: ShiftPassLike, serviceType: string, at: Date): boolean {
  if (pass.status === 'cancelled') return false;
  const t = at.getTime();
  return (
    pass.startsAt.getTime() <= t &&
    t < pass.endsAt.getTime() &&
    pass.serviceTypes.includes(serviceType)
  );
}

/** Bazadagi `active` muddati o'tgan bo'lsa ham `expired` deb o'qiladi. */
export function effectiveShiftPassStatus(pass: ShiftPassLike, now: Date): ShiftPassStatus {
  if (pass.status !== 'active') return pass.status;
  return now.getTime() >= pass.endsAt.getTime() ? 'expired' : 'active';
}

export function assertCanBuyShiftPass(input: {
  enabled: boolean;
  price: number;
  balance: number;
  hasActivePass: boolean;
}): void {
  if (!input.enabled) {
    throw codedBadRequest(ERROR_CODES.shiftPassDisabled, 'Smena hozircha mavjud emas');
  }
  if (input.hasActivePass) {
    throw codedConflict(ERROR_CODES.shiftPassActive, 'Sizda faol smena bor — u tugagach yangisini oling');
  }
  if (input.balance < input.price) {
    throw codedBadRequest(
      ERROR_CODES.shiftPassInsufficientBalance,
      `Hamyonda mablag' yetarli emas: smena narxi ${formatSom(input.price)} so'm, ` +
        `balansingiz ${formatSom(input.balance)} so'm. Avval hamyonni to'ldiring.`,
      { details: { price: input.price, balance: input.balance } },
    );
  }
}

/**
 * Oddiy taqqoslash: o'tgan davrda to'langan komissiya va har ish kuniga bitta
 * smena olinganda ketadigan summa. Taxminiy — smena 24 soatdan qisqa bo'lsa
 * yoki ish kuni ikki smenaga bo'linsa, haqiqiy narx farq qiladi.
 */
export function compareShiftPassWithCommission(input: {
  periodDays: number;
  commissionPaid: number;
  workingDays: number;
  passPrice: number;
}): ShiftPassComparison {
  const passCost = input.workingDays * input.passPrice;
  const diff = input.commissionPaid - passCost;
  const cheaperOption = diff > 0 ? 'shift_pass' : diff < 0 ? 'commission' : 'equal';
  return {
    periodDays: input.periodDays,
    commissionPaid: input.commissionPaid,
    workingDays: input.workingDays,
    passCost,
    cheaperOption,
    savings: Math.abs(diff),
  };
}

function formatSom(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Admin smenani bekor qilganda qaytariladigan summa (docs/LEGAL-COMPLIANCE.md §15):
 *
 *   refund = floor(price × (endsAt − max(now, startsAt)) / (endsAt − startsAt))
 *
 * Hali boshlanmagan — to'liq narx; tugagan — 0. Kasr so'm PASTGA yaxlitlanadi:
 * platforma hech qachon olganidan ko'p qaytarmaydi.
 */
export function shiftPassProRataRefund(
  pass: { startsAt: Date; endsAt: Date; price: number },
  now: Date,
): number {
  const start = new Date(pass.startsAt).getTime();
  const end = new Date(pass.endsAt).getTime();
  const duration = end - start;
  if (duration <= 0) return 0;
  const remaining = Math.min(duration, Math.max(0, end - Math.max(now.getTime(), start)));
  return Math.floor((Number(pass.price) * remaining) / duration);
}
