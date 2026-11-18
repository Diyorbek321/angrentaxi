// `GET /drivers/me/verification` kontrakti uchun testlar.
//
// Eng muhim talab: ro'yxat SERVERDAN keladi va mobil tomonda hech qanday
// qattiq kodlangan jadval yo'q. Shundan kelib chiqib bu yerda ikki narsa
// tekshiriladi:
//   1. server bergan `code`/`label`/`hint` o'zgarishsiz o'tadi;
//   2. NOMA'LUM `status` kelganda ilova YIQILMAYDI — element "e'tibor
//      talab qiladi" deb ko'rsatiladi, lekin hech narsani bloklamaydi.
import 'package:angren_taxi/shared/models/driver_verification.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _item({
  String code = 'vehicle_photo_front',
  String? label = 'Avtomobil old tomondan',
  String? hint = "Davlat raqami ko'rinsin",
  String kind = 'vehicle_photo',
  String status = 'ok',
  String? validUntil,
  num? daysLeft,
  String? rejectionReason,
  bool isRequired = true,
}) =>
    {
      'code': code,
      'label': label,
      'hint': hint,
      'kind': kind,
      'status': status,
      'validUntil': validUntil,
      'daysLeft': daysLeft,
      'rejectionReason': rejectionReason,
      'isRequired': isRequired,
    };

