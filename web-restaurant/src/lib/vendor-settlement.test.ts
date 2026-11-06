import { describe, expect, it } from 'vitest';
import { parsePublicSettings, walletSettledToast, walletSwitchNotice } from './vendor-settlement';

const NOW = Date.parse('2026-10-15T10:00:00+05:00');
const FROM = '2026-12-12T00:00:00+05:00';

describe('parsePublicSettings', () => {
  it('noma’lum javob — naqd rejim, sana yo‘q', () => {
    expect(parsePublicSettings(undefined)).toEqual({ vendorSettlementMode: 'cash', vendorWalletSettlementFrom: null });
  });
  it('hamyon rejimi va sana o‘qiladi', () => {
    expect(parsePublicSettings({ vendorSettlementMode: 'wallet', vendorWalletSettlementFrom: FROM })).toEqual({
      vendorSettlementMode: 'wallet',
      vendorWalletSettlementFrom: FROM,
    });
  });
});

describe('walletSwitchNotice', () => {
  it('naqd rejim + kelajakdagi sana — ogohlantirish', () => {
    const text = walletSwitchNotice({ vendorSettlementMode: 'cash', vendorWalletSettlementFrom: FROM }, NOW);
    expect(text).toMatch(/^\d{2}\.\d{2}\.2026 dan hisob-kitob kuryer hamyoni orqali boʻladi$/);
  });
  it('hamyon rejimi, sana o‘tgan yoki yo‘q — banner yo‘q', () => {
    expect(walletSwitchNotice({ vendorSettlementMode: 'wallet', vendorWalletSettlementFrom: FROM }, NOW)).toBeNull();
    expect(
      walletSwitchNotice({ vendorSettlementMode: 'cash', vendorWalletSettlementFrom: FROM }, Date.parse('2026-12-13T00:00:00Z'))
    ).toBeNull();
    expect(walletSwitchNotice({ vendorSettlementMode: 'cash', vendorWalletSettlementFrom: null }, NOW)).toBeNull();
    expect(walletSwitchNotice(null, NOW)).toBeNull();
  });
});

describe('walletSettledToast', () => {
  it('tovar, komissiya va sof summa', () => {
    const t = walletSettledToast({ kind: 'market', vendorOrderId: 'x', amount: 65000, commission: 6500, net: 58500 });
    expect(t.title).toBe('Kuryer hamyonidan toʻlandi');
    expect(t.description).toBe('Tovar 65 000 soʻm · komissiya 6 500 soʻm · sof 58 500 soʻm');
  });
});
