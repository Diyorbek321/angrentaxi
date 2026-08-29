import { FareBreakdown } from './fare-breakdown';
import {
  DEFAULT_FREE_WAIT_MINUTES,
  DEFAULT_WAITING_PRICE_PER_MINUTE,
  computeWaitingMinutes,
  waitingSettingsOf,
  withWaitingFare,
} from './waiting-charge';

/**
 * KUTISH HAQI qoidasining testlari.
 *
 * Bu yerda ikkita narsa qo'riqlanadi:
 *   1. YAXLITLASH — yo'lovchi bilan nizo chiqadigan aniq chegara.
 *   2. INVARIANT — kutish qatori qo'shilgandan keyin ham qatorlar
 *      yig'indisi jamiga teng bo'lib qolishi.
 */

const MINUTE = 60_000;
const at = (msOffset: number) => new Date(1_700_000_000_000 + msOffset);

const rideFare = (over: Partial<FareBreakdown> = {}): FareBreakdown => ({
  baseFare: 10000,
  distanceKm: 8,
  pricePerKm: 2000,
  distanceFare: 16000,
  durationMin: 20,
  pricePerMin: 500,
  timeFare: 10000,
  minPriceAdjustment: 0,
  surgeMultiplier: 1,
  surgeFare: 0,
  maxPriceCap: 0,
  waitingMinutes: 0,
  waitingFare: 0,
  total: 36000,
  ...over,
});

const sumOfLines = (b: FareBreakdown) =>
  b.baseFare +
  b.distanceFare +
  b.timeFare +
  b.minPriceAdjustment +
  b.surgeFare +
  b.maxPriceCap +
  b.waitingFare;

describe('computeWaitingMinutes — yaxlitlash qoidasi', () => {
  const FREE = 3;

  it('bepul oyna ichida haq yo\'q', () => {
    expect(computeWaitingMinutes(at(0), at(0), FREE)).toBe(0);
    expect(computeWaitingMinutes(at(0), at(1 * MINUTE), FREE)).toBe(0);
    expect(computeWaitingMinutes(at(0), at(2.9 * MINUTE), FREE)).toBe(0);
  });

  it('AYNAN 3:00.000 hali bepul — chegara ichkarida', () => {
    // Bu qoidaning eng aniq aytilishi kerak bo'lgan nuqtasi: bepul oyna
    // YOPIQ oraliq, ya'ni uchinchi daqiqaning oxirigacha pul olinmaydi.
    expect(computeWaitingMinutes(at(0), at(3 * MINUTE), FREE)).toBe(0);
  });

  it('3:00.001 dan boshlab to\'rtinchi daqiqa TO\'LIQ undiriladi', () => {
    // "Boshlangan daqiqa hisoblanadi" qoidasi. Yo'lovchi uchun bu keskin
    // chegara, shuning uchun ilovada ham aynan shu so'zlar bilan aytiladi.
    expect(computeWaitingMinutes(at(0), at(3 * MINUTE + 1), FREE)).toBe(1);
    expect(computeWaitingMinutes(at(0), at(3.5 * MINUTE), FREE)).toBe(1);
    expect(computeWaitingMinutes(at(0), at(4 * MINUTE), FREE)).toBe(1);
  });

  it('7 daqiqa 10 soniya kutish = 5 haqli daqiqa', () => {
    // ceil(7.1667) = 8, 8 - 3 = 5. Hujjatdagi misol bilan bir xil.
    expect(computeWaitingMinutes(at(0), at(7 * MINUTE + 10_000), FREE)).toBe(5);
  });

  it('bepul oyna 0 bo\'lsa birinchi boshlangan daqiqa ham undiriladi', () => {
    expect(computeWaitingMinutes(at(0), at(1), 0)).toBe(1);
  });

  describe('kutish 0 bo\'ladigan xavfsiz holatlar', () => {
    it('arrivedAt yo\'q — ESKI buyurtma yoki haydovchi "keldim" bosmagan', () => {
      expect(computeWaitingMinutes(null, at(30 * MINUTE), FREE)).toBe(0);
      expect(computeWaitingMinutes(undefined, at(30 * MINUTE), FREE)).toBe(0);
    });

    it('safar boshlanish vaqti yo\'q — oynani yopib bo\'lmaydi', () => {
      // Kutish oynasi ochiq qolgan bo'lsa, taxmin qilib undirishdan ko'ra
      // hech narsa olmaslik to'g'ri: ortiqcha undirilgan pulni qaytarish
      // undirmay qolganidan qimmatroq turadi.
      expect(computeWaitingMinutes(at(0), null, FREE)).toBe(0);
    });

    it('teskari tartibdagi vaqtlar (soat farqi) chegirmaga aylanmaydi', () => {
      expect(computeWaitingMinutes(at(10 * MINUTE), at(0), FREE)).toBe(0);
    });

    it('yaroqsiz sana matni NaN narx bermaydi', () => {
      expect(computeWaitingMinutes('not-a-date', at(30 * MINUTE), FREE)).toBe(0);
    });
  });

  it('ISO matn ko\'rinishidagi sanalar ham qabul qilinadi', () => {
    // `arrived_at` javobdan yoki jsonb\'dan matn bo\'lib qaytishi mumkin.
    expect(
      computeWaitingMinutes(
        at(0).toISOString(),
        at(8 * MINUTE).toISOString(),
        FREE,
      ),
    ).toBe(5);
  });
});

