import { composeIntercityFare } from './intercity-extension';
import { intercityPriceBreakdown } from './intercity-price-breakdown';

describe('intercityPriceBreakdown', () => {
  it('davomli band — asosiy narx va qatorlar fare_breakdown dan', () => {
    const extension = { side: 'dropoff' as const, pointName: 'Rohat krugi', km: 12.4, pricePerKm: 2000, fare: 25_000, estimated: false };
    const fare = composeIntercityFare(25_000, [extension], 60);
    expect(intercityPriceBreakdown(fare, 50_000)).toEqual({ basePrice: 25_000, extensions: [extension] });
  });

  it('davomsiz eski band (intercityExtensions yo\'q) — asosiy narx = baseFare, qatorlar bo\'sh', () => {
    expect(intercityPriceBreakdown({ baseFare: 50_000 } as never, 50_000)).toEqual({ basePrice: 50_000, extensions: [] });
  });

  it('fare_breakdown umuman yo\'q — asosiy narx = jami narx', () => {
    expect(intercityPriceBreakdown(null, 50_000)).toEqual({ basePrice: 50_000, extensions: [] });
  });
});
