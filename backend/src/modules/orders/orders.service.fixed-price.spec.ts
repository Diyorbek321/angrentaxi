import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FareBreakdown } from '../tariffs/fare-breakdown';
import {
  computeWaitingMinutes,
  withWaitingFare,
} from '../tariffs/waiting-charge';

/**
 * QAT'IY NARX QOIDASI.
 *
 * Talab: yo'lovchi manzilni xaritada belgilagan bo'lsa, safar oxirida
 * undiriladigan summa unga KO'RSATILGAN summa bilan bir xil bo'lishi shart.
 * Manzil belgilanmagan bo'lsa — har kilometr uchun hisoblanadi.
 *
 * Bu spec qoidaning O'ZINI tekshiradi: `completeTrip` ichidagi tanlov
 * (`useQuote`) va uning natijasi. To'liq `completeTrip` oqimi
 * `orders.service.completion-distance.spec.ts` da qoplangan; bu yerda
 * ATAYLAB faqat narx tanlovi ajratib olingan, chunki u pul qoidasi va
 * boshqa hech narsaga aralashmasligi kerak.
 */

const quote: FareBreakdown = {
  baseFare: 10000,
  distanceKm: 8.0,
  pricePerKm: 2000,
  distanceFare: 16000,
  durationMin: 20,
  pricePerMin: 500,
  timeFare: 10000,
  minPriceAdjustment: 0,
  surgeMultiplier: 1.2,
  surgeFare: 7200,
  maxPriceCap: 0,
  // Baholash paytida kutish HALI BO'LMAYDI: quote buyurtma yaratilganda
  // muzlatiladi, haydovchi esa hali yo'lga ham chiqmagan. Kutish qatori
  // safar yakunida `withWaitingFare` bilan qo'shiladi.
  waitingMinutes: 0,
  waitingFare: 0,
  total: 43200,
};

/**
 * `orders-completion.service.ts` dagi tanlovning aynan o'zi.
 * Mantiq shu yerda takrorlanmaydi — shakli bir xil bo'lishi test bilan
 * qo'riqlanadi (quyidagi "manba bilan mos" testiga qarang).
 */
const chooseFare = (
  order: { isFixedPrice: boolean; fareBreakdown: FareBreakdown | null },
  metered: FareBreakdown,
): { fare: FareBreakdown; usedQuote: boolean } => {
  const useQuote = order.isFixedPrice && order.fareBreakdown != null;
  return {
    fare: useQuote ? order.fareBreakdown! : metered,
    usedQuote: useQuote,
  };
};

const meteredFare = (distanceKm: number): FareBreakdown => ({
  ...quote,
  distanceKm,
  distanceFare: distanceKm * quote.pricePerKm,
  surgeMultiplier: 1,
  surgeFare: 0,
  total: quote.baseFare + distanceKm * quote.pricePerKm + quote.timeFare,
});

