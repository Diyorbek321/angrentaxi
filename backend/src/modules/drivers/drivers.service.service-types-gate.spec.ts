import { DriversService } from './drivers.service';
import { ServiceType } from '../../database/entities/order.entity';
import { UserRole, UserStatus } from '../../database/entities/user.entity';

/**
 * Profil endpointlari xizmat turlarini O'ZGARTIRA OLMAYDI.
 *
 * Darvoza (`DriverServicesService`) tekshiruvsiz `food` yoqilishiga yo'l
 * qo'ymaydi. Lekin `PATCH /drivers/me` va `POST /drivers/profile` ham aynan
 * shu ustunni yozardi — ya'ni darvozaning yonida ochiq eshik bor edi.
 * Bu spec o'sha eshik yopiqligini qo'riqlaydi: agar kimdir kelajakda
 * `serviceTypes` ni DTO ga qaytarsa, test yiqiladi.
 */
describe('DriversService — serviceTypes yon eshigi yopiq', () => {
  const driver = {
    id: 'driver-1',
    userId: 'user-1',
    carModel: 'Chevrolet Cobalt',
    vehicleType: null,
    serviceTypes: [ServiceType.TAXI],
    balance: 0,
    isOnline: false,
    user: { id: 'user-1', status: UserStatus.ACTIVE },
  };

  function buildService() {
    const driverRepository = {
      findOne: jest.fn(async () => driver),
      save: jest.fn(async (entity: Record<string, unknown>) => entity),
      query: jest.fn(async () => []),
    };
    const usersService = {
      findByIdOrThrow: jest.fn(async () => ({ id: 'user-2', role: UserRole.PASSENGER })),
      updateRole: jest.fn(async () => undefined),
      updateStatus: jest.fn(async () => undefined),
    };
    const service = new DriversService(
      driverRepository as never,
      {} as never,
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
    );
    return { service, driverRepository };
  }

  it("PATCH /drivers/me orqali yuborilgan serviceTypes SAQLANMAYDI", async () => {
    const { service, driverRepository } = buildService();

    // DTO da bunday maydon endi yo'q (global ValidationPipe uni 400 bilan
    // qaytaradi), lekin servis darajasida ham yozilmasligi kerak — himoya
    // bitta qatlamga tayanmasin.
    await service.updateProfile('user-1', {
      carModel: 'Malibu',
      serviceTypes: [ServiceType.FOOD, ServiceType.MARKET],
    } as never);

    const saved = driverRepository.save.mock.calls[0][0] as { serviceTypes: ServiceType[] };
    expect(saved.serviceTypes).toEqual([ServiceType.TAXI]);
    expect(saved).toMatchObject({ carModel: 'Malibu' });
  });

  it("yangi profil DOIM ['taxi'] dan boshlanadi", async () => {
    const { service, driverRepository } = buildService();
    driverRepository.findOne.mockResolvedValue(null as never);

    await service.createProfile('user-2', {
      carModel: 'Damas',
      serviceTypes: [ServiceType.FOOD],
    } as never);

    const created = driverRepository.save.mock.calls[0][0] as { serviceTypes: ServiceType[] };
    expect(created.serviceTypes).toEqual([ServiceType.TAXI]);
  });
});
