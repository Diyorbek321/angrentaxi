import { BadRequestException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { UserStatus } from '../../database/entities/user.entity';

/**
 * `setOnlineStatus` va davriy tekshiruv darvozasi.
 *
 * Bu yerda holat hisoblash SINALMAYDI (uning o'z spec'i bor) — sinaladigan
 * narsa ULANISH: darvoza faqat ONLAYN chiqishda ishlaydi, sababi
 * o'zgarmasdan haydovchiga yetadi, va u boshqa tekshiruvlardan keyin turadi.
 */
describe('DriversService.setOnlineStatus — tekshiruv darvozasi', () => {
  const driver = {
    id: 'driver-1',
    userId: 'user-1',
    balance: 0,
    isOnline: false,
    currentLocation: null,
    vehicleType: null,
    serviceTypes: ['taxi'],
    user: { id: 'user-1', status: UserStatus.ACTIVE },
  };

  let driverRepository: { findOne: jest.Mock; update: jest.Mock; query: jest.Mock };
  // Onlayn darvozasi qarzni DAFTARDAN o'qiydi (`drivers.balance` ustunidan
  // emas), shuning uchun bu testlarga balans so'rovini qaytaradigan
  // repozitoriy kerak. Standart javob 0 — ya'ni qarz yo'q, darvoza faqat
  // tekshiruv qoidasiga qarab qaror qiladi.
  let transactionRepository: { createQueryBuilder: jest.Mock };
  let ledgerBalance: number;
  let redis: { zrem: jest.Mock; geoadd: jest.Mock; set: jest.Mock; del: jest.Mock };
  let assertCanGoOnline: jest.Mock;
  let service: DriversService;

  beforeEach(() => {
    ledgerBalance = 0;
    driverRepository = {
      findOne: jest.fn(async () => driver),
      update: jest.fn(async () => undefined),
      query: jest.fn(async () => []),
    };
    transactionRepository = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(async () => ({ balance: String(ledgerBalance) })),
      })),
    };
    // `set`/`del` — mavjudlik kaliti: onlayn bo'lishda yoziladi, oflayn
    // bo'lishda o'chiriladi. Bu testlar darvozaga tegishli, shuning uchun
    // ikkalasi ham shunchaki muvaffaqiyat qaytaradi.
    redis = {
      zrem: jest.fn(async () => 1),
      geoadd: jest.fn(async () => 1),
      set: jest.fn(async () => 'OK'),
      del: jest.fn(async () => 1),
    };
    assertCanGoOnline = jest.fn(async () => undefined);

    service = new DriversService(
      driverRepository as never,
      transactionRepository as never,
      redis as never,
      {} as never,
      {} as never,
      { assertCanGoOnline } as never,
    );
  });

  it('onlayn chiqishda darvoza chaqiriladi', async () => {
    await service.setOnlineStatus('user-1', true);

    expect(assertCanGoOnline).toHaveBeenCalledWith(driver);
    expect(driverRepository.update).toHaveBeenCalledWith('driver-1', { isOnline: true });
  });

  it("darvoza rad etsa haydovchi onlayn BO'LMAYDI va sabab o'zgarmaydi", async () => {
    const reason = 'Onlayn chiqa olmaysiz: «Pasport» — muddati o‘tgan yoki yuklanmagan.';
    assertCanGoOnline.mockRejectedValue(new BadRequestException(reason));

    await expect(service.setOnlineStatus('user-1', true)).rejects.toThrow(reason);
    // Eng muhimi: bloklangan bo'lsa DB ham, Redis geo to'plami ham
    // o'zgarmasligi kerak — aks holda haydovchi buyurtma olishda davom
    // etardi.
    expect(driverRepository.update).not.toHaveBeenCalled();
    expect(redis.geoadd).not.toHaveBeenCalled();
  });

  it("OFLAYN bo'lishga darvoza aralashmaydi", async () => {
    // Aks holda muddati o'tgan haydovchi onlayn holatda qamalib qolardi.
    assertCanGoOnline.mockRejectedValue(new BadRequestException('bloklangan'));

    await expect(service.setOnlineStatus('user-1', false)).resolves.toMatchObject({
      isOnline: false,
    });
    expect(assertCanGoOnline).not.toHaveBeenCalled();
    expect(redis.zrem).toHaveBeenCalledWith('drivers:online', 'driver-1');
  });

  it("tasdiqlanmagan hisob darvozagacha ham yetmaydi", async () => {
    driverRepository.findOne.mockResolvedValue({
      ...driver,
      user: { id: 'user-1', status: UserStatus.PENDING },
    });

    await expect(service.setOnlineStatus('user-1', true)).rejects.toThrow(BadRequestException);
    expect(assertCanGoOnline).not.toHaveBeenCalled();
  });

  it('manfiy DAFTAR qoldig\'i darvozadan oldin tekshiriladi', async () => {
    // ⚠️ Qarz `drivers.balance` ustunidan EMAS, daftardan o'qiladi: ustun
    // yechib olingan pulni hisobga olmasdi va birinchi yechishdan keyin
    // haqiqiy qoldiqdan ajralib ketardi.
    ledgerBalance = -5000;

    await expect(service.setOnlineStatus('user-1', true)).rejects.toThrow(BadRequestException);
    expect(assertCanGoOnline).not.toHaveBeenCalled();
  });

  it('ustundagi manfiy `balance` endi hech narsani bloklamaydi', async () => {
    // Eski ustun qaror qabul qilishdan chiqdi. U hali ham yozilib turadi
    // (admin vositalari o'qiydi), lekin onlayn chiqishga ta'sir qilmasligi
    // kerak — aks holda ikkita manba yana ikkita javob berardi.
    driverRepository.findOne.mockResolvedValue({ ...driver, balance: -5000 });
    ledgerBalance = 0;

    await expect(service.setOnlineStatus('user-1', true)).resolves.toMatchObject({
      isOnline: true,
    });
  });
});
