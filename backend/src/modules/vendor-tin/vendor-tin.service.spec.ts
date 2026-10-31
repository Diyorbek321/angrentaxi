import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VendorTinService } from './vendor-tin.service';
import { SetVendorTinDto } from './dto/set-vendor-tin.dto';

describe('VendorTinService — admin sotuvchi STIRini o\'zgartiradi', () => {
  function build(existing: Record<string, unknown> | null = { id: 'r-1', name: 'Osh markazi', tin: null }) {
    const repoFor = () => ({
      findOne: jest.fn(async () => (existing ? { ...existing } : null)),
      save: jest.fn(async (value: unknown) => value),
    });
    const restaurants = repoFor();
    const stores = repoFor();
    const manager = {
      getRepository: jest.fn((entity: { name: string }) => (entity.name === 'Restaurant' ? restaurants : stores)),
    };
    const dataSource = { transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(manager)) };
    const auditLog = { record: jest.fn(async () => ({ id: 'audit-1' })) };
    const service = new VendorTinService(dataSource as never, auditLog as never);
    return { service, restaurants, stores, auditLog };
  }

  it("restoran: STIR saqlanadi va jurnalga eski/yangi qiymat bilan yoziladi (bitta tranzaksiyada)", async () => {
    const { service, restaurants, auditLog } = build();
    const saved = await service.setTin('admin-1', 'restaurant', 'r-1', '123456789');

    expect(saved).toEqual(expect.objectContaining({ id: 'r-1', tin: '123456789' }));
    expect(restaurants.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-1', tin: '123456789' }));
    expect(auditLog.record).toHaveBeenCalledWith(
      {
        actorUserId: 'admin-1',
        action: 'vendor.tin_update',
        targetType: 'restaurant',
        targetId: 'r-1',
        metadata: { previousTin: null, tin: '123456789', name: 'Osh markazi' },
      },
      expect.anything(),
    );
  });

  it("do'kon: null — STIR tozalanadi", async () => {
    const { service, stores } = build({ id: 's-1', name: 'Market', tin: '987654321' });
    await service.setTin('admin-1', 'store', 's-1', null);
    expect(stores.save).toHaveBeenCalledWith(expect.objectContaining({ id: 's-1', tin: null }));
  });

  it("o'zgarmagan qiymat — jurnalga yozilmaydi", async () => {
    const { service, auditLog, restaurants } = build({ id: 'r-1', name: 'X', tin: '123456789' });
    await service.setTin('admin-1', 'restaurant', 'r-1', '123456789');
    expect(auditLog.record).not.toHaveBeenCalled();
    expect(restaurants.save).not.toHaveBeenCalled();
  });

  it('topilmasa — 404', async () => {
    const { service } = build(null);
    await expect(service.setTin('admin-1', 'store', 'x', '123456789')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('DTO', () => {
    const errors = async (body: Record<string, unknown>) =>
      (await validate(plainToInstance(SetVendorTinDto, body))).map((e) => e.property);

    it('9 raqam yoki null; maydon majburiy', async () => {
      expect(await errors({ tin: '123456789' })).toEqual([]);
      expect(await errors({ tin: null })).toEqual([]);
      expect(await errors({ tin: '12345678' })).toEqual(['tin']);
      expect(await errors({ tin: '12345678a' })).toEqual(['tin']);
      expect(await errors({})).toEqual(['tin']);
    });
  });
});
