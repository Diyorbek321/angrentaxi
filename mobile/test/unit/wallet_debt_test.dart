// Hamyon qarzi (docs/INCIDENT-POLICY.md §7).
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/models/wallet_debt.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(Map<String, dynamic> data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
    );

const _json = {
  'total': 3000,
  'items': [
    {'id': 'd1', 'amount': 3000, 'reason': 'late_cancel', 'orderId': 'o1', 'createdAt': '2026-11-04T10:00:00Z'},
  ],
  'realBalance': 1000,
  'canSettleNow': false,
  'topUpNeeded': 2000,
  'topUpAvailable': true,
  'minTopUp': 2000,
  'supportPhone': '+998711234567',
};

void main() {
  test('parse: jami, sabab, yetishmagan summa', () {
    final debt = WalletDebt.fromJson(_json);
    expect(debt.hasDebt, isTrue);
    expect(debt.items.single.reason, 'late_cancel');
    expect(debt.topUpAmount, 2000);
    expect(debt.topUpAvailable, isTrue);
    expect(debt.supportPhone, '+998711234567');
  });

  test("provayder quyi chegarasi yetishmagandan katta bo'lsa — chegara", () {
    final json = Map<String, dynamic>.of(_json)
      ..['topUpNeeded'] = 500
      ..['minTopUp'] = 1000;
    final debt = WalletDebt.fromJson(json);
    expect(debt.topUpAmount, 1000);
  });

  test("bo'sh javob — qarz yo'q, to'ldirish taklif qilinmaydi", () {
    final debt = WalletDebt.fromJson(const {});
    expect(debt.hasDebt, isFalse);
    expect(debt.topUpAvailable, isFalse);
  });

  test('isWalletDebtError faqat kod bo\'yicha', () {
    DioException error(String code) {
      final options = RequestOptions(path: '/orders');
      return DioException(
        requestOptions: options,
        response: Response<dynamic>(
          requestOptions: options,
          statusCode: 400,
          data: {'success': false, 'statusCode': 400, 'code': code, 'message': 'x', 'details': {'amount': 3000}},
        ),
      );
    }

    expect(isWalletDebtError(error('WALLET_DEBT_OUTSTANDING')), isTrue);
    expect(isWalletDebtError(error('OTHER')), isFalse);
    expect(isWalletDebtError(Exception('x')), isFalse);
  });

  group('SuperappProvider', () {
    late _MockApiClient api;
    late SuperappProvider provider;

    setUp(() {
      api = _MockApiClient();
      provider = SuperappProvider(apiClient: api);
    });

    test("qarzni o'qiydi va eslab qoladi; xatoda oxirgi qiymat qoladi", () async {
      when(() => api.get(ApiEndpoints.walletDebt)).thenAnswer((_) async => _ok(_json));
      expect((await provider.loadWalletDebt())?.total, 3000);

      when(() => api.get(ApiEndpoints.walletDebt)).thenThrow(Exception('tarmoq'));
      expect(await provider.loadWalletDebt(), isNull);
      expect(provider.walletDebt?.total, 3000);
    });

    test("hamyondan yopish server javobini oladi", () async {
      when(() => api.post(ApiEndpoints.walletDebtSettle)).thenAnswer((_) async => _ok({..._json, 'total': 0, 'items': <dynamic>[]}));
      expect((await provider.settleWalletDebt())?.hasDebt, isFalse);
    });

    test("to'ldirish butun so'm va checkout havolasini beradi", () async {
      when(() => api.post(ApiEndpoints.walletTopup, data: any<dynamic>(named: 'data'))).thenAnswer(
        (_) async => _ok({'topupId': 't1', 'checkoutUrl': 'https://checkout.paycom.uz/x'}),
      );
      final result = await provider.startDebtTopup(2000.5);
      expect(result.url, 'https://checkout.paycom.uz/x');
      final sent = verify(() => api.post(ApiEndpoints.walletTopup, data: captureAny<dynamic>(named: 'data'))).captured.single;
      expect(sent, {'amount': 2001, 'provider': 'payme'});
    });
  });
}
