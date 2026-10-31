// Kutish haqi hisobi — MOBIL tomondagi formula.
//
// ⚠️ BU TESTLAR SERVER QOIDASINI QO'RIQLAYDI. Backend'dagi
// `backend/src/modules/tariffs/waiting-charge.ts` pul undiradigan yagona
// hisob; bu yerdagi kod uning nusxasi. Ikkalasi ajralib ketsa ekranda 3
// so'm, chekda 4 so'm chiqadi — aynan shu farq hisoblagichga bo'lgan
// ishonchni yo'q qiladi. Shuning uchun chegara qiymatlari (3:00.000 va
// 3:00.001) va 7:10 → 2500 misoli server hujjatidan AYNAN ko'chirilgan.
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/waiting_charge.dart';
import 'package:flutter_test/flutter_test.dart';

/// Sanoq boshlangan qat'iy lahza — testlar `DateTime.now()` ga tayanmaydi.
final DateTime _arrivedAt = DateTime.utc(2026, 8, 29, 10);

WaitingCharge _chargeAfter(
  Duration elapsed, {
  int freeWaitMinutes = kDefaultFreeWaitMinutes,
  int waitingPricePerMinute = kDefaultWaitingPricePerMinute,
}) {
  return computeWaitingCharge(
    arrivedAt: _arrivedAt,
    now: _arrivedAt.add(elapsed),
    freeWaitMinutes: freeWaitMinutes,
    waitingPricePerMinute: waitingPricePerMinute,
  );
}

