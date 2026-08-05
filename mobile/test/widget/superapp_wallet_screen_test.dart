// WalletScreen renders SuperappProvider.walletBalance, which is now fetched
// from GET /payments/wallet instead of a hardcoded 124500. These tests pin the
// two states that matter to the passenger:
//   - success -> the real server figure is shown;
//   - failure -> a neutral placeholder plus a retry affordance, never a
//     fabricated number.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/screens/wallet_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient apiClient;
  late SuperappProvider superapp;

  setUp(() {
    apiClient = MockApiClient();
    superapp = SuperappProvider(apiClient: apiClient);
  });

  Future<void> pumpWallet(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<SuperappProvider>.value(
        value: superapp,
        child: const MaterialApp(home: WalletScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('opening the wallet fetches the balance and shows the real figure',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet),
        data: {
          'success': true,
          'data': {'userId': 'user-1', 'balance': 87000},
        },
      ),
    );

    await pumpWallet(tester);

    verify(() => apiClient.get(ApiEndpoints.paymentsWallet)).called(1);
    expect(superapp.walletBalance, 87000.0);
    // The old hardcoded placeholder must be gone.
    expect(find.textContaining('124'), findsNothing);
    expect(find.textContaining('87'), findsWidgets);
  });

  testWidgets('a failed fetch shows a placeholder and a retry, not a fake number',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet)),
    );

    await pumpWallet(tester);

    expect(superapp.walletBalance, isNull);
    expect(find.text('—'), findsOneWidget);
    expect(find.text('Qayta urinish'), findsOneWidget);

    // Retry re-issues the request; on success the real balance replaces the
    // placeholder and the error notice disappears.
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet),
        data: {
          'success': true,
          'data': {'userId': 'user-1', 'balance': 12000},
        },
      ),
    );
    await tester.tap(find.text('Qayta urinish'));
    await tester.pumpAndSettle();

    expect(superapp.walletBalance, 12000.0);
    expect(find.text('—'), findsNothing);
    expect(find.text('Qayta urinish'), findsNothing);
  });
}
