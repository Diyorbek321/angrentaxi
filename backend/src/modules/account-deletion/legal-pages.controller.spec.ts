import { LegalPagesController } from './legal-pages.controller';

/** Oferta sahifalari: HTML, QORALAMA belgisi, jonli komissiya va zaxira. */
describe('LegalPagesController — oferta sahifalari', () => {
  function build(getDefaultCommissionRate: jest.Mock) {
    const settings = {
      getPublicSettings: jest.fn(async () => ({ platformName: 'Angren Taxi', supportPhone: '+998 90 123 45 67' })),
      getDefaultCommissionRate,
    };
    const config = { get: jest.fn(() => undefined) };
    const controller = new LegalPagesController(settings as never, config as never);
    const req = { protocol: 'https', get: () => 'api.example.uz' };
    const sent: string[] = [];
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn((html: string) => sent.push(html)) };
    return { controller, req, res, sent };
  }

  it("haydovchi ofertasi: jonli komissiya stavkasi va QORALAMA belgisi", async () => {
    const { controller, req, res, sent } = build(jest.fn(async () => 8));
    await controller.driverTerms(req as never, res as never, 'uz');
    expect(res.type).toHaveBeenCalledWith('html');
    expect(sent[0]).toContain('class="draft"');
    expect(sent[0]).toContain('QORALAMA');
    expect(sent[0]).toContain('8%');
    expect(sent[0]).toContain('https://api.example.uz/api/v1/legal/privacy');
  });

  it('sozlama o\'qilmasa ham sahifa ochiladi — standart 10%', async () => {
    const { controller, req, res, sent } = build(jest.fn(async () => { throw new Error('db down'); }));
    await controller.driverTerms(req as never, res as never, 'ru');
    expect(sent[0]).toContain('ЧЕРНОВИК');
    expect(sent[0]).toContain('10%');
  });

  it("yo'lovchi va sotuvchi sahifalari ham ochiladi", async () => {
    const { controller, req, res, sent } = build(jest.fn(async () => 10));
    await controller.terms(req as never, res as never, 'uz');
    await controller.vendorTerms(req as never, res as never, 'ru');
    expect(sent[0]).toContain('Foydalanuvchi ofertasi');
    expect(sent[1]).toContain('Условия для продавцов');
  });
});
