import { IntercityBookingKind, OrderStatus, PaymentMethod, ServiceType } from '../../database/entities/order.entity';
import { agreedFareBreakdown } from '../tariffs/fare-breakdown';
import { insertBookingOrder } from './intercity-booking-writer';

/**
 * Mock'langan servis spec'lari SQL'ni bajarmaydi — shuning uchun INSERT'da
 * bitta `$n` tushib qolgani (17 ustun, 16 qiymat) 4-qadamdan beri hech bir
 * testda ko'rinmadi va faqat haqiqiy bazada "INSERT has more target columns
 * than expressions" bilan yiqildi. Bu spec SQL tuzilishini o'zi tekshiradi.
 */

/** Yuqori darajadagi vergullar bo'yicha bo'lish (qavs ichidagilar emas). */
function splitTopLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function captureInsert(): Promise<{ sql: string; params: unknown[] }> {
  const manager = { query: jest.fn(async (..._args: unknown[]) => [{ id: 'order-1' }]) };
  await insertBookingOrder(manager as never, {
    passengerId: 'pax-1',
    driverUserId: 'driver-user-1',
    tariffId: 'tariff-1',
    tripId: 'trip-1',
    departureAt: new Date('2026-10-18T09:00:00Z'),
    seats: 2,
    kind: IntercityBookingKind.SEAT,
    pickup: { lat: 41.0167, lng: 70.1436, address: 'Angren' },
    dropoff: { lat: 41.268, lng: 69.366, address: 'Rohat krugi' },
    fare: agreedFareBreakdown(50000, 0, 120),
    paymentMethod: PaymentMethod.CASH,
  });
  const [sql, params] = manager.query.mock.calls[0] as [string, unknown[]];
  return { sql, params };
}

describe('insertBookingOrder — SQL tuzilishi', () => {
  it('ustunlar soni = qiymatlar soni', async () => {
    const { sql } = await captureInsert();
    const columns = splitTopLevel(sql.match(/INSERT INTO "orders" \(([^)]*)\)/)![1]);
    const values = splitTopLevel(sql.match(/VALUES \(([\s\S]*)\)\s*RETURNING/)![1]);
    expect(values).toHaveLength(columns.length);
  });

  it("har bir parametr ishlatiladi va eng katta `$n` = parametrlar soni", async () => {
    const { sql, params } = await captureInsert();
    const used = new Set([...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])));
    expect(Math.max(...used)).toBe(params.length);
    expect(used.size).toBe(params.length);
  });

  it('har ustunga o\'z qiymati tushadi', async () => {
    const { sql, params } = await captureInsert();
    const columns = splitTopLevel(sql.match(/INSERT INTO "orders" \(([^)]*)\)/)![1]).map((c) => c.replace(/"/g, ''));
    const values = splitTopLevel(sql.match(/VALUES \(([\s\S]*)\)\s*RETURNING/)![1]);
    const valueOf = (column: string): unknown => {
      const expression = values[columns.indexOf(column)];
      const index = Number(expression.match(/^\$(\d+)/)?.[1]);
      return params[index - 1];
    };
    expect(valueOf('status')).toBe(OrderStatus.SCHEDULED);
    expect(valueOf('service_type')).toBe(ServiceType.INTERCITY);
    expect(JSON.parse(valueOf('fare_breakdown') as string)).toMatchObject({ total: 50000 });
    expect(valueOf('estimated_price')).toBe(50000);
    expect(valueOf('intercity_trip_id')).toBe('trip-1');
    expect(valueOf('seats')).toBe(2);
    expect(valueOf('booking_kind')).toBe(IntercityBookingKind.SEAT);
  });
});
