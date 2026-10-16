// Kutish hisobi qachondan: rejalashtirilgan safarda erta kelgan haydovchi
// uchun — belgilangan vaqtdan (server `waitingStartOf` bilan bir xil qoida).
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter_test/flutter_test.dart';

Order _order({String? arrivedAt, String? scheduledAt}) => Order.fromJson({
      'id': 'o-1',
      'passengerId': 'p-1',
      'pickup': {'address': 'A', 'lat': 41.0, 'lng': 70.1},
      'dropoff': {'address': 'B', 'lat': 41.1, 'lng': 70.2},
      'status': 'driver_arrived',
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-16T09:00:00.000Z',
      if (arrivedAt != null) 'arrivedAt': arrivedAt,
      if (scheduledAt != null) 'scheduledAt': scheduledAt,
    });

void main() {
  test('oddiy safar — haydovchi kelgan lahza', () {
    final o = _order(arrivedAt: '2026-10-16T09:54:00.000Z');
    expect(o.waitingStartsAt, o.arrivedAt);
  });

  test('erta kelgan haydovchi — belgilangan vaqtdan', () {
    final o = _order(arrivedAt: '2026-10-16T09:54:00.000Z', scheduledAt: '2026-10-16T10:00:00.000Z');
    expect(o.waitingStartsAt, o.scheduledAt);
  });

  test('kech kelgan haydovchi — o\'zi kelgan lahzadan', () {
    final o = _order(arrivedAt: '2026-10-16T10:05:00.000Z', scheduledAt: '2026-10-16T10:00:00.000Z');
    expect(o.waitingStartsAt, o.arrivedAt);
  });

  test('haydovchi kelmagan — null', () {
    expect(_order(scheduledAt: '2026-10-16T10:00:00.000Z').waitingStartsAt, isNull);
  });
}
