import { BadRequestException, ConflictException } from '@nestjs/common';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';
import { VendorRefundsService } from './vendor-refunds';

function build(affected = 1) {
  const foodRepo = {
    find: jest.fn(async () => [
      { id: 'fo-1', restaurant: { name: 'Osh' }, customerPhone: '+998', totalPrice: 57000, returnCharge: 10500, refundDue: 46500, returnedAt: new Date('2026-11-03T10:00:00Z') },
    ]),
    findOne: jest.fn(async () => ({ id: 'fo-1', refundDue: 46500 })),
    update: jest.fn(async () => ({ affected })),
  };
  const marketRepo = { find: jest.fn(async () => []) };
  const record = jest.fn();
  return { service: new VendorRefundsService(foodRepo as never, marketRepo as never, { record } as never), foodRepo, record };
}

describe('VendorRefundsService', () => {
  it("kutilayotganlar ro'yxati", async () => {
    const [item] = await build().service.listPending();
    expect(item).toMatchObject({ kind: 'food', vendorName: 'Osh', refundDue: 46500, returnCharge: 10500 });
  });

  it('bajarildi — shartli yozuv + audit', async () => {
    const { service, foodRepo, record } = build();
    await service.markDone('mgr', 'food', 'fo-1', 'Payme #1');
    expect(foodRepo.update).toHaveBeenCalledWith({ id: 'fo-1', refundStatus: 'pending' }, { refundStatus: 'done' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.deliveryRefundDone, amount: 46500, note: 'Payme #1' }),
    );
  });

  it('takror — 409; noto\'g\'ri tur — 400', async () => {
    await expect(build(0).service.markDone('mgr', 'food', 'fo-1')).rejects.toThrow(ConflictException);
    await expect(build().service.markDone('mgr', 'taxi', 'fo-1')).rejects.toThrow(BadRequestException);
  });
});
