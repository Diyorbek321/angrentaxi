import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DriverLegalService, maskLegalId } from './driver-legal.service';
import { DriverLegalController } from './driver-legal.controller';
import { DriverTaxStatus } from '../../database/entities/driver.entity';
import { ServiceType } from '../../database/entities/order.entity';
import { Permission, UserRole } from '../../database/entities/user.entity';

/**
 * Huquqiy profil — xavfsizlik regressiyalari (security review 2026-10-15):
 *  #2 PINFL/STIR DRIVERS_APPROVE'siz menejerga niqoblangan;
 *  #4 har o'zgarish audit jurnalida (niqoblangan), tasdiqlangan hujjatdan
 *     keyin haydovchi o'zi o'zgartira olmaydi, takroriy PINFL/STIR — 409;
 *  #5 `save({...driver})` emas, `update(id, changes)` — kesh ustunlari
 *     (balance, is_online) eski nusxa bilan ustidan yozilmaydi.
 */
describe('DriverLegalService — security', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const driver = {
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
    balance: 50000,
    isOnline: true,
  };

  function build(options: { documents?: Array<{ code: string; label: string; status: string }> } = {}) {
    const driverRepository = {
      findOne: jest.fn(async () => ({ ...driver })),
      save: jest.fn(async (value: unknown) => value),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const manager = { getRepository: jest.fn(() => driverRepository) };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const settingsService = {
      getLegalComplianceSettings: jest.fn(async () => ({
        legalComplianceEnforcedFrom: null,
        minDriverAgeYears: 21,
        minLicenceExperienceYears: 3,
        maxVehicleAgeYears: 15,
      })),
    };
    const verificationService = {
      getSummaryForDriver: jest.fn(async () => ({ items: options.documents ?? [] })),
    };
    const auditLog = { record: jest.fn(async (entry: Record<string, unknown>) => ({ id: 'audit-1', ...entry })) };
    const service = new DriverLegalService(
      driverRepository as never,
      settingsService as never,
      verificationService as never,
      auditLog as never,
      dataSource as never,
    );
    return { service, driverRepository, auditLog, manager };
  }

  it('#5 update(id, changes) — balance/is_online ustidan yozilmaydi', async () => {
    const { service, driverRepository } = build();
    await service.updateForUser('user-1', { taxiLicenceNumber: 'TL-2' }, now);
    expect(driverRepository.save).not.toHaveBeenCalled();
    expect(driverRepository.update).toHaveBeenCalledWith('driver-1', { taxiLicenceNumber: 'TL-2' });
  });

  it('#4 PINFL/STIR/soliq maqomi o‘zgarishi jurnalga — niqoblangan, eski → yangi', async () => {
    const { service, auditLog, manager } = build();
    await service.updateForUser(
      'user-1',
      { pinfl: '98765432109876', tin: '123456789', taxStatus: DriverTaxStatus.INDIVIDUAL_ENTREPRENEUR },
      now,
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        action: 'driver.legal_update',
        targetType: 'driver',
        targetId: 'driver-1',
        metadata: {
          self: true,
          changes: {
            pinfl: { from: '**********1234', to: '**********9876' },
            tin: { from: null, to: '*****6789' },
            taxStatus: { from: 'self_employed', to: 'individual_entrepreneur' },
          },
        },
      }),
      manager,
    );
  });

  it('#4 jurnalga faqat haqiqiy o‘zgarish; boshqa maydonlar — jurnalsiz', async () => {
    const { service, auditLog } = build();
    await service.updateForUser('user-1', { pinfl: '12345678901234', taxiLicenceRegion: 'Angren' }, now);
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('#4 menejer tahriri — aktyor menejer, self: false', async () => {
    const { service, auditLog } = build();
    await service.updateForDriverId('driver-1', { tin: '123456789' }, 'manager-1', now);
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'manager-1', metadata: expect.objectContaining({ self: false }) }),
      expect.anything(),
    );
  });

  describe('#4 tasdiqlangan hujjatdan keyin qulf', () => {
    const approved = [{ code: 'taxi_licence', label: 'Litsenziya', status: 'ok' }];

    it.each([
      ['pinfl', '98765432109876'],
      ['tin', '123456789'],
      ['taxStatus', DriverTaxStatus.INDIVIDUAL_ENTREPRENEUR],
      ['birthDate', '1991-02-02'],
    ])('haydovchi %s ni o‘zi o‘zgartira olmaydi — 403 LEGAL_PROFILE_LOCKED', async (field, value) => {
      const { service, driverRepository } = build({ documents: approved });
      const err = await service.updateForUser('user-1', { [field]: value }, now).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'LEGAL_PROFILE_LOCKED' });
      expect(driverRepository.update).not.toHaveBeenCalled();
    });

    it('qulfsiz maydonlar va o‘zgarmagan qiymat — o‘tadi', async () => {
      const { service, driverRepository } = build({ documents: approved });
      await service.updateForUser('user-1', { pinfl: '12345678901234', taxiLicenceNumber: 'TL-9' }, now);
      expect(driverRepository.update).toHaveBeenCalledWith('driver-1', { taxiLicenceNumber: 'TL-9' });
    });

    it('tekshiruvdagi (pending) hujjat qulflamaydi', async () => {
      const { service } = build({ documents: [{ code: 'taxi_licence', label: 'L', status: 'pending_review' }] });
      await expect(service.updateForUser('user-1', { pinfl: '98765432109876' }, now)).resolves.toBeDefined();
    });

    it('DRIVERS_APPROVE menejer o‘zgartira oladi', async () => {
      const { service, driverRepository } = build({ documents: approved });
      await service.updateForDriverId('driver-1', { pinfl: '98765432109876' }, 'manager-1', now);
      expect(driverRepository.update).toHaveBeenCalledWith('driver-1', { pinfl: '98765432109876' });
    });
  });

  it('#4 boshqa haydovchidagi PINFL — 409 LEGAL_PROFILE_DUPLICATE', async () => {
    const { service, driverRepository } = build();
    driverRepository.update.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'uq_drivers_pinfl' }),
    );
    const err = await service.updateForUser('user-1', { pinfl: '98765432109876' }, now).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'LEGAL_PROFILE_DUPLICATE',
      details: { field: 'pinfl' },
    });
  });

  it('maskLegalId: oxirgi 4 raqam ko‘rinadi', () => {
    expect(maskLegalId('12345678901234')).toBe('**********1234');
    expect(maskLegalId('123456789')).toBe('*****6789');
    expect(maskLegalId(null)).toBeNull();
  });
});