describe('waitingSettingsOf — orqaga moslik', () => {
  it('tarifdagi qiymatlarni oladi', () => {
    expect(waitingSettingsOf({ freeWaitMinutes: 5, waitingPricePerMinute: 800 })).toEqual({
      freeWaitMinutes: 5,
      waitingPricePerMinute: 800,
    });
  });

  it('maydonlar yo\'q bo\'lsa standart qiymatga tushadi', () => {
    // Migratsiyagacha yaratilgan tarif obyektlarida bu maydonlar umuman
    // yo'q. `undefined` narxga ko'paytirilsa `NaN` chiqardi.
    expect(waitingSettingsOf({})).toEqual({
      freeWaitMinutes: DEFAULT_FREE_WAIT_MINUTES,
      waitingPricePerMinute: DEFAULT_WAITING_PRICE_PER_MINUTE,
    });
    expect(
      waitingSettingsOf({ freeWaitMinutes: null, waitingPricePerMinute: null }),
    ).toEqual({
      freeWaitMinutes: DEFAULT_FREE_WAIT_MINUTES,
      waitingPricePerMinute: DEFAULT_WAITING_PRICE_PER_MINUTE,
    });
  });

  it('bepul oyna 0 — haqiqiy qiymat, standartga TUSHMAYDI', () => {
    // `??` emas `||` ishlatilsa, "bepul kutish yo'q" degan sozlama jimgina
    // 3 daqiqaga aylanib qolardi.
    expect(waitingSettingsOf({ freeWaitMinutes: 0 }).freeWaitMinutes).toBe(0);
  });
});

describe('withWaitingFare', () => {
  it('kutish qatorini qo\'shadi va jamini oshiradi', () => {
    const b = withWaitingFare(rideFare(), 5, 500);

    expect(b.waitingMinutes).toBe(5);
    expect(b.waitingFare).toBe(2500);
    expect(b.total).toBe(36000 + 2500);
  });

  it('INVARIANT: qatorlar yig\'indisi === jami', () => {
    for (const minutes of [0, 1, 5, 37]) {
      const b = withWaitingFare(rideFare(), minutes, 500);
      expect(sumOfLines(b)).toBeCloseTo(b.total, 6);
    }
  });

  it('koeffitsient va yuqori chegara bo\'lgan tarkibda ham invariant saqlanadi', () => {
    const capped = rideFare({
      surgeMultiplier: 1.5,
      surgeFare: 18000,
      maxPriceCap: -9000,
      total: 45000,
    });
    const b = withWaitingFare(capped, 4, 500);

    expect(sumOfLines(b)).toBeCloseTo(b.total, 6);
  });

  it('kutish YUQORI CHEGARADAN TASHQARIDA — cheklov uni yemaydi', () => {
    // `maxPrice` ga yetgan safar aynan uzoq kutilgan safar bo'lishi mumkin.
    // Kutish chegara ichida hisoblanganida, eng ko'p kutdirilgan safarlarda
    // haydovchi hech narsa olmasdi.
    const capped = rideFare({ maxPriceCap: -4000, total: 32000 });
    const b = withWaitingFare(capped, 6, 500);

    expect(b.total).toBe(32000 + 3000);
    expect(b.maxPriceCap).toBe(-4000);
  });

  it('kirish obyekti O\'ZGARTIRILMAYDI', () => {
    // `order.fareBreakdown` — buyurtma yaratilganda muzlatilgan quote.
    const original = rideFare();
    withWaitingFare(original, 5, 500);

    expect(original.waitingFare).toBe(0);
    expect(original.total).toBe(36000);
  });

  it('IDEMPOTENT: ikki marta qo\'llanganda narx ikki barobar oshmaydi', () => {
    const once = withWaitingFare(rideFare(), 5, 500);
    const twice = withWaitingFare(once, 5, 500);

    expect(twice.total).toBe(once.total);
    expect(twice.waitingFare).toBe(2500);
  });

  it('ESKI tarkibda (kutish maydonlarisiz) 0 deb o\'qiladi', () => {
    // Migratsiyadan oldin yozilgan `fare_breakdown` jsonb qatorlarida
    // `waitingFare` KALITI UMUMAN YO'Q — `undefined - x` `NaN` berardi.
    const legacy = {
      baseFare: 10000,
      distanceKm: 8,
      pricePerKm: 2000,
      distanceFare: 16000,
      durationMin: 20,
      pricePerMin: 500,
      timeFare: 10000,
      minPriceAdjustment: 0,
      surgeMultiplier: 1,
      surgeFare: 0,
      maxPriceCap: 0,
      total: 36000,
    } as FareBreakdown;

    const b = withWaitingFare(legacy, 2, 500);

    expect(b.total).toBe(37000);
    expect(sumOfLines(b)).toBeCloseTo(b.total, 6);
  });

  it('pul butun so\'mda qoladi — float qoldig\'i yo\'q', () => {
    // Daqiqa ham, daqiqa narxi ham butun son, shuning uchun ko'paytma
    // aniq. Bu ataylab: kutish yagona "vaqtdan pul" qatori va u tiyinsiz.
    const b = withWaitingFare(rideFare(), 7, 500);
    expect(Number.isInteger(b.waitingFare)).toBe(true);
    expect(b.waitingFare).toBe(3500);
  });
});
