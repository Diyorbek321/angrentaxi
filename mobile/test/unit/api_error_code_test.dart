// Xato konvertidagi mashina kodi (docs/LEGAL-COMPLIANCE.md §21): ApiError
// tahlili, kod bo'yicha turkumlash, `reasons[]` va `details` summalari,
// eski server uchun matn zaxirasi.
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/driver/legal/legal_rejection.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

DioException _error(Map<String, dynamic> body, {int status = 400}) {
  final options = RequestOptions(path: '/drivers/status');
  return DioException(
    requestOptions: options,
    response: Response(requestOptions: options, statusCode: status, data: body),
  );
}

void main() {
  group('ApiError.from', () {
    test('kodli konvert: code, reasons, details', () {
      final api = ApiError.from(_error({
        'success': false,
        'statusCode': 400,
        'message': 'Вы не можете выйти на линию такси: …',
        'code': 'LEGAL_NOT_ELIGIBLE',
        'reasons': [
          {'code': 'pinfl_missing', 'message': 'ПИНФЛ не указан'},
          {'code': 'document_medical_check', 'message': ''},
          'buzuq',
        ],
        'details': {'balance': -5000},
      }))!;
      expect(api.statusCode, 400);
      expect(api.code, ApiErrorCode.legalNotEligible);
      expect(api.reasons.map((r) => r.code),
          ['pinfl_missing', 'document_medical_check']);
      // Bo'sh matn — kod ko'rsatiladi.
      expect(api.reasons.last.message, 'document_medical_check');
      expect(api.amount('balance'), -5000);
      expect(api.amount('required'), isNull);
    });

    test("kodsiz (eski server) va massivli message", () {
      final api = ApiError.from(_error({
        'message': ['a', 'b'],
        'code': '  ',
      }))!;
      expect(api.code, isNull);
      expect(api.hasCode, isFalse);
      expect(api.message, 'a; b');
      expect(api.reasons, isEmpty);
      expect(api.details, isEmpty);
    });

    test("javobsiz xato va boshqa turdagi xato — null", () {
      expect(ApiError.from(Exception('x')), isNull);
      expect(
        ApiError.from(DioException(requestOptions: RequestOptions(path: '/'))),
        isNull,
      );
      expect(ApiError.fromBody('html'), isNull);
    });
  });

  group('classifyDriverError — kod ustun', () {
    test('kodlar turkumga o\'giriladi (matn tilidan qat\'i nazar)', () {
      expect(
        classifyDriverError(_error({
          'message': 'Вы не можете выйти на линию',
          'code': 'LEGAL_NOT_ELIGIBLE',
        })),
        DriverErrorKind.legalBlocked,
      );
      expect(
        classifyDriverError(_error({
          'message': 'Недостаточно средств',
          'code': 'WALLET_INSUFFICIENT_FOR_VENDOR',
          'details': {'required': 85000, 'balance': 10000},
        })),
        DriverErrorKind.vendorWalletInsufficient,
      );
      expect(
        classifyDriverError(_error({
          'message': 'Balans manfiy',
          'code': 'WALLET_NEGATIVE_BALANCE',
        })),
        DriverErrorKind.walletNegativeBalance,
      );
    });

    test("boshqa kod — matn mos kelsa ham tanilmaydi", () {
      expect(
        classifyDriverError(_error({
          'message': 'Taksi uchun onlayn chiqa olmaysiz: x',
          'code': 'SHIFT_PASS_DISABLED',
        })),
        isNull,
      );
    });

    test('kodsiz eski server — matn prefiksi zaxirasi', () {
      expect(
        classifyDriverError(
            _error({'message': 'Taksi uchun onlayn chiqa olmaysiz: x'})),
        DriverErrorKind.legalBlocked,
      );
      expect(
        classifyDriverError(_error(
            {'message': 'Taksi uchun onlayn chiqa olmaysiz: x'},
            status: 500)),
        isNull,
      );
    });
  });

  group('legalRejectionReasons', () {
    test("kodli: reasons[].message (server tilida)", () {
      final api = ApiError.fromBody({
        'message': 'Taksi uchun onlayn chiqa olmaysiz: A; B. Ilovadagi …',
        'code': 'LEGAL_NOT_ELIGIBLE',
        'reasons': [
          {'code': 'pinfl_missing', 'message': 'ПИНФЛ не указан'},
        ],
      });
      expect(legalRejectionReasons(api), ['ПИНФЛ не указан']);
    });

    test("kodsiz: matndan ajratiladi", () {
      final api = ApiError.fromBody({
        'message': 'Taksi uchun onlayn chiqa olmaysiz: A; B. Ilovadagi …',
      });
      expect(legalRejectionReasons(api), ['A', 'B']);
      expect(legalRejectionReasons(null), isEmpty);
    });
  });

  group('details summalari', () {
    String p(double v) => Formatters.formatPrice(v);

    test("WALLET_INSUFFICIENT_FOR_VENDOR — Kerak: X, balans: Y", () {
      final api = ApiError.fromBody({
        'message': 'm',
        'code': 'WALLET_INSUFFICIENT_FOR_VENDOR',
        'details': {'required': 85000, 'balance': 10000},
      });
      expect(codedErrorAmountsText(api),
          'Kerak: ${p(85000)}, balans: ${p(10000)}');
      expect(withCodedErrorAmounts('m', api),
          'm\nKerak: ${p(85000)}, balans: ${p(10000)}');
    });

    test('SHIFT_PASS_INSUFFICIENT_BALANCE, WALLET_NEGATIVE_BALANCE, '
        'WALLET_TOPUP_AMOUNT_OUT_OF_RANGE', () {
      expect(
        codedErrorAmountsText(ApiError.fromBody({
          'code': 'SHIFT_PASS_INSUFFICIENT_BALANCE',
          'details': {'price': 30000, 'balance': 1000},
        })),
        'Narxi: ${p(30000)}, balans: ${p(1000)}',
      );
      expect(
        codedErrorAmountsText(ApiError.fromBody({
          'code': 'WALLET_NEGATIVE_BALANCE',
          'details': {'balance': -2500},
        })),
        'Balans: ${p(-2500)}',
      );
      expect(
        codedErrorAmountsText(ApiError.fromBody({
          'code': 'WALLET_TOPUP_AMOUNT_OUT_OF_RANGE',
          'details': {'min': 5000, 'max': 2000000},
        })),
        '${p(5000)} dan ${p(2000000)} gacha',
      );
    });

    test("summa yo'q yoki kod yo'q — qo'shimcha qator yo'q", () {
      final noDetails = ApiError.fromBody(
          {'message': 'm', 'code': 'WALLET_INSUFFICIENT_FOR_VENDOR'});
      expect(codedErrorAmountsText(noDetails), isNull);
      expect(withCodedErrorAmounts('m', noDetails), 'm');
      expect(codedErrorAmountsText(ApiError.fromBody({'message': 'm'})),
          isNull);
      expect(codedErrorAmountsText(null), isNull);
    });
  });
}