describe('DriverLegalController — #2 niqoblash', () => {
  const summary = {
    profile: { pinfl: '12345678901234', tin: '123456789', birthDate: '1990-01-01' },
    eligibility: { eligible: true },
  };

  function controller() {
    const service = {
      getForDriverId: jest.fn(async () => summary),
      updateForDriverId: jest.fn(async () => summary),
    };
    return { ctrl: new DriverLegalController(service as never), service };
  }

  it('DRIVERS_APPROVE yo‘q menejer — PINFL/STIR niqoblangan', async () => {
    const { ctrl } = controller();
    const res = await ctrl.getOne('driver-1', {
      id: 'm1',
      role: UserRole.MANAGER,
      permissions: [Permission.DRIVERS_VIEW],
    } as never);
    expect(res.profile.pinfl).toBe('**********1234');
    expect(res.profile.tin).toBe('*****6789');
  });

  it('DRIVERS_APPROVE menejer va admin — to‘liq', async () => {
    const { ctrl } = controller();
    const approver = await ctrl.getOne('driver-1', {
      id: 'm2',
      role: UserRole.MANAGER,
      permissions: [Permission.DRIVERS_VIEW, Permission.DRIVERS_APPROVE],
    } as never);
    expect(approver.profile.pinfl).toBe('12345678901234');
    const admin = await ctrl.getOne('driver-1', { id: 'a1', role: UserRole.ADMIN, permissions: [] } as never);
    expect(admin.profile.tin).toBe('123456789');
  });

  it('menejer tahriri aktyor id bilan', async () => {
    const { ctrl, service } = controller();
    await ctrl.updateOne('driver-1', { tin: '123456789' }, { id: 'm2', role: UserRole.MANAGER } as never);
    expect(service.updateForDriverId).toHaveBeenCalledWith('driver-1', { tin: '123456789' }, 'm2');
  });
});
