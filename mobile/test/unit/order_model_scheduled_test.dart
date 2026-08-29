// `Order` modelining rejalashtirilgan safar bilan bog'liq qismi.
//
// Eng muhimi — oxirgi test: `scheduledAt` `props` ga qo'shilgani. `Order
// extends Equatable`, ya'ni `props` da yo'q maydon tenglikda HISOBGA
// OLINMAYDI: `copyWith(scheduledAt: ...)` natijasi eskisiga teng deb
// topilardi, `notifyListeners()` chaqirilsa ham `Consumer` qayta
// qurilmasdi va UI jimgina eski qiymatni ko'rsatib turardi.
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> orderJson({String status = 'scheduled', String? scheduledAt}) => {
      'id': 'order-1',
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Angren markazi', 'lat': 40.0956, 'lng': 70.9432},
      'dropoff': {'address': 'Angren bozori', 'lat': 40.105, 'lng': 70.95},
      'status': status,
      'estimatedPrice': 18000,
      'createdAt': '2026-08-19T10:00:00.000Z',
      if (scheduledAt != null) 'scheduledAt': scheduledAt,
    };

void main() {
  group('orderStatusFromString', () {
    test("backend'ning 'scheduled' qiymatini tanidi", () {
      expect(orderStatusFromString('scheduled'), OrderStatus.scheduled);
    });

    test('mavjud qiymatlar o\'zgarmadi', () {
      expect(orderStatusFromString('created'), OrderStatus.pending);
      expect(orderStatusFromString('searching'), OrderStatus.searching);
      expect(orderStatusFromString('cancelled'), OrderStatus.cancelled);
    });

    test('scheduled uchun o\'zbekcha yorliq bor', () {
      expect(OrderStatus.scheduled.label, 'Rejalashtirilgan');
    });
  });

  group('fromJson', () {
    test('scheduledAt ni MAHALLIY vaqtga o\'giradi', () {
      // Backend `timestamptz` (UTC) yuboradi. `.toLocal()` qilinmasa,
      // O'zbekistonda (UTC+5) ekranda 5 soatlik xato ko'rinardi.
      final order = Order.fromJson(
        orderJson(scheduledAt: '2026-08-20T03:00:00.000Z'),
      );

      expect(order.scheduledAt, isNotNull);
      expect(order.scheduledAt!.isUtc, isFalse);
      expect(
        order.scheduledAt!.toUtc(),
        DateTime.utc(2026, 8, 20, 3),
      );
    });

    test('scheduledAt bo\'lmasa null qoladi (odatdagi buyurtma)', () {
      final order = Order.fromJson(orderJson(status: 'created'));

      expect(order.scheduledAt, isNull);
      expect(order.status, OrderStatus.pending);
    });
  });

  group('isActive', () {
    test('rejalashtirilgan safar AKTIV EMAS', () {
      // Aks holda `checkActiveOrder()` uni topib bosh ekranni kuzatuv
      // rejimiga qulflardi va yo'lovchi bugun taksi chaqira olmasdi.
      final order = Order.fromJson(
        orderJson(scheduledAt: '2026-08-20T03:00:00.000Z'),
      );

      expect(order.status, OrderStatus.scheduled);
      expect(order.isActive, isFalse);
    });

    test('haqiqiy aktiv holatlar o\'zgarmadi', () {
      expect(Order.fromJson(orderJson(status: 'searching')).isActive, isTrue);
      expect(Order.fromJson(orderJson(status: 'accepted')).isActive, isTrue);
      expect(Order.fromJson(orderJson(status: 'in_progress')).isActive, isTrue);
      expect(Order.fromJson(orderJson(status: 'completed')).isActive, isFalse);
    });
  });

  group('Equatable — scheduledAt props ichida', () {
    test('faqat scheduledAt bilan farq qiluvchi ikki buyurtma TENG EMAS', () {
      final base = Order.fromJson(orderJson());
      final changed = base.copyWith(scheduledAt: DateTime(2026, 8, 20, 8));

      expect(changed.scheduledAt, isNotNull);
      expect(
        changed,
        isNot(equals(base)),
        reason: "scheduledAt `props` ga qo'shilmagan — copyWith natijasi "
            'eskisiga teng bo\'lib qolyapti va UI yangilanmaydi',
      );
    });

    test('bir xil maydonli ikki buyurtma TENG', () {
      final a = Order.fromJson(orderJson(scheduledAt: '2026-08-20T03:00:00.000Z'));
      final b = Order.fromJson(orderJson(scheduledAt: '2026-08-20T03:00:00.000Z'));

      expect(a, equals(b));
    });

    test('copyWith boshqa maydonlarga tegmaydi', () {
      final base = Order.fromJson(orderJson(scheduledAt: '2026-08-20T03:00:00.000Z'));
      final changed = base.copyWith(status: OrderStatus.searching);

      expect(changed.scheduledAt, base.scheduledAt);
      expect(changed.status, OrderStatus.searching);
    });
  });
}
