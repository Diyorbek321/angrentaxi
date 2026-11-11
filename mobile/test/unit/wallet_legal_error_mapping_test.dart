// Yangi kodli xatolar (docs/LEGAL-COMPLIANCE.md §21, §25): yechish ushlab
// turilishi, ochiq to'ldirishlar chegarasi, huquqiy profil qulfi/takrori.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/legal/driver_legal_provider.dart';
import 'package:angren_taxi/features/driver/legal/legal_save_error.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_error_messages.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/shared/models/driver_legal.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

DioException _error(
  Map<String, dynamic> body, {
  int status = 400,
  String path = '/',
}) {
  final options = RequestOptions(path: path);
  return DioException(
    requestOptions: options,
    response: Response(requestOptions: options, statusCode: status, data: body),
  );
}

ApiError _api(String code, [Map<String, dynamic> details = const {}]) =>
    ApiError.from(_error({'code': code, 'message': 'srv', 'details': details}))!;

Response<dynamic> _ok(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

void main() {
  group('ApiErrorCode — yangi kodlar', () {
    test('kontrakt qiymatlari backend bilan bir xil', () {
      expect(ApiErrorCode.walletTopupTooManyPending,
          'WALLET_TOPUP_TOO_MANY_PENDING');
      expect(ApiErrorCode.walletWithdrawalOnHold, 'WALLET_WITHDRAWAL_ON_HOLD');
      expect(ApiErrorCode.legalProfileLocked, 'LEGAL_PROFILE_LOCKED');
      expect(ApiErrorCode.legalProfileDuplicate, 'LEGAL_PROFILE_DUPLICATE');
      expect(ApiErrorCode.manualAdjustmentLimit, 'MANUAL_ADJUSTMENT_LIMIT');
    });

    test('detailText: satr, son, bo\'sh va yo\'q', () {
      final api = _api('X', {'field': ' tin ', 'n': 3, 'empty': ''});
      expect(api.detailText('field'), 'tin');
      expect(api.detailText('n'), '3');
      expect(api.detailText('empty'), isNull);
      expect(api.detailText('missing'), isNull);
    });
  });

  group('yechish ushlab turilishi', () {
    test('withdrawableAmount = max(0, balance − held); noma\'lum — null', () {
      expect(withdrawableAmount(balance: 100000, held: 30000), 70000);
      expect(withdrawableAmount(balance: 20000, held: 30000), 0);
      expect(withdrawableAmount(balance: null, held: 0), isNull);
      expect(withdrawableAmount(balance: 5000, held: null), isNull);
    });

    test('withdrawableAmount bonusni ham ayiradi (bonus yechilmaydi)', () {
      expect(withdrawableAmount(balance: 100000, held: 30000, bonus: 20000), 50000);
      expect(withdrawableAmount(balance: 15000, held: 0, bonus: 20000), 0);
      // Eski server bonus bermaydi — avvalgi hisob.
      expect(withdrawableAmount(balance: 100000, held: 0, bonus: null), 100000);
    });

    test('withdrawalBonusNote — bonus summasi; yo\'q/0 — null', () {
      final note = withdrawalBonusNote(15000)!;
      expect(note, contains(Formatters.formatPrice(15000)));
      expect(note, contains('komissiya'));
      expect(withdrawalBonusNote(0), isNull);
      expect(withdrawalBonusNote(null), isNull);
    });

    test('WALLET_WITHDRAWAL_ON_HOLD — bonus izohi ham chiqadi', () {
      final message = withdrawalOnHoldMessage(_api(
        ApiErrorCode.walletWithdrawalOnHold,
        {'available': 0, 'held': 0, 'holdDays': 7, 'bonus': 15000},
      ))!;
      expect(message, contains(Formatters.formatPrice(15000)));
    });

    test('withdrawalHoldNote — summa va kun; yo\'q/0 kun — null', () {
      final note = withdrawalHoldNote(held: 50000, holdDays: 7)!;
      expect(note, contains(Formatters.formatPrice(50000)));
      expect(note, contains('7 kundan keyin'));
      expect(withdrawalHoldNote(held: 0, holdDays: 7), isNull);
      expect(withdrawalHoldNote(held: 50000, holdDays: 0), isNull);
      expect(withdrawalHoldNote(held: null, holdDays: 7), isNull);
    });

    test('WALLET_WITHDRAWAL_ON_HOLD — izoh + mavjud summa', () {
      final message = withdrawalOnHoldMessage(_api(
        ApiErrorCode.walletWithdrawalOnHold,
        {'available': 20000, 'held': 50000, 'holdDays': 7},
      ))!;
      expect(message, contains(Formatters.formatPrice(50000)));
      expect(message, contains(Formatters.formatPrice(20000)));
    });

    test('ON_HOLD, mavjud 0 — "yechib olinadigan mablag\' yo\'q"', () {
      final message = withdrawalOnHoldMessage(_api(
        ApiErrorCode.walletWithdrawalOnHold,
        {'available': 0, 'held': 50000, 'holdDays': 7},
      ))!;
      expect(message, contains("yechib olinadigan mablag' yo'q"));
    });

    test('boshqa kod yoki null — null', () {
      expect(withdrawalOnHoldMessage(null), isNull);
      expect(withdrawalOnHoldMessage(_api(ApiErrorCode.walletTopupDisabled)),
          isNull);
    });
  });

  group('WALLET_TOPUP_TOO_MANY_PENDING', () {
    test('maxPending bilan va usiz', () {
      expect(
        topupTooManyPendingMessage(
            _api(ApiErrorCode.walletTopupTooManyPending, {'maxPending': 3})),
        contains('3 ta'),
      );
      expect(
        topupTooManyPendingMessage(_api(ApiErrorCode.walletTopupTooManyPending)),
        isNotNull,
      );
      expect(topupTooManyPendingMessage(_api(ApiErrorCode.walletTopupDisabled)),
          isNull);
    });

    test('provayder: bayroq, ilova matni va ro\'yxat qayta yuklanadi', () async {
      final api = MockApiClient();
      when(() => api.post(ApiEndpoints.walletTopup, data: any(named: 'data')))
          .thenThrow(_error(
        {
          'code': ApiErrorCode.walletTopupTooManyPending,
          'message': 'srv',
          'details': {'maxPending': 3},
        },
        status: 409,
      ));
      when(() => api.get(ApiEndpoints.walletTopups)).thenAnswer(
        (_) async => _ok(ApiEndpoints.walletTopups, [
          {
            'id': 't-1',
            'amount': 50000,
            'provider': 'payme',
            'status': 'pending',
          },
          {'id': 't-2', 'amount': 10000, 'provider': 'click', 'status': 'paid'},
        ]),
      );
      final wallet = DriverWalletProvider(apiClient: api);

      final result = await wallet.createTopup(
        amount: 50000,
        provider: WalletTopupProvider.payme,
      );

      expect(result, isNull);
      expect(wallet.tooManyPendingTopups, isTrue);
      expect(wallet.topupError, contains('3 ta'));
      expect(wallet.pendingTopups.map((t) => t.id), ['t-1']);
      verify(() => api.get(ApiEndpoints.walletTopups)).called(1);
    });
  });

  group('huquqiy profil: qulf va takror', () {
    test('legalSaveErrorKind', () {
      expect(legalSaveErrorKind(_api(ApiErrorCode.legalProfileLocked)),
          LegalSaveErrorKind.locked);
      expect(
        legalSaveErrorKind(
            _api(ApiErrorCode.legalProfileDuplicate, {'field': 'pinfl'})),
        LegalSaveErrorKind.duplicatePinfl,
      );
      expect(
        legalSaveErrorKind(
            _api(ApiErrorCode.legalProfileDuplicate, {'field': 'tin'})),
        LegalSaveErrorKind.duplicateTin,
      );
      // `field` yo'q — PINFL deb olinadi (server ham standart shu).
      expect(legalSaveErrorKind(_api(ApiErrorCode.legalProfileDuplicate)),
          LegalSaveErrorKind.duplicatePinfl);
      expect(legalSaveErrorKind(_api(ApiErrorCode.legalNotEligible)), isNull);
      expect(legalSaveErrorKind(null), isNull);
    });

    test('legalSaveErrorMessage — operatorga murojaat / maydon nomi', () {
      expect(legalSaveErrorMessage(LegalSaveErrorKind.locked),
          contains('operatorga murojaat qiling'));
      expect(legalSaveErrorMessage(LegalSaveErrorKind.duplicatePinfl),
          contains('JShShIR'));
      expect(legalSaveErrorMessage(LegalSaveErrorKind.duplicateTin),
          contains('STIR'));
    });

    Future<DriverLegalProvider> saveFailing(Map<String, dynamic> body,
        {required int status}) async {
      final api = MockApiClient();
      when(() => api.patch(ApiEndpoints.driverLegal, data: any(named: 'data')))
          .thenThrow(_error(body, status: status));
      final provider = DriverLegalProvider(apiClient: api);
      final ok = await provider.save(
        const DriverLegalProfile(pinfl: '12345678901234', citizenship: 'UZ'),
      );
      expect(ok, isFalse);
      return provider;
    }

    test('403 LEGAL_PROFILE_LOCKED — qulf eslab qolinadi', () async {
      final provider = await saveFailing(
        {'code': ApiErrorCode.legalProfileLocked, 'message': 'srv'},
        status: 403,
      );
      expect(provider.isProfileLocked, isTrue);
      expect(provider.saveErrorKind, LegalSaveErrorKind.locked);
      expect(provider.saveError, contains('operatorga murojaat qiling'));
      provider.clearSaveError();
      expect(provider.saveErrorKind, isNull);
      // Qulf xato tozalangach ham qoladi.
      expect(provider.isProfileLocked, isTrue);
    });

    test('409 LEGAL_PROFILE_DUPLICATE — maydon bo\'yicha, qulf emas', () async {
      final provider = await saveFailing(
        {
          'code': ApiErrorCode.legalProfileDuplicate,
          'message': 'srv',
          'details': {'field': 'tin'},
        },
        status: 409,
      );
      expect(provider.isProfileLocked, isFalse);
      expect(provider.saveErrorKind, LegalSaveErrorKind.duplicateTin);
      expect(provider.saveError, contains('STIR'));
    });

    test('kodsiz xato — server matni, turkum yo\'q', () async {
      final provider = await saveFailing({'message': 'Server xatosi'},
          status: 500);
      expect(provider.saveErrorKind, isNull);
      expect(provider.isProfileLocked, isFalse);
      expect(provider.saveError, isNotNull);
    });
  });

  group('DriverProvider: hamyon ushlab turilishi', () {
    late MockApiClient api;
    late DriverProvider driver;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      api = MockApiClient();
      driver = DriverProvider(
        apiClient: api,
        socketService: SocketService(),
        locationService: LocationService(),
        localStorage: LocalStorage(await SharedPreferences.getInstance()),
      );
    });

    void stubWallet(Map<String, dynamic> data) {
      when(() => api.get(ApiEndpoints.paymentsWallet))
          .thenAnswer((_) async => _ok(ApiEndpoints.paymentsWallet, data));
    }

    test('GET /payments/wallet: availableForWithdrawal, hold, holdDays',
        () async {
      stubWallet({
        'balance': 100000,
        'availableForWithdrawal': 40000,
        'withdrawalHold': 60000,
        'withdrawalHoldDays': 7,
      });
      await driver.loadWalletBalance();
      expect(driver.walletBalance, 100000);
      expect(driver.availableForWithdrawal, 40000);
      expect(driver.withdrawalHold, 60000);
      expect(driver.withdrawalHoldDays, 7);
    });

    test('eski server (maydonlarsiz) — chegara noma\'lum', () async {
      stubWallet({'balance': 100000});
      await driver.loadWalletBalance();
      expect(driver.availableForWithdrawal, isNull);
      expect(driver.withdrawalHold, isNull);
    });

    test('faqat availableForWithdrawal — hold undan hisoblanadi', () async {
      stubWallet({'balance': 100000, 'availableForWithdrawal': 70000});
      await driver.loadWalletBalance();
      expect(driver.withdrawalHold, 30000);
      expect(driver.availableForWithdrawal, 70000);
    });

    test('realtime karta to\'ldirishi ushlab turiladi, teskarisi kamaytiradi',
        () async {
      stubWallet({
        'balance': 100000,
        'availableForWithdrawal': 100000,
        'withdrawalHold': 0,
        'withdrawalHoldDays': 7,
      });
      await driver.loadWalletBalance();
      driver.applyWalletUpdate(const WalletUpdate(
          balance: 150000, delta: 50000, reason: 'topup', topupId: 't-1'));
      expect(driver.withdrawalHold, 50000);
      expect(driver.availableForWithdrawal, 100000);
      driver.applyWalletUpdate(const WalletUpdate(
          balance: 100000, delta: -50000, reason: 'topup_reversal'));
      expect(driver.withdrawalHold, 0);
      // Boshqa sabab ushlab turilganni o'zgartirmaydi.
      driver.applyWalletUpdate(const WalletUpdate(
          balance: 120000, delta: 20000, reason: 'manual_adjustment'));
      expect(driver.availableForWithdrawal, 120000);
    });

    test('400 WALLET_WITHDRAWAL_ON_HOLD — ilova matni va server summalari',
        () async {
      stubWallet({'balance': 100000});
      await driver.loadWalletBalance();
      when(() => api.post(ApiEndpoints.walletWithdraw, data: any(named: 'data')))
          .thenThrow(_error({
        'code': ApiErrorCode.walletWithdrawalOnHold,
        'message': 'srv',
        'details': {'available': 40000, 'held': 60000, 'holdDays': 7},
      }));

      final ok = await driver.requestWithdrawal(
        amount: 80000,
        payoutDestination: '+998901234567',
      );

      expect(ok, isFalse);
      expect(driver.withdrawalError, contains(Formatters.formatPrice(60000)));
      expect(driver.withdrawalError, contains(Formatters.formatPrice(40000)));
      expect(driver.withdrawalHold, 60000);
      expect(driver.withdrawalHoldDays, 7);
      expect(driver.availableForWithdrawal, 40000);
    });
  });
}
