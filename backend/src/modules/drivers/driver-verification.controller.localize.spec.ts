import { localizeVerificationSummary } from './driver-verification.controller';

describe('localizeVerificationSummary (Accept-Language)', () => {
  const summary = {
    canGoOnline: true,
    blockedReason: null,
    items: [
      { code: 'taxi_licence', label: 'Taksi litsenziya varaqasi', hint: 'x', kind: 'document', status: 'missing' },
      { code: 'selfie', label: 'Selfi', hint: null, kind: 'selfie', status: 'ok' },
    ],
  } as never;

  it("ru — 4 ta huquqiy hujjat nomi va izohi ruscha, boshqalari o'zgarmaydi", () => {
    const ru = localizeVerificationSummary(summary, 'ru');
    expect(ru.items[0]).toEqual(
      expect.objectContaining({
        code: 'taxi_licence',
        label: 'Лицензионная карточка такси',
        hint: 'Лицензионная карточка (должны быть видны регион и срок действия)',
        status: 'missing',
      }),
    );
    expect(ru.items[1].label).toBe('Selfi');
  });

  it('uz — aynan o‘sha obyekt', () => {
    expect(localizeVerificationSummary(summary, 'uz')).toBe(summary);
  });
});