void main() {
  group('computeWaitingCharge — bepul oyna ichida', () {
    test('haydovchi endi kelgan: haq yo\'q, butun oyna qolgan', () {
      final charge = _chargeAfter(Duration.zero);

      expect(charge.billableMinutes, 0);
      expect(charge.fare, 0);
      expect(charge.isFree, isTrue);
      expect(charge.isBilling, isFalse);
      expect(charge.freeRemaining, const Duration(minutes: 3));
    });

    test('1:30 kutildi: hali bepul, 1:30 qolgan', () {
      final charge = _chargeAfter(const Duration(seconds: 90));

      expect(charge.fare, 0);
      expect(charge.isFree, isTrue);
      expect(charge.freeRemaining, const Duration(seconds: 90));
      expect(charge.elapsed, const Duration(seconds: 90));
    });

    // ⚠️ CHEGARA — server hujjatidagi qiymat. Uchinchi daqiqaning oxirgi
    // lahzasi HALI BEPUL: chegara ichkarida.
    test('AYNAN 3:00.000 — hali bepul', () {
      final charge = _chargeAfter(const Duration(minutes: 3));

      expect(charge.billableMinutes, 0);
      expect(charge.fare, 0);
      expect(charge.isFree, isTrue);
      expect(charge.freeRemaining, Duration.zero);
    });
  });

  group('computeWaitingCharge — bepul oynadan keyin', () {
    // ⚠️ CHEGARA: 3:00.001 da TO'RTINCHI daqiqa boshlangan deb qaraladi va
    // TO'LIQ undiriladi. Bu "boshlangan daqiqa to'liq" qoidasi.
    test('3:00.001 — to\'rtinchi daqiqa boshlandi, to\'liq 500 so\'m', () {
      final charge = _chargeAfter(
        const Duration(minutes: 3, milliseconds: 1),
      );

      expect(charge.billableMinutes, 1);
      expect(charge.fare, 500);
      expect(charge.isBilling, isTrue);
      expect(charge.freeRemaining, Duration.zero);
    });

    test('7:10 kutish → ceil(7.17) = 8, 8 - 3 = 5 daqiqa = 2500 so\'m', () {
      final charge = _chargeAfter(const Duration(minutes: 7, seconds: 10));

      expect(charge.billableMinutes, 5);
      expect(charge.fare, 2500);
    });

    test('to\'liq daqiqada yaxlitlash qo\'shimcha daqiqa QO\'SHMAYDI', () {
      // 8:00.000 → ceil(8) = 8, 8 - 3 = 5. Agar `ceil` suzuvchi nuqta
      // bo'linmasidan olinganda edi (480000 / 60000 = 8.000000000000002),
      // bu yerda 6 daqiqa chiqib, yo'lovchidan 500 so'm ortiqcha
      // undirilardi.
      final charge = _chargeAfter(const Duration(minutes: 8));

      expect(charge.billableMinutes, 5);
      expect(charge.fare, 2500);
    });

    test('narx har doim butun so\'m — float xatosi yo\'q', () {
      for (var minutes = 4; minutes <= 60; minutes++) {
        final charge = _chargeAfter(Duration(minutes: minutes));
        expect(charge.fare, (minutes - 3) * 500);
        expect(charge.fare % 1, 0);
      }
    });
  });

  group('computeWaitingCharge — xavfsiz holatlar (hech qachon ortiqcha)', () {
    test('arrivedAt = null (eski buyurtma) → nol', () {
      final charge = computeWaitingCharge(
        arrivedAt: null,
        now: _arrivedAt.add(const Duration(hours: 2)),
      );

      expect(charge, same(WaitingCharge.none));
      expect(charge.fare, 0);
      expect(charge.billableMinutes, 0);
      expect(charge.isBilling, isFalse);
    });

    test('teskari tartibdagi vaqt (qurilma soati orqada) → nol, chegirma '
        'EMAS', () {
      final charge = _chargeAfter(const Duration(minutes: -30));

      expect(charge.fare, 0);
      expect(charge.billableMinutes, 0);
      expect(charge.elapsed, Duration.zero);
      // Bepul oyna hali to'liq — manfiy vaqt uni "yeb" qo'ymasligi kerak.
      expect(charge.freeRemaining, const Duration(minutes: 3));
    });

    test('buzuq tarif (manfiy qiymatlar) → manfiy narx bermaydi', () {
      final charge = _chargeAfter(
        const Duration(minutes: 10),
        freeWaitMinutes: -5,
        waitingPricePerMinute: -500,
      );

      expect(charge.fare, 0);
      expect(charge.fare, isNonNegative);
    });
  });

  group('computeWaitingCharge — tarif qiymatlari', () {
    test('tarifning O\'Z qiymatlari ishlatiladi, standart EMAS', () {
      // Bepul 5 daqiqa, daqiqasiga 700 so'm: ceil(7.17) = 8, 8 - 5 = 3.
      final charge = _chargeAfter(
        const Duration(minutes: 7, seconds: 10),
        freeWaitMinutes: 5,
        waitingPricePerMinute: 700,
      );

      expect(charge.billableMinutes, 3);
      expect(charge.fare, 2100);
      expect(charge.freeRemaining, Duration.zero);
    });

    test('bepul oynasiz tarif — birinchi daqiqadan haq olinadi', () {
      final charge = _chargeAfter(
        const Duration(seconds: 1),
        freeWaitMinutes: 0,
        waitingPricePerMinute: 500,
      );

      expect(charge.billableMinutes, 1);
      expect(charge.fare, 500);
    });
  });

  group('formatWaitClock', () {
    test('daqiqa:soniya ko\'rinishida, soniya ikki xonali', () {
      expect(formatWaitClock(const Duration(seconds: 90)), '1:30');
      expect(formatWaitClock(const Duration(seconds: 7)), '0:07');
      expect(formatWaitClock(const Duration(minutes: 12, seconds: 5)), '12:05');
    });

    test('bir soatdan oshsa soat ham ko\'rsatiladi', () {
      expect(
        formatWaitClock(const Duration(hours: 1, minutes: 1, seconds: 1)),
        '1:01:01',
      );
    });

    // ⚠️ Sanoq ORQAGA uchun: 0.5 soniya qolganda "0:00" chiqsa, ekranda
    // oyna tugagan bo'lib ko'rinardi, holbuki haq hali boshlanmagan.
    test('soniyalar YUQORIGA yaxlitlanadi', () {
      expect(formatWaitClock(const Duration(milliseconds: 500)), '0:01');
      expect(formatWaitClock(const Duration(milliseconds: 1)), '0:01');
      expect(formatWaitClock(Duration.zero), '0:00');
      expect(formatWaitClock(const Duration(seconds: -5)), '0:00');
    });
  });

  group('Order.fromJson — kutish shartnomasi', () {
    Map<String, dynamic> baseJson() => {
          'id': 'order-1',
          'passengerId': 'passenger-1',
          'pickup': const {'address': 'A', 'lat': 41.0, 'lng': 70.0},
          'dropoff': const {'address': 'B', 'lat': 41.1, 'lng': 70.1},
          'status': 'arrived',
          'estimatedPrice': 20000.0,
          'createdAt': '2026-08-29T09:00:00.000Z',
        };

    test('uchta maydon ildizdan o\'qiladi va UTC mahalliyga o\'giriladi', () {
      final order = Order.fromJson({
        ...baseJson(),
        'arrivedAt': '2026-08-29T10:00:00.000Z',
        'freeWaitMinutes': 5,
        'waitingPricePerMinute': 700,
      });

      expect(order.arrivedAt, isNotNull);
      expect(
        order.arrivedAt!.toUtc(),
        DateTime.utc(2026, 8, 29, 10),
      );
      expect(order.arrivedAt!.isUtc, isFalse);
      expect(order.freeWaitMinutes, 5);
      expect(order.waitingPricePerMinute, 700);
    });

    // ⚠️ ORQAGA MOSLIK: migratsiyadan oldingi buyurtmalar va eski server
    // bu maydonlarni umuman yubormaydi. Ilova YIQILMASLIGI kerak.
    test('maydonlar umuman bo\'lmasa — standart tarif, arrivedAt null', () {
      final order = Order.fromJson(baseJson());

      expect(order.arrivedAt, isNull);
      expect(order.freeWaitMinutes, kDefaultFreeWaitMinutes);
      expect(order.waitingPricePerMinute, kDefaultWaitingPricePerMinute);
    });

    test('arrivedAt = null bo\'lib kelsa hisoblagich o\'chadi', () {
      final order = Order.fromJson({...baseJson(), 'arrivedAt': null});

      expect(order.arrivedAt, isNull);
      expect(
        computeWaitingCharge(
          arrivedAt: order.arrivedAt,
          now: DateTime.now(),
          freeWaitMinutes: order.freeWaitMinutes,
          waitingPricePerMinute: order.waitingPricePerMinute,
        ).fare,
        0,
      );
    });

    // Bitta buzuq maydon butun faol safar ekranini o'ldirmasligi kerak.
    test('yaroqsiz sana matni — yiqilmaydi, null bo\'ladi', () {
      final order = Order.fromJson({
        ...baseJson(),
        'arrivedAt': 'kecha kechqurun',
      });

      expect(order.arrivedAt, isNull);
    });
  });

  group('Order — tenglik', () {
    // `props` ga qo'shilmagan maydon o'zgarsa `copyWith` natijasi eskisiga
    // TENG deb topilardi va Provider `notifyListeners()` chaqirsa ham
    // hisoblagich yangilanmasdi.
    test('kutish maydonlari tenglikda hisobga olinadi', () {
      final order = Order.fromJson(const {
        'id': 'order-1',
        'passengerId': 'passenger-1',
        'pickup': {'address': 'A', 'lat': 41.0, 'lng': 70.0},
        'dropoff': {'address': 'B', 'lat': 41.1, 'lng': 70.1},
        'status': 'accepted',
        'estimatedPrice': 20000.0,
        'createdAt': '2026-08-29T09:00:00.000Z',
      });

      final arrived = order.copyWith(
        status: OrderStatus.driverArrived,
        arrivedAt: DateTime.utc(2026, 8, 29, 10).toLocal(),
      );

      expect(arrived, isNot(equals(order)));
      expect(arrived.arrivedAt, isNotNull);
      expect(
        order.copyWith(waitingPricePerMinute: 700),
        isNot(equals(order)),
      );
    });
  });
}