describe('Qat\'iy narx qoidasi', () => {
  describe('manzil belgilangan (isFixedPrice = true)', () => {
    it('haqiqiy masofa UZUNROQ bo\'lsa ham ko\'rsatilgan narx undiriladi', () => {
      // Yo'lovchi 43 200 so'm ko'rgan. Haydovchi tirbandlik sababli 11 km
      // yurgan bo'lsa ham, va'da qilingan summa o'zgarmaydi.
      const { fare, usedQuote } = chooseFare(
        { isFixedPrice: true, fareBreakdown: quote },
        meteredFare(11.0),
      );
      expect(usedQuote).toBe(true);
      expect(fare.total).toBe(43200);
    });

    it('haqiqiy masofa QISQAROQ bo\'lsa ham ko\'rsatilgan narx undiriladi', () => {
      // Qat'iy narx ikki tomonlama: yo'lovchi aniqlik oldi, platforma esa
      // qisqa yo'ldan qo'shimcha foyda ko'rmaydi.
      const { fare, usedQuote } = chooseFare(
        { isFixedPrice: true, fareBreakdown: quote },
        meteredFare(5.0),
      );
      expect(usedQuote).toBe(true);
      expect(fare.total).toBe(43200);
    });

    it('chekdagi tarkib BAHOLASH masofasini ko\'rsatadi, haqiqiysini emas', () => {
      // Chek undirilgan summani tushuntirishi kerak. Haqiqiy masofa
      // ko'rsatilsa, qatorlar jamiga qo'shilmay qoladi.
      const { fare } = chooseFare(
        { isFixedPrice: true, fareBreakdown: quote },
        meteredFare(11.0),
      );
      expect(fare.distanceKm).toBe(8.0);
      expect(
        fare.baseFare +
          fare.distanceFare +
          fare.timeFare +
          fare.minPriceAdjustment +
          fare.surgeFare +
          fare.maxPriceCap +
          fare.waitingFare,
      ).toBeCloseTo(fare.total, 6);
    });

    it('koeffitsient baholashda qo\'llangani uchun yakunda TAKRORLANMAYDI', () => {
      // Surge quote ichida allaqachon bor (surgeFare = 7200). Yakunda uni
      // yana qo'llash narxni ikki marta oshirardi.
      const { fare } = chooseFare(
        { isFixedPrice: true, fareBreakdown: quote },
        meteredFare(8.0),
      );
      expect(fare.surgeMultiplier).toBe(1.2);
      expect(fare.surgeFare).toBe(7200);
    });
  });

  describe('manzil belgilanmagan yoki marshrut hisoblanmagan', () => {
    it('hisoblagich rejimi — haqiqiy masofa bo\'yicha', () => {
      const metered = meteredFare(11.0);
      const { fare, usedQuote } = chooseFare(
        { isFixedPrice: false, fareBreakdown: null },
        metered,
      );
      expect(usedQuote).toBe(false);
      expect(fare.distanceKm).toBe(11.0);
      expect(fare.total).toBe(metered.total);
    });

    it('OSRM javob bermagan buyurtma qat\'iy narxga O\'TMAYDI', () => {
      // `isFixedPrice` faqat marshrut haqiqatan hisoblanganda `true` bo'ladi.
      // To'g'ri chiziq bo'yicha chiqqan raqamni majburiy qilib qo'yish
      // haydovchini har safarda zarar ko'rsatardi (haversine yo'l
      // masofasidan doimo kichik).
      const { usedQuote } = chooseFare(
        { isFixedPrice: false, fareBreakdown: quote },
        meteredFare(9.0),
      );
      expect(usedQuote).toBe(false);
    });

    it('ESKI buyurtmalar (tarkibsiz) hisoblagich yo\'lidan o\'tadi', () => {
      // Migratsiyadan oldingi safarlarda `fare_breakdown` NULL. Ularni
      // retroaktiv qayta narxlash mumkin emas.
      const { usedQuote } = chooseFare(
        { isFixedPrice: true, fareBreakdown: null },
        meteredFare(7.0),
      );
      expect(usedQuote).toBe(false);
    });
  });

  /**
   * ⚠️ VA'DA O'ZGARDI — QAT'IY NARX + KUTISH.
   *
   * Ilgari qat'iy narxli safarda `fareBreakdown.total` AYNAN undirilardi.
   * Biznes qaroriga ko'ra kutish haqi endi kafolatdan TASHQARIDA: qat'iy
   * narx MARSHRUT noaniqligini yopadi (haydovchi boshqarmaydi), kutish esa
   * YO'LOVCHI boshqaradigan xarajat.
   *
   * Bu blok aynan shu kompozitsiyani qo'riqlaydi — `orders-completion`
   * dagi ketma-ketlikning o'zi: tanlangan yo'l haqi ustiga kutish qatori
   * qo'shiladi.
   */
  describe('qat\'iy narx + kutish kompozitsiyasi', () => {
    // `orders-completion.service.ts` dagi ikki bosqichning aynan o'zi:
    // avval yo'l haqi tanlanadi, keyin kutish USTIGA qo'shiladi.
    const settle = (
      order: {
        isFixedPrice: boolean;
        fareBreakdown: FareBreakdown | null;
        arrivedAt: Date | null;
      },
      tripStartedAt: Date | null,
      metered: FareBreakdown,
    ) => {
      const { fare } = chooseFare(order, metered);
      const waitingMinutes = computeWaitingMinutes(
        order.arrivedAt,
        tripStartedAt,
        3,
      );
      return withWaitingFare(fare, waitingMinutes, 500);
    };

    const arrivedAt = new Date('2026-08-29T10:00:00.000Z');

    it('kutish qat\'iy narx USTIGA qo\'shiladi, ichiga singib ketmaydi', () => {
      // Haydovchi 8 daqiqa kutdi: 3 bepul, 5 haqli = 2500 so'm.
      // Yo'lovchi 43 200 ko'rgan edi — endi 45 700 to'laydi.
      const fare = settle(
        { isFixedPrice: true, fareBreakdown: quote, arrivedAt },
        new Date('2026-08-29T10:08:00.000Z'),
        meteredFare(11.0),
      );

      expect(fare.waitingMinutes).toBe(5);
      expect(fare.waitingFare).toBe(2500);
      expect(fare.total).toBe(quote.total + 2500);
    });

    it('kengaytirilgan INVARIANT kutish bilan ham saqlanadi', () => {
      const fare = settle(
        { isFixedPrice: true, fareBreakdown: quote, arrivedAt },
        new Date('2026-08-29T10:08:00.000Z'),
        meteredFare(11.0),
      );

      expect(
        fare.baseFare +
          fare.distanceFare +
          fare.timeFare +
          fare.minPriceAdjustment +
          fare.surgeFare +
          fare.maxPriceCap +
          fare.waitingFare,
      ).toBeCloseTo(fare.total, 6);
    });

    it('bepul oyna ichida kutilgan qat\'iy safar narxi O\'ZGARMAYDI', () => {
      const fare = settle(
        { isFixedPrice: true, fareBreakdown: quote, arrivedAt },
        new Date('2026-08-29T10:02:30.000Z'),
        meteredFare(8.0),
      );

      expect(fare.waitingFare).toBe(0);
      expect(fare.total).toBe(quote.total);
    });

    it('ESKI buyurtma (arrivedAt = null) — hisob-kitob AVVALGIDEK', () => {
      // Migratsiyadan oldin `arrived_at` umuman yozilmagan. Bu yo'l
      // buzilsa, eski safarlardan soxta kutish haqi undirilardi.
      const fare = settle(
        { isFixedPrice: true, fareBreakdown: quote, arrivedAt: null },
        new Date('2026-08-29T10:30:00.000Z'),
        meteredFare(8.0),
      );

      expect(fare.waitingMinutes).toBe(0);
      expect(fare.waitingFare).toBe(0);
      expect(fare.total).toBe(quote.total);
    });

    it('hisoblagich rejimida ham kutish xuddi shunday qo\'shiladi', () => {
      // Kutish qoidasi ikki rejim uchun BITTA — aks holda bir xil kutgan
      // ikki yo'lovchi har xil summa to'lardi.
      const metered = meteredFare(11.0);
      const fare = settle(
        { isFixedPrice: false, fareBreakdown: null, arrivedAt },
        new Date('2026-08-29T10:08:00.000Z'),
        metered,
      );

      expect(fare.waitingFare).toBe(2500);
      expect(fare.total).toBe(metered.total + 2500);
    });
  });

  it('tanlov sharti manba fayldagi bilan MOS', () => {
    // Bu test mantiq ikki joyda ajralib ketishining oldini oladi: agar
    // `orders-completion.service.ts` dagi shart o'zgarsa-yu bu fayl
    // o'zgarmasa, test yiqiladi va nomuvofiqlik ko'rinadi.
    const source = readFileSync(
      join(__dirname, 'orders-completion.service.ts'),
      'utf8',
    );

    expect(source).toContain(
      'const useQuote = order.isFixedPrice && order.fareBreakdown != null;',
    );
  });
});
