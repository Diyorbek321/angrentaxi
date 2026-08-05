// SuperappProvider.walletBalance used to be a hardcoded 124500 with no
// endpoint behind it. It is now read from the live GET /payments/wallet
// (backend/src/modules/payments/payments.controller.ts#getWallet ->
// PaymentsService.getWalletBalance, returning {userId, balance} inside the
// global {success, data} ResponseInterceptor envelope).
//
// The key guarantee these tests lock in: a balance that has not loaded (or
// failed to load) stays `null` so the UI can render a neutral placeholder —
// it must never fall back to a fabricated figure.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _walletResponse(Object? data) => Response<dynamic>(
      requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet),
      data: data,
    );

void main() {
  late MockApiClient apiClient;
  late SuperappProvider provider;

  setUp(() {
    apiClient = MockApiClient();
    provider = SuperappProvider(apiClient: apiClient);
  });

  test('endpoint constant matches the backend route', () {
    expect(ApiEndpoints.paymentsWallet, '/payments/wallet');
  });

  test('balance is null before anything is loaded (no placeholder figure)', () {
    expect(provider.walletBalance, isNull);
    expect(provider.isWalletLoading, isFalse);
    expect(provider.walletError, isNull);
  });

  test('loadWalletBalance reads data.balance from GET /payments/wallet', () async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _walletResponse({
        'success': true,
        'data': {'userId': 'user-1', 'balance': 124500},
      }),
    );

    var notifications = 0;
    provider.addListener(() => notifications++);

    await provider.loadWalletBalance();

    verify(() => apiClient.get(ApiEndpoints.paymentsWallet)).called(1);
    expect(provider.walletBalance, 124500.0);
    expect(provider.isWalletLoading, isFalse);
    expect(provider.walletError, isNull);
    // One notify when loading starts, one when it settles.
    expect(notifications, 2);
  });

  test('an integer-typed balance is converted to double', () async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _walletResponse({
        'success': true,
        'data': {'userId': 'user-1', 'balance': 0},
      }),
    );

    await provider.loadWalletBalance();

    expect(provider.walletBalance, 0.0);
  });

  test('a network failure leaves the balance null and records an error', () async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet)),
    );

    await provider.loadWalletBalance();

    expect(provider.walletBalance, isNull);
    expect(provider.isWalletLoading, isFalse);
    expect(provider.walletError, isNotNull);
  });

  test('a malformed payload is treated as an error, not as a zero balance', () async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _walletResponse({
        'success': true,
        'data': {'userId': 'user-1'},
      }),
    );

    await provider.loadWalletBalance();

    expect(provider.walletBalance, isNull);
    expect(provider.walletError, isNotNull);
  });

  test('a later failure does not blank out an already-loaded balance', () async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _walletResponse({
        'success': true,
        'data': {'userId': 'user-1', 'balance': 50000},
      }),
    );
    await provider.loadWalletBalance();
    expect(provider.walletBalance, 50000.0);

    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet)),
    );
    await provider.loadWalletBalance();

    expect(provider.walletBalance, 50000.0);
    expect(provider.walletError, isNotNull);
  });

  test('a concurrent second call does not fire a duplicate request', () async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _walletResponse({
        'success': true,
        'data': {'userId': 'user-1', 'balance': 1000},
      }),
    );

    await Future.wait([
      provider.loadWalletBalance(),
      provider.loadWalletBalance(),
    ]);

    verify(() => apiClient.get(ApiEndpoints.paymentsWallet)).called(1);
    expect(provider.walletBalance, 1000.0);
  });
}
