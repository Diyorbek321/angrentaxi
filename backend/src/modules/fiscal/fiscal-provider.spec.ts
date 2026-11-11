import { NOOP_SKIP_REASON, NoopFiscalProvider, createFiscalProvider } from './fiscal-provider';

describe('fiscal provider tanlovi', () => {
  it('standart — noop', () => {
    expect(createFiscalProvider(undefined).name).toBe('noop');
    expect(createFiscalProvider('').name).toBe('noop');
    expect(createFiscalProvider('NOOP').name).toBe('noop');
  });

  it("noma'lum qiymat — ogohlantirish bilan noop", () => {
    const warn = jest.fn();
    expect(createFiscalProvider('ofd-x', { warn } as never).name).toBe('noop');
    expect(warn).toHaveBeenCalled();
  });

  it("noop chek yubormaydi — 'skipped'", async () => {
    await expect(new NoopFiscalProvider().send()).resolves.toEqual({
      status: 'skipped',
      reason: NOOP_SKIP_REASON,
    });
  });
});
