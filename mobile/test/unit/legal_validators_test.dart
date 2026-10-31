// Huquqiy profil validatorlari (JShShIR / STIR) va server rad etish
// matnlarini tanib olish — docs/LEGAL-COMPLIANCE.md §1, §5, §7.
import 'package:angren_taxi/features/driver/legal/legal_rejection.dart';
import 'package:angren_taxi/features/driver/legal/legal_validators.dart';
import 'package:angren_taxi/shared/models/driver_legal.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

DioException _badRequest(String message, {int status = 400}) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      response: Response(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: status,
        data: {'success': false, 'message': message, 'statusCode': status},
      ),
    );

void main() {
  group('LegalValidators.pinfl', () {
    test('bo\'sh — majburiy xabar', () {
      expect(LegalValidators.pinfl(''), 'JShShIR kiriting');
      expect(LegalValidators.pinfl(null), 'JShShIR kiriting');
    });

    test('aynan 14 raqam qabul qilinadi (bo\'sh joylar e\'tiborsiz)', () {
      expect(LegalValidators.pinfl('12345678901234'), isNull);
      expect(LegalValidators.pinfl('1234 5678 9012 34'), isNull);
    });

    test('13 yoki 15 raqam, harf — format xatosi', () {
      const msg = "JShShIR 14 ta raqamdan iborat bo'lishi kerak";
      expect(LegalValidators.pinfl('1234567890123'), msg);
      expect(LegalValidators.pinfl('123456789012345'), msg);
      expect(LegalValidators.pinfl('1234567890123A'), msg);
    });
  });

  group('LegalValidators.tin', () {
    test('YaTT uchun STIR majburiy', () {
      expect(
        LegalValidators.tin('', taxStatus: DriverTaxStatus.individualEntrepreneur),
        'YaTT uchun STIR majburiy',
      );
    });

    test("o'zini o'zi band qilgan uchun bo'sh STIR — xato emas", () {
      expect(
        LegalValidators.tin('', taxStatus: DriverTaxStatus.selfEmployed),
        isNull,
      );
      expect(LegalValidators.tin(null, taxStatus: null), isNull);
    });

    test('kiritilgan bo\'lsa aynan 9 raqam bo\'lishi kerak', () {
      const msg = "STIR 9 ta raqamdan iborat bo'lishi kerak";
      expect(
        LegalValidators.tin('123456789',
            taxStatus: DriverTaxStatus.individualEntrepreneur),
        isNull,
      );
      expect(
        LegalValidators.tin('12345678', taxStatus: DriverTaxStatus.selfEmployed),
        msg,
      );
      expect(
        LegalValidators.tin('1234567890',
            taxStatus: DriverTaxStatus.individualEntrepreneur),
        msg,
      );
    });

    test('soliq maqomi tanlanmagan — xato', () {
      expect(LegalValidators.taxStatus(null), 'Soliq maqomini tanlang');
      expect(LegalValidators.taxStatus(DriverTaxStatus.selfEmployed), isNull);
    });
  });

  group('server rad etish matnini tanish', () {
    const legal = "Taksi uchun onlayn chiqa olmaysiz: JShShIR kiritilmagan; "
        "Tibbiy ko'rik hujjati yo'q. Ilovadagi «Hujjatlar» bo'limida to'ldiring.";

    test('sabablar ro\'yxatga ajratiladi', () {
      expect(parseLegalRejectionReasons(legal), [
        'JShShIR kiritilmagan',
        "Tibbiy ko'rik hujjati yo'q",
      ]);
    });

    test('boshqa xato matni — bo\'sh ro\'yxat', () {
      expect(parseLegalRejectionReasons('Balans manfiy'), isEmpty);
      expect(parseLegalRejectionReasons(null), isEmpty);
    });

    test('classifyDriverError: huquqiy blok va hamyon yetishmasligi', () {
      expect(classifyDriverError(_badRequest(legal)), DriverErrorKind.legalBlocked);
      expect(
        classifyDriverError(_badRequest(
          "Hamyonda mablag' yetarli emas: do'konga 85 000 so'm o'tkazish kerak, "
          "balansingiz 10 000 so'm. Avval hamyonni to'ldiring.",
        )),
        DriverErrorKind.vendorWalletInsufficient,
      );
      expect(classifyDriverError(_badRequest('Boshqa xato')), isNull);
      // 400 dan boshqa holat — tanilmaydi.
      expect(classifyDriverError(_badRequest(legal, status: 500)), isNull);
      expect(classifyDriverError(Exception('x')), isNull);
    });
  });

  group('DriverLegalSummary.fromJson', () {
    test('profil va xulosa o\'qiladi, PATCH tanasi qaytadan quriladi', () {
      final summary = DriverLegalSummary.fromJson(const {
        'profile': {
          'taxStatus': 'individual_entrepreneur',
          'pinfl': '12345678901234',
          'tin': '123456789',
          'birthDate': '1990-05-01',
          'drivingLicenceIssuedAt': '2015-03-10',
          'taxiLicenceNumber': 'TL-1',
          'taxiLicenceRegion': 'Toshkent viloyati',
          'citizenship': 'UZ',
        },
        'eligibility': {
          'eligible': false,
          'enforced': true,
          'enforcedFrom': '2026-01-01T00:00:00.000Z',
          'appliesToTaxi': true,
          'blocking': true,
          'reasons': [
            {'code': 'document_medical_check', 'message': "Tibbiy ko'rik"},
          ],
        },
      });
      expect(summary.profile.taxStatus, DriverTaxStatus.individualEntrepreneur);
      expect(summary.eligibility.blocking, isTrue);
      expect(summary.eligibility.hasDocumentReasons, isTrue);
      expect(summary.profile.toPatchJson(), {
        'taxStatus': 'individual_entrepreneur',
        'pinfl': '12345678901234',
        'tin': '123456789',
        'birthDate': '1990-05-01',
        'drivingLicenceIssuedAt': '2015-03-10',
        'taxiLicenceNumber': 'TL-1',
        'taxiLicenceRegion': 'Toshkent viloyati',
      });
    });
  });
}
