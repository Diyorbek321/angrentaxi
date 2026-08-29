import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tariff } from '../../database/entities/tariff.entity';
import { TariffsService } from './tariffs.service';

/**
 * Narx tarkibi — chekning to'g'riligini qo'riqlaydigan testlar.
 *
 * Bu yerdagi eng muhim tekshiruv INVARIANT: qatorlar yig'indisi jamiga teng
 * bo'lishi shart. Buzilsa, chekda foydalanuvchi hisob-kitob xatosini ko'radi-yu
 * qayerdaligini tushunmaydi — bu chekning umuman yo'qligidan yomonroq.
 */
describe('TariffsService — narx tarkibi', () => {
  let service: TariffsService;

  const tariff = (over: Partial<Tariff> = {}): Tariff =>
    ({
      id: 'tariff-1',
      name: 'Komfort',
      basePrice: 10000,
      pricePerKm: 2000,
      pricePerMin: 500,
      minPrice: 12000,
      maxPrice: null,
      surgeMultiplier: 1.0,
      isActive: true,
      ...over,
    }) as Tariff;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TariffsService,
        { provide: getRepositoryToken(Tariff), useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(TariffsService);
  });

  /**
   * Invariantni har bir holatda tekshiradigan yordamchi.
   *
   * ⚠️ `waitingFare` QATORI KENGAYTIRILDI. Kutish haqi qo'shilgandan keyin
   * invariant endi yetti qatordan iborat. Bu yerda u har doim 0 —
   * `calculatePriceBreakdown` kutishni hisoblamaydi (safar boshlanishidan
   * OLDINGI vaqtga bog'liq, narx baholanayotganda u hali mavjud emas) —
   * lekin qator yig'indida ATAYLAB qoldirilgan: kelajakda kimdir bu yerga
   * kutish qo'shsa-yu yig'indini yangilashni unutsa, test darhol yiqiladi.
   * Kutish bilan invariant `waiting-charge.spec.ts` da tekshiriladi.
   */
  const expectInvariant = (b: ReturnType<TariffsService['calculatePriceBreakdown']>) => {
    const sum =
      b.baseFare +
      b.distanceFare +
      b.timeFare +
      b.minPriceAdjustment +
      b.surgeFare +
      b.maxPriceCap +
      b.waitingFare;
    expect(sum).toBeCloseTo(b.total, 6);
  };

  describe('invariant: qatorlar yig\'indisi === jami', () => {
    it('oddiy safarda', () => {
      const b = service.calculatePriceBreakdown(tariff(), 10, 20);
      expectInvariant(b);
    });

    it('eng kam haq ishlaganda', () => {
      // 1 km, 2 daqiqa → 10000 + 2000 + 1000 = 13000 > minPrice, shuning
      // uchun minPrice 20000 ga ko'tariladi.
      const b = service.calculatePriceBreakdown(
        tariff({ minPrice: 20000 }),
        1,
        2,
      );
      expect(b.minPriceAdjustment).toBeGreaterThan(0);
      expectInvariant(b);
    });

    it('koeffitsient ishlaganda', () => {
      const b = service.calculatePriceBreakdown(tariff(), 10, 20, 1.5);
      expect(b.surgeMultiplier).toBe(1.5);
      expect(b.surgeFare).toBeGreaterThan(0);
      expectInvariant(b);
    });

    it('yuqori chegara kesganda', () => {
      const b = service.calculatePriceBreakdown(
        tariff({ maxPrice: 25000 }),
        50,
        90,
      );
      expect(b.maxPriceCap).toBeLessThan(0);
      expect(b.total).toBe(25000);
      expectInvariant(b);
    });

    it('eng kam haq VA koeffitsient VA yuqori chegara birga ishlaganda', () => {
      const b = service.calculatePriceBreakdown(
        tariff({ minPrice: 30000, maxPrice: 35000 }),
        1,
        1,
        2.0,
      );
      expectInvariant(b);
    });
  });

  describe('calculatePrice — breakdown ustidagi qobiq', () => {
    it('har doim breakdown.total ni qaytaradi', () => {
      const cases: Array<[Partial<Tariff>, number, number, number | undefined]> = [
        [{}, 10, 20, undefined],
        [{ minPrice: 40000 }, 1, 1, undefined],
        [{ maxPrice: 15000 }, 30, 60, undefined],
        [{}, 5, 10, 1.8],
        [{ surgeMultiplier: 1.3 }, 5, 10, 1.1],
      ];

      for (const [over, km, min, surge] of cases) {
        const t = tariff(over);
        expect(service.calculatePrice(t, km, min, surge)).toBe(
          service.calculatePriceBreakdown(t, km, min, surge).total,
        );
      }
    });
  });

  describe('koeffitsient tanlash', () => {
    it('tarif va hudud koeffitsientidan KATTAsi qo\'llanadi', () => {
      const t = tariff({ surgeMultiplier: 1.6 });

      // Hudud koeffitsienti pastroq — tarifniki qoladi (admin qo'ygan
      // bayram koeffitsienti pol bo'lib xizmat qiladi).
      expect(service.calculatePriceBreakdown(t, 5, 10, 1.2).surgeMultiplier).toBe(1.6);

      // Hudud koeffitsienti yuqoriroq — u g'olib.
      expect(service.calculatePriceBreakdown(t, 5, 10, 2.0).surgeMultiplier).toBe(2.0);
    });

    it('koeffitsient berilmasa 1.0 va surgeFare nol', () => {
      const b = service.calculatePriceBreakdown(tariff(), 10, 20);
      expect(b.surgeMultiplier).toBe(1);
      expect(b.surgeFare).toBe(0);
    });
  });

  describe('qator qiymatlari', () => {
    it('masofa va vaqt qatorlari tarif narxlaridan hisoblanadi', () => {
      const b = service.calculatePriceBreakdown(tariff(), 10, 20);
      expect(b.baseFare).toBe(10000);
      expect(b.distanceFare).toBe(10 * 2000);
      expect(b.timeFare).toBe(20 * 500);
      expect(b.pricePerKm).toBe(2000);
      expect(b.pricePerMin).toBe(500);
    });

    it('minPriceAdjustment hech qachon manfiy emas', () => {
      const b = service.calculatePriceBreakdown(tariff({ minPrice: 1 }), 10, 20);
      expect(b.minPriceAdjustment).toBe(0);
    });

    it('maxPriceCap hech qachon musbat emas', () => {
      const b = service.calculatePriceBreakdown(
        tariff({ maxPrice: 999999 }),
        10,
        20,
      );
      expect(b.maxPriceCap).toBe(0);
    });

    it('maxPrice belgilanmagan bo\'lsa cheklov qo\'llanmaydi', () => {
      const b = service.calculatePriceBreakdown(
        tariff({ maxPrice: null }),
        100,
        200,
      );
      expect(b.maxPriceCap).toBe(0);
      expectInvariant(b);
    });

    it('kutish qatorlari HAR DOIM mavjud va baholashda nol', () => {
      // Maydonlar tarkibda doim bo'lishi shart: mobil ilova ularni
      // "bor-yo'qligini tekshirmasdan" o'qiydi. Baholash lahzasida esa
      // kutish hali sodir bo'lmagan, shuning uchun qiymat 0 — narx
      // ko'rsatkichi kutish uchun oldindan pul so'ramaydi.
      const b = service.calculatePriceBreakdown(tariff(), 10, 20, 1.5);
      expect(b.waitingMinutes).toBe(0);
      expect(b.waitingFare).toBe(0);
    });
  });
});
