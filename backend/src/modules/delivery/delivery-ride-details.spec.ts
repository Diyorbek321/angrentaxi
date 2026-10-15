import { checkoutDeliveryFee, deliveryRideDetails } from './delivery-ride-details';
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';

describe('checkoutDeliveryFee', () => {
  it('recovers the fee the customer paid from the order total', () => {
    expect(
      checkoutDeliveryFee({
        totalPrice: 71000,
        items: [
          { qty: 2, price: 30000 },
          { qty: 1, price: 4000 },
        ],
      }),
    ).toBe(7000);
  });

  it('never goes negative on a malformed order', () => {
    expect(checkoutDeliveryFee({ totalPrice: 100, items: [{ qty: 1, price: 500 }] })).toBe(0);
  });
});

describe('deliveryRideDetails', () => {
  const base = {
    vendorName: 'Mix Burger',
    vendorPhone: null,
    customerPhone: '+998901234569',
    itemsCount: 2,
    totalPrice: 71000.4,
    itemsTotal: 64000,
  };

  it('asks the courier to collect the full total on a cash order', () => {
    expect(deliveryRideDetails({ ...base, isCash: true }).collectCash).toBe(71000);
  });

  it('asks for nothing on a card order', () => {
    expect(deliveryRideDetails({ ...base, isCash: false }).collectCash).toBe(0);
    expect(deliveryRideDetails({ ...base, isCash: false }).payVendor).toBe(0);
  });

  it('on a cash order the courier pays the vendor for the goods only', () => {
    expect(deliveryRideDetails({ ...base, isCash: true }).payVendor).toBe(64000);
  });

  it('v5: a platform-funded promo code lowers what the courier collects, not what the vendor gets', () => {
    const details = deliveryRideDetails({ ...base, isCash: true, promoDiscount: 9000 });
    expect(details.collectCash).toBe(62000);
    expect(details.payVendor).toBe(64000);
    expect(details.promoDiscount).toBe(9000);
  });

  it('v5: carries the address details for the courier screen (null when absent)', () => {
    expect(deliveryRideDetails({ ...base, isCash: false }).addressDetails).toBeNull();
    expect(
      deliveryRideDetails({ ...base, isCash: false, addressDetails: { entrance: '3', floor: '7' } }).addressDetails,
    ).toEqual({ entrance: '3', floor: '7' });
  });
});

describe('agreedFareBreakdown', () => {
  it('puts the whole fare in one row so the rows still add up to the total', () => {
    const b = agreedFareBreakdown(7000, 3.2, 8);
    const rows =
      b.baseFare + b.distanceFare + b.timeFare + b.minPriceAdjustment + b.surgeFare + b.maxPriceCap + b.waitingFare + b.roundingAdjustment;
    expect(rows).toBe(7000);
    expect(b.total).toBe(7000);
    expect(b.distanceKm).toBe(3.2);
  });
});