void main() {
  group('DriverVerification.fromJson', () {
    test('kontrakt bo\'yicha to\'liq javobni o\'qiydi', () {
      final verification = DriverVerification.fromJson({
        'canGoOnline': false,
        'blockedReason': "Haydovchilik guvohnomasi muddati o'tgan",
        'items': [
          _item(
            code: 'driver_license',
            label: 'Haydovchilik guvohnomasi',
            hint: null,
            kind: 'document',
            status: 'overdue',
            validUntil: '2026-09-19T10:00:00.000Z',
            daysLeft: -5,
          ),
        ],
      });

      expect(verification.canGoOnline, isFalse);
      expect(
        verification.blockedReason,
        "Haydovchilik guvohnomasi muddati o'tgan",
      );
      expect(verification.items, hasLength(1));

      final item = verification.items.single;
      expect(item.code, 'driver_license');
      expect(item.label, 'Haydovchilik guvohnomasi');
      expect(item.hint, isNull);
      expect(item.kind, DriverVerificationKind.document);
      expect(item.status, DriverVerificationStatus.overdue);
      expect(item.daysLeft, -5);
      expect(item.validUntil, DateTime.utc(2026, 9, 19, 10));
      expect(item.isRequired, isTrue);
    });

    test('label va hint serverdan o\'zgarishsiz o\'tadi', () {
      // Mobil tomonda tarjima jadvali YO'Q — server nima bersa, shu.
      final verification = DriverVerification.fromJson({
        'canGoOnline': true,
        'items': [
          _item(
            code: 'taxi_permit_2027',
            label: 'Taksi litsenziyasi (2027)',
            hint: 'QR kod aniq ko\'rinsin',
          ),
        ],
      });

      final item = verification.items.single;
      expect(item.label, 'Taksi litsenziyasi (2027)');
      expect(item.hint, 'QR kod aniq ko\'rinsin');
    });

    test('server yorliq bermasa `code` ning o\'zi ko\'rsatiladi', () {
      final verification = DriverVerification.fromJson({
        'items': [_item(code: 'weird_new_code', label: null)],
      });

      expect(verification.items.single.label, 'weird_new_code');
    });

    test('kodsiz element tashlab yuboriladi', () {
      // Kodsiz elementni yuklab bo'lmaydi (manzil qurilmaydi), shuning
      // uchun uni ko'rsatishning ma'nosi yo'q.
      final verification = DriverVerification.fromJson({
        'items': [_item(code: ''), _item(code: 'ok_code')],
      });

      expect(verification.items, hasLength(1));
      expect(verification.items.single.code, 'ok_code');
    });

    test('maydonlar yo\'q bo\'lsa haydovchi bloklanmaydi', () {
      // Bo'sh javob "onlayn bo'lish mumkin emas" degani EMAS — haqiqiy
      // cheklovni server `PATCH /drivers/status` da qo'llaydi.
      final verification = DriverVerification.fromJson(const {});

      expect(verification.canGoOnline, isTrue);
      expect(verification.blockedReason, isNull);
      expect(verification.isEmpty, isTrue);
    });

    test('buzuq `validUntil` butun ro\'yxatni yiqitmaydi', () {
      final verification = DriverVerification.fromJson({
        'items': [_item(validUntil: 'kecha')],
      });

      expect(verification.items, hasLength(1));
      expect(verification.items.single.validUntil, isNull);
    });
  });

  group("noma'lum status", () {
    test('ilovani yiqitmaydi va `unknown` ga tushadi', () {
      final verification = DriverVerification.fromJson({
        'canGoOnline': true,
        'items': [_item(status: 'grace_period_2027')],
      });

      expect(
        verification.items.single.status,
        DriverVerificationStatus.unknown,
      );
    });

    test("\"e'tibor talab qiladi\" deb ko'rsatiladi", () {
      expect(
        DriverVerificationStatus.unknown.label,
        "E'tibor talab qiladi",
      );
      expect(
        DriverVerificationStatus.unknown.tone,
        AppStatusTone.warning,
      );
    });

    test('hech narsani bloklamaydi', () {
      final verification = DriverVerification.fromJson({
        'canGoOnline': true,
        'items': [_item(status: 'something_new')],
      });

      // Bloklash qarori faqat serverniki.
      expect(verification.canGoOnline, isTrue);
      expect(verification.hasDueSoon, isFalse);
      // Nima qilish kerakligini bilmaymiz — haydovchini bekorga ishga
      // solmaymiz.
      expect(verification.actionNeededCount, 0);
      expect(DriverVerificationStatus.unknown.needsAction, isFalse);
    });

    test("noma'lum `kind` hujjat ikonasiga tushadi", () {
      final verification = DriverVerification.fromJson({
        'items': [_item(kind: 'hologram_scan')],
      });

      expect(
        verification.items.single.kind,
        DriverVerificationKind.document,
      );
    });
  });

  group('muddat matni', () {
    DriverVerificationItem itemWithDays(num? days) =>
        DriverVerificationItem.fromJson(_item(daysLeft: days));

    test('kelajakdagi muddat "N kun qoldi" deb yoziladi', () {
      expect(itemWithDays(12).deadlineText, '12 kun qoldi');
      expect(itemWithDays(1).deadlineText, '1 kun qoldi');
    });

    test('manfiy qiymat "N kun kechikkan" deb yoziladi', () {
      expect(itemWithDays(-5).deadlineText, '5 kun kechikkan');
      expect(itemWithDays(-1).deadlineText, '1 kun kechikkan');
    });

    test('bugun tugaydigan muddat alohida yoziladi', () {
      expect(itemWithDays(0).deadlineText, 'Bugun tugaydi');
    });

    test('muddatsiz talabda matn umuman chiqmaydi', () {
      expect(itemWithDays(null).deadlineText, isNull);
    });
  });

  group('yordamchi hisoblar', () {
    test('due_soon element ogohlantirishni yoqadi', () {
      final verification = DriverVerification.fromJson({
        'items': [_item(status: 'ok'), _item(code: 'b', status: 'due_soon')],
      });

      expect(verification.hasDueSoon, isTrue);
      expect(verification.actionNeededCount, 1);
    });

    test('tekshirilayotgan element harakat talab qilmaydi', () {
      final verification = DriverVerification.fromJson({
        'items': [_item(status: 'pending_review')],
      });

      expect(verification.actionNeededCount, 0);
    });

    test('withItem elementni tartibni buzmasdan almashtiradi', () {
      final verification = DriverVerification.fromJson({
        'items': [
          _item(code: 'a', status: 'missing'),
          _item(code: 'b', status: 'ok'),
        ],
      });

      final updated = verification.withItem(
        DriverVerificationItem.fromJson(
          _item(code: 'a', status: 'pending_review'),
        ),
      );

      expect(updated.items.map((e) => e.code), ['a', 'b']);
      expect(
        updated.items.first.status,
        DriverVerificationStatus.pendingReview,
      );
    });

    test('withItem yangi kodni oxiriga qo\'shadi', () {
      final verification = DriverVerification.fromJson({
        'items': [_item(code: 'a')],
      });

      final updated = verification.withItem(
        DriverVerificationItem.fromJson(_item(code: 'z')),
      );

      expect(updated.items.map((e) => e.code), ['a', 'z']);
    });
  });
}
