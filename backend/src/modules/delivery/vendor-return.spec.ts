import { BadRequestException } from '@nestjs/common';
import { AUDIT_ACTIONS } from '../audit/audit-log.service';
import { assertVendorCanConfirmReturn, handleVendorReturnEvent } from './vendor-return';

function ctx(order: Record<string, unknown>, paidByCard = 0, affected = 1) {
  const update = jest.fn(async () => ({ affected }));
  const find = jest.fn(async () => (paidByCard ? [{ amount: paidByCard }] : []));
  const emit = jest.fn();
  const push = jest.fn(async () => undefined);
  const audit = jest.fn(async () => undefined);
  const afterReturned = jest.fn(async () => undefined);
  return {
    c: {
      kind: 'food' as const,
      order: { id: 'fo-1', customerId: 'cust', paymentMethod: 'cash', status: 'ready', ...order } as never,
      ownerUserId: 'owner',
      repo: { update } as never,
      transactions: { find } as never,
      inTransitStatus: 'ready',
      emit,
      push,
      audit,
      afterReturned,
    },
    update,
    emit,
    push,
    audit,
    afterReturned,
  };
}

describe('handleVendorReturnEvent', () => {
  it("delivery_failed → returning, ikkala tomonga, sotuvchiga push", async () => {
    const h = ctx({});
    await expect(handleVendorReturnEvent(h.c, { kind: 'delivery_failed', failureReason: 'customer_absent' })).resolves.toBe(
      true,
    );
    expect(h.update).toHaveBeenCalledWith({ id: 'fo-1', status: 'ready' }, { status: 'returning' });
    expect(h.emit).toHaveBeenCalledWith('cust', 'food:order:status', expect.objectContaining({ status: 'returning' }));
    expect(h.emit).toHaveBeenCalledWith('owner', 'food:order:status', expect.objectContaining({ status: 'returning' }));
    expect(h.push).toHaveBeenCalledWith(['owner'], expect.any(Function), 'food_order_returning', { orderId: 'fo-1' });
  });

  it('naqd qaytdi — returned, qaytariladigan pul yo\'q, audit yo\'q', async () => {
    const h = ctx({ status: 'returning' });
    await handleVendorReturnEvent(h.c, { kind: 'returned', customerOwes: 10500 });
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'fo-1' }),
      expect.objectContaining({ status: 'returned', returnCharge: 10500, refundDue: null, refundStatus: null }),
    );
    expect(h.audit).not.toHaveBeenCalled();
    expect(h.afterReturned).toHaveBeenCalled();
  });

  it("kartali qaytdi — to'langan − qarz qo'lda qaytarishga, audit", async () => {
    const h = ctx({ status: 'returning', paymentMethod: 'card' }, 57000);
    await handleVendorReturnEvent(h.c, { kind: 'returned', customerOwes: 10500 });
    expect(h.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refundDue: 46500, refundStatus: 'pending' }),
    );
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.deliveryRefundPending, amount: 46500, actorUserId: null }),
    );
  });

  it("takroriy returned — hech narsa qilmaydi (shartli yozuv)", async () => {
    const h = ctx({ status: 'returned' }, 0, 0);
    await handleVendorReturnEvent(h.c, { kind: 'returned', customerOwes: 10500 });
    expect(h.afterReturned).not.toHaveBeenCalled();
    expect(h.emit).not.toHaveBeenCalled();
  });

  it('boshqa hodisalar — false', async () => {
    const h = ctx({});
    await expect(handleVendorReturnEvent(h.c, { kind: 'delivered' })).resolves.toBe(false);
    expect(h.update).not.toHaveBeenCalled();
  });

  it('sotuvchi tasdig\'i faqat returning holatida', () => {
    expect(() => assertVendorCanConfirmReturn({ status: 'ready', deliveryOrderId: 'r' }, 'returning')).toThrow(
      BadRequestException,
    );
    expect(() => assertVendorCanConfirmReturn({ status: 'returning', deliveryOrderId: null }, 'returning')).toThrow();
    expect(() => assertVendorCanConfirmReturn({ status: 'returning', deliveryOrderId: 'r' }, 'returning')).not.toThrow();
  });
});
