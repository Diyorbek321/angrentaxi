import { BadRequestException, ForbiddenException, GoneException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../../database/entities/order.entity';
import { TripShareLink } from '../../database/entities/trip-share-link.entity';
import { TripShareService } from './trip-share.service';
import { hashShareToken, newShareToken } from './trip-share-policy';

describe('TripShareService (INCIDENT-POLICY §4)', () => {
  const baseOrder = {
    id: 'o1',
    passengerId: 'p1',
    driverId: 'd1',
    status: OrderStatus.IN_PROGRESS,
    completedAt: null,
    updatedAt: new Date('2026-11-04T10:00:00Z'),
    dropoffAddress: 'Angren, Navoiy 5',
    driver: { firstName: 'Alisher', lastName: 'Karimov', phone: '+998900000002' },
  };

  function build(order: Record<string, unknown> | null = baseOrder, link: Partial<TripShareLink> | null = null) {
    const tx = {
      create: jest.fn((_e: unknown, data: object) => data),
      save: jest.fn(async (_e: unknown, data: object) => ({ id: 'link-1', ...data })),
    };
    const links = {
      count: jest.fn(async () => 0),
      findOne: jest.fn(async () => link),
      manager: { transaction: jest.fn(async (work: (m: unknown) => Promise<unknown>) => work(tx)) },
    };
    const orders = { findOne: jest.fn(async () => order) };
    const drivers = {
      findByUserId: jest.fn(async () => ({ carModel: 'Cobalt', carNumber: '10A123BC' })),
      getLastLocationByUserId: jest.fn(async () => ({ lat: 41.01, lng: 70.14 })),
    };
    const settings = { getSafetyPolicySettings: jest.fn(async () => ({ tripShareGraceMinutes: 30 })) };
    const audit = { record: jest.fn(async () => ({ id: 'a1' })) };
    const service = new TripShareService(
      links as never,
      orders as never,
      drivers as never,
      settings as never,
      audit as never,
    );
    return { service, tx, links, audit, drivers };
  }

  it("yo'lovchi faol safarda havola oladi; bazaga faqat xesh, audit bilan", async () => {
    const { service, tx, audit } = build();
    const created = await service.create('o1', 'p1');
    expect(created.path).toBe(`/share/${created.token}`);
    expect(tx.save).toHaveBeenCalledWith(
      TripShareLink,
      expect.objectContaining({ orderId: 'o1', tokenHash: hashShareToken(created.token), createdBy: 'p1' }),
    );
    expect(JSON.stringify(tx.save.mock.calls)).not.toContain(created.token);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'trip_share.create', targetId: 'o1', metadata: { linkId: 'link-1' } }),
      tx,
    );
  });

  it('haydovchi, begona, faol bo\'lmagan safar va chegara — rad', async () => {
    await expect(build().service.create('o1', 'd1')).rejects.toThrow(ForbiddenException);
    await expect(build({ ...baseOrder, status: OrderStatus.SEARCHING, driverId: null }).service.create('o1', 'p1')).rejects.toThrow(
      BadRequestException,
    );
    const capped = build();
    capped.links.count.mockResolvedValue(10);
    await expect(capped.service.create('o1', 'p1')).rejects.toThrow(/chegarasiga/);
    await expect(build(null).service.create('o1', 'p1')).rejects.toThrow(NotFoundException);
  });

  it("ommaviy ko'rinish: telefon yo'q, ism qisqa, joylashuv faqat safar davomida", async () => {
    const token = newShareToken();
    const { service } = build(baseOrder, { orderId: 'o1', tokenHash: hashShareToken(token), revokedAt: null });
    const view = await service.view(token, new Date('2026-11-04T10:05:00Z'));
    expect(view).toEqual({
      status: OrderStatus.IN_PROGRESS,
      driverName: 'Alisher K.',
      carModel: 'Cobalt',
      carNumber: '10A123BC',
      dropoffAddress: 'Angren, Navoiy 5',
      location: { lat: 41.01, lng: 70.14 },
      expiresAt: null,
    });
    expect(JSON.stringify(view)).not.toContain('+998');
  });

  it("tugagan safar: grace ichida joylashuvsiz, keyin 410", async () => {
    const token = newShareToken();
    const done = { ...baseOrder, status: OrderStatus.COMPLETED, completedAt: new Date('2026-11-04T11:00:00Z') };
    const { service, drivers } = build(done, { orderId: 'o1', tokenHash: hashShareToken(token), revokedAt: null });
    const view = await service.view(token, new Date('2026-11-04T11:10:00Z'));
    expect(view.location).toBeNull();
    expect(view.expiresAt).toBe('2026-11-04T11:30:00.000Z');
    expect(drivers.getLastLocationByUserId).not.toHaveBeenCalled();
    await expect(service.view(token, new Date('2026-11-04T11:31:00Z'))).rejects.toThrow(GoneException);
  });

  it('noto\'g\'ri / bekor qilingan token — 404 (bazaga bormasdan ham)', async () => {
    const { service, links } = build();
    await expect(service.view('bad')).rejects.toThrow(NotFoundException);
    expect(links.findOne).not.toHaveBeenCalled();
    const token = newShareToken();
    await expect(
      build(baseOrder, { orderId: 'o1', tokenHash: hashShareToken(token), revokedAt: new Date() }).service.view(token),
    ).rejects.toThrow(NotFoundException);
  });
});
