import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DriverLegalService } from './driver-legal.service';
import { DriverTaxStatus } from '../../database/entities/driver.entity';
import { ServiceType } from '../../database/entities/order.entity';

/**
 * Huquqiy profil + darvoza. Asosiy qoida: majburlash o'chiq yoki muhlat
 * davrida hech kim bloklanmaydi — sabablar faqat ogohlantirish.
 */
describe('DriverLegalService', () => {
  const now = new Date('2026-10-15T12:00:00Z');

  const compliant = {
    id: 'driver-1',
    userId: 'user-1',
    vehicleType: null,
    serviceTypes: [ServiceType.TAXI],
    carYear: 2018,
    taxStatus: DriverTaxStatus.SELF_EMPLOYED,
    pinfl: '12345678901234',
    tin: null,
    birthDate: '1990-01-01',
    drivingLicenceIssuedAt: '2012-01-01',
    taxiLicenceNumber: 'TL-1',
    taxiLicenceRegion: 'Toshkent viloyati',
    citizenship: 'UZ',
  };
  const incomplete = { ...compliant, taxStatus: null, pinfl: null, birthDate: null };

  function build(options: {
    driver?: Record<string, unknown> | null;
    enforcedFrom?: string | null;
    documents?: Array<{ code: string; label: string; status: string }>;
  } = {}) {
    const driver = options.driver === undefined ? compliant : options.driver;
    const driverRepository = {
      findOne: jest.fn(async () => driver),
      save: jest.fn(async (value: unknown) => value),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const settingsService = {
      getLegalComplianceSettings: jest.fn(async () => ({
        legalComplianceEnforcedFrom: options.enforcedFrom ?? null,
        minDriverAgeYears: 21,
        minLicenceExperienceYears: 3,
        maxVehicleAgeYears: 15,
        taxWithholdingEnabled: false,
        driverTaxWithholdingRate: 1,
      })),
    };
    const verificationService = {
      getSummaryForDriver: jest.fn(async () => ({
        canGoOnline: true,
        blockedReason: null,
        items: options.documents ?? [],
      })),
      getLegalDocumentStatesForDrivers: jest.fn(
        async (drivers: Array<{ id: string }>) =>
          new Map(drivers.map((d) => [d.id, (options.documents ?? []).filter((doc) => doc.code !== 'selfie')])),
      ),
    };
    const service = new DriverLegalService(
      driverRepository as never,
      settingsService as never,
      verificationService as never,
    );
    return { service, driverRepository, settingsService, verificationService };
  }

  describe('evaluate', () => {
    it("majburlash o'chiq — sabablar ogohlantirish, bloklamaydi", async () => {
      const { service } = build({ driver: incomplete });
      const result = await service.evaluate(incomplete as never, now);

      expect(result).toEqual(
        expect.objectContaining({
          eligible: false,
          enforced: false,
          enforcedFrom: null,
          appliesToTaxi: true,
          blocking: false,
        }),
      );
      expect(result.reasons.map((r) => r.code)).toEqual([
        'birth_date_missing',
        'tax_status_missing',
        'pinfl_missing',
      ]);
    });

    it('muhlat davri (kelajak sana) — hali bloklamaydi', async () => {
      const { service } = build({ enforcedFrom: '2026-12-01T00:00:00.000Z' });
      const result = await service.evaluate(incomplete as never, now);
      expect(result.enforced).toBe(false);
      expect(result.blocking).toBe(false);
    });

    it('majburlash yoqilgan — bloklaydi', async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const result = await service.evaluate(incomplete as never, now);
      expect(result.blocking).toBe(true);
    });

    it("taksi yoqilmagan haydovchi (faqat kuryer) — bloklanmaydi", async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const courier = { ...incomplete, serviceTypes: [ServiceType.FOOD] };
      const result = await service.evaluate(courier as never, now);
      expect(result.appliesToTaxi).toBe(false);
      expect(result.blocking).toBe(false);
    });

    it("huquqiy hujjatlar (litsenziya...) holati hisobga olinadi, boshqalari emas", async () => {
      const { service } = build({
        documents: [
          { code: 'taxi_licence', label: 'Taksi litsenziyasi', status: 'missing' },
          { code: 'selfie', label: 'Selfi', status: 'missing' },
        ],
      });
      const result = await service.evaluate(compliant as never, now);
      expect(result.reasons.map((r) => r.code)).toEqual(['document_taxi_licence']);
    });
  });

  describe('assertCanGoOnline', () => {
    it("majburlash o'chiq — o'tkazadi", async () => {
      const { service } = build({ driver: incomplete });
      await expect(service.assertCanGoOnline(incomplete as never, now)).resolves.toBeUndefined();
    });

    it('majburlash yoqilgan va yaroqsiz — o‘zbekcha sabablar bilan 400', async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const error = await service.assertCanGoOnline(incomplete as never, now).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.message).toContain('Taksi uchun onlayn chiqa olmaysiz');
      expect(error.message).toContain("Tug'ilgan sana kiritilmagan");
      expect(error.message).toContain('JShShIR');
    });

    it("majburlash yoqilgan, hammasi joyida — o'tkazadi", async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      await expect(service.assertCanGoOnline(compliant as never, now)).resolves.toBeUndefined();
    });
  });

  describe('assertCanEnableTaxi', () => {
    it('majburlash yoqilgan va yaroqsiz — taksini yoqib bo‘lmaydi', async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const courier = { ...incomplete, serviceTypes: [ServiceType.FOOD] };
      await expect(service.assertCanEnableTaxi(courier as never, now)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('assertCanCarryIntercity', () => {
    it('shaharlararo ham yo‘lovchi tashish — taksi talablari qo‘llanadi', async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const courier = { ...incomplete, serviceTypes: [ServiceType.FOOD] };
      await expect(service.assertCanCarryIntercity(courier as never, now)).rejects.toThrow('Shaharlararo');
    });

    it('majburlash o‘chiq — o‘tkazadi', async () => {
      const { service } = build();
      await expect(service.assertCanCarryIntercity(incomplete as never, now)).resolves.toBeUndefined();
    });
  });

  describe('profil', () => {
    it("haydovchining o'z profili + xulosa", async () => {
      const { service } = build();
      const result = await service.getForUser('user-1', now);
      expect(result.profile).toEqual({
        taxStatus: DriverTaxStatus.SELF_EMPLOYED,
        pinfl: '12345678901234',
        tin: null,
        birthDate: '1990-01-01',
        drivingLicenceIssuedAt: '2012-01-01',
        taxiLicenceNumber: 'TL-1',
        taxiLicenceRegion: 'Toshkent viloyati',
        citizenship: 'UZ',
      });
      expect(result.eligibility.eligible).toBe(true);
    });

    it("yangilash — faqat yuborilgan maydonlar, immutabl", async () => {
      const { service, driverRepository } = build();
      await service.updateForUser('user-1', { pinfl: '98765432109876', tin: null }, now);
      // Faqat o'zgargan maydon, `update(id, patch)` — butun entity `save` qilinmaydi (security review #5).
      expect(driverRepository.update).toHaveBeenCalledWith('driver-1', { pinfl: '98765432109876' });
      expect(driverRepository.save).not.toHaveBeenCalled();
    });

    it("YaTT tanlansa STIR so'raladi, lekin saqlash bloklanmaydi (sabab ko'rinadi)", async () => {
      const { service } = build();
      const result = await service.updateForUser(
        'user-1',
        { taxStatus: DriverTaxStatus.INDIVIDUAL_ENTREPRENEUR },
        now,
      );
      expect(result.eligibility.reasons.map((r) => r.code)).toEqual(['tin_missing']);
    });

    it("profil yo'q — 404", async () => {
      const { service } = build({ driver: null });
      await expect(service.getForUser('user-x', now)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.getForDriverId('driver-x', now)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('mashina o\'qiydigan xato (LEGAL_NOT_ELIGIBLE)', () => {
    it('onlayn darvoza: kod va sabablar ro\'yxati', async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const error = await service.assertCanGoOnline(incomplete as never, now).catch((e) => e);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'LEGAL_NOT_ELIGIBLE',
          reasons: [
            { code: 'birth_date_missing', message: "Tug'ilgan sana kiritilmagan" },
            {
              code: 'tax_status_missing',
              message: "Soliq maqomi yo'q: o'zini o'zi band qilgan yoki YaTT sifatida ro'yxatdan o'ting",
            },
            { code: 'pinfl_missing', message: 'JShShIR (PINFL, 14 raqam) kiritilmagan' },
          ],
        }),
      );
    });

    it('taksini yoqish darvozasi: o\'sha kod', async () => {
      const { service } = build({ enforcedFrom: '2026-10-01T00:00:00.000Z' });
      const error = await service
        .assertCanEnableTaxi({ ...incomplete, serviceTypes: [ServiceType.FOOD] } as never, now)
        .catch((e) => e);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ code: 'LEGAL_NOT_ELIGIBLE', reasons: expect.any(Array) }),
      );
      expect(error.message).toContain("«Taksi» xizmatini yoqib bo'lmadi");
    });
  });

  describe('summarizeMany (haydovchilar ro\'yxati, N+1 siz)', () => {
    it('sozlama va hujjatlar BIR marta o\'qiladi; har haydovchiga {eligible, blocking, issueCount}', async () => {
      const { service, settingsService, verificationService } = build({
        enforcedFrom: '2026-10-01T00:00:00.000Z',
        documents: [{ code: 'taxi_licence', label: 'Taksi litsenziya varaqasi', status: 'missing' }],
      });
      const courier = { ...incomplete, id: 'driver-3', serviceTypes: [ServiceType.FOOD] };
      const result = await service.summarizeMany(
        [compliant, { ...incomplete, id: 'driver-2' }, courier] as never,
        now,
      );

      expect(settingsService.getLegalComplianceSettings).toHaveBeenCalledTimes(1);
      expect(verificationService.getLegalDocumentStatesForDrivers).toHaveBeenCalledTimes(1);
      expect(verificationService.getSummaryForDriver).not.toHaveBeenCalled();
      expect(result.get('driver-1')).toEqual({ eligible: false, blocking: true, issueCount: 1 });
      expect(result.get('driver-2')).toEqual({ eligible: false, blocking: true, issueCount: 4 });
      // Faqat kuryer — taksiga tegishli emas, bloklamaydi.
      expect(result.get('driver-3')).toEqual({ eligible: false, blocking: false, issueCount: 4 });
    });

    it("bo'sh ro'yxat — so'rovsiz", async () => {
      const { service, settingsService } = build();
      expect((await service.summarizeMany([], now)).size).toBe(0);
      expect(settingsService.getLegalComplianceSettings).not.toHaveBeenCalled();
    });
  });

  describe('localizeSummary (Accept-Language: ru)', () => {
    it("sabablar ruscha, kodlar o'zgarmaydi", async () => {
      const { service } = build({ driver: incomplete });
      const summary = await service.getForUser('user-1', now);
      const ru = service.localizeSummary(summary, 'ru');
      expect(ru.eligibility.reasons[0]).toEqual({ code: 'birth_date_missing', message: 'Не указана дата рождения' });
      expect(service.localizeSummary(summary, 'uz')).toBe(summary);
    });
  });
});
