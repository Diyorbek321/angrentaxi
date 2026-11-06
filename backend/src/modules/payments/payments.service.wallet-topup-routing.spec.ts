import { PaymentsService } from './payments.service';

/**
 * To'lov callback'lari: `topup_<id>` havolasi hamyonni to'ldirish oqimiga
 * ketadi, buyurtma UUID'i esa avvalgidek buyurtma oqimida qoladi
 * (docs/LEGAL-COMPLIANCE.md §11). Imzo tekshiruvi ikkalasi uchun umumiy.
 */
describe('PaymentsService — hamyonni to\'ldirish callback marshruti', () => {
  function build(signatureOk = true) {
    const transactionRepository = { findOne: jest.fn(async () => null), update: jest.fn() };
    const callbacks = {
      handleUzcard: jest.fn(async () => ({ success: true, message: 'OK' })),
    };
    const service = new PaymentsService(
      transactionRepository as never,
      { findOne: jest.fn(async () => null) } as never,
      { findOne: jest.fn(async () => null) } as never,
      { findOne: jest.fn(async () => null) } as never,
      {} as never,
      {} as never,
      { verifyCallbackSignature: jest.fn(() => signatureOk) } as never,
      { verifyCallbackSignature: jest.fn(() => signatureOk) } as never,
      { verifyCallback: jest.fn(() => signatureOk) } as never,
      {} as never,
      {} as never,
      {} as never,
      callbacks as never,
    );
    return { service, callbacks };
  }

  // Payme/Click marshruti endi `merchant/payment-targets.service.spec.ts` da
  // (ikkala oqim uchun yagona protokol).

  it("imzo noto'g'ri — to'ldirish oqimiga yetib bormaydi", async () => {
    const { service, callbacks } = build(false);
    await service.handleUzcardCallback({ order_id: 'topup_t1', status: 'PAID' });
    expect(callbacks.handleUzcard).not.toHaveBeenCalled();
  });

  it("UZPS: topup_ havolasi — to'ldirish oqimiga", async () => {
    const { service, callbacks } = build();
    await service.handleUzcardCallback({ order_id: 'topup_t1', status: 'PAID' });
    expect(callbacks.handleUzcard).toHaveBeenCalled();
  });
});
