import { Tariff } from '../../database/entities/tariff.entity';
import { meteredTariff } from './metered-rate';

const tariff = (over: Partial<Tariff> = {}) =>
  ({ id: 't1', basePrice: 5000, pricePerKm: 1500, pricePerMin: 200, meteredPricePerKm: null, ...over }) as Tariff;

describe('meteredTariff', () => {
  it('taksometr km narxi qo\'yilgan bo\'lsa shuni ishlatadi', () => {
    const result = meteredTariff(tariff({ meteredPricePerKm: 1800 }), true);
    expect(result.pricePerKm).toBe(1800);
    // Boshqa stavkalar o'zgarmaydi.
    expect(result.basePrice).toBe(5000);
    expect(result.pricePerMin).toBe(200);
  });

  it('qo\'yilmagan bo\'lsa oddiy km narxi qoladi', () => {
    expect(meteredTariff(tariff(), true).pricePerKm).toBe(1500);
  });

  it('manzilli (taksometrsiz) safarga tegmaydi', () => {
    expect(meteredTariff(tariff({ meteredPricePerKm: 1800 }), false).pricePerKm).toBe(1500);
  });

  it('asl tarif obyektini o\'zgartirmaydi', () => {
    const original = tariff({ meteredPricePerKm: 1800 });
    meteredTariff(original, true);
    expect(original.pricePerKm).toBe(1500);
  });
});
