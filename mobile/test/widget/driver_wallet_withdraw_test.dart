// Widget tests for the driver wallet withdrawal (payout request) UI on the
// earnings screen. Covers: submitting a valid amount calls
// POST /payments/wallet/withdraw, an amount exceeding the driver's wallet
// balance is rejected client-side (no API call made), and the withdrawal
// history list renders each request's amount/destination/status.
//
// ApiClient is mocked with mocktail so no real network call is made, mirroring
// the pattern used in driver_kyc_upload_test.dart. LoadingWidget uses
// flutter_animate's `.repeat()` (an infinite animation), so pumpAndSettle()
// would hang while it's visible — a fixed number of short pumps is used
// instead to drain the mocked (near-instant) async calls.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/earnings_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient mockApiClient;
  late LocalStorage localStorage;

  setUpAll(() async {
    registerFallbackValue(RequestOptions(path: '/'));
    // Formatters.formatRelativeDate (used by the withdrawal history cards)
    // formats with the 'uz' locale, which requires the locale data to be
    // loaded before any DateFormat('...', 'uz') call.
    await initializeDateFormatting('uz', null);
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    mockApiClient = MockApiClient();

    // GET /payments/wallet — hamyon qoldig'ining YAGONA manbai (50 000 UZS).
    //
    // ⚠️ Ilgari mahalliy tekshiruv `GET /drivers/me` dagi `balance` ustuniga
    // qarardi, server esa yechishni daftarga solishtirardi — ikki xil raqam,
    // ikki xil javob. Endi ikkalasi ham shu endpointdan keladi.
    when(() => mockApiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.paymentsWallet, {
        'success': true,
        'data': {'userId': 'user-1', 'balance': 50000},
      }),
    );

    // GET /drivers/me — profil ma'lumotlari (mashina, telefon). Undagi
    // `balance` ustuni endi QAROR uchun ishlatilmaydi.
    when(() => mockApiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01 A 123 BC',
          'balance': 50000,
          'user': {'phone': '+998901112233', 'status': 'approved'},
        },
      }),
    );

    // GET /orders/earnings
    when(() => mockApiClient.get(ApiEndpoints.driverEarnings)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverEarnings, {
        'success': true,
        'data': {'today': 0},
      }),
    );

    // GET /orders/history (used both for order history and active-order check)
    when(() => mockApiClient.get(ApiEndpoints.driverOrderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverOrderHistory, {
        'success': true,
        'data': {'orders': <dynamic>[]},
      }),
    );

    // GET /payments/wallet/withdrawals — starts out empty unless a test
    // overrides it.
    when(() => mockApiClient.get(ApiEndpoints.walletWithdrawals)).thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.walletWithdrawals,
        {'success': true, 'data': <dynamic>[]},
      ),
    );

    // GET /orders/earnings/breakdown and GET /driver-bonus-rules/me/progress
    // — EarningsScreen's initState now also fires these (see
    // driver_earnings_breakdown_test.dart for dedicated coverage); stubbed
    // here purely so this file's unrelated withdrawal flow doesn't hit an
    // unstubbed-mock error.
    when(() => mockApiClient.get(ApiEndpoints.driverEarningsBreakdown))
        .thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverEarningsBreakdown, {
        'success': true,
        'data': {
          'today': {'gross': 0, 'commission': 0, 'net': 0, 'trips': 0},
          'week': {'gross': 0, 'commission': 0, 'net': 0, 'trips': 0},
          'month': {'gross': 0, 'commission': 0, 'net': 0, 'trips': 0},
        },
      }),
    );
    when(() => mockApiClient.get(ApiEndpoints.driverBonusProgress)).thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.driverBonusProgress,
        {'success': true, 'data': <dynamic>[]},
      ),
    );
  });

  // Drains the mocked (near-instant) async calls fired from
  // postFrameCallback / button taps without waiting on LoadingWidget's
  // repeating animation, which would make pumpAndSettle() time out.
  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 15}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<DriverProvider> pumpEarningsScreen(WidgetTester tester) async {
    final driverProvider = DriverProvider(
      apiClient: mockApiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driverProvider),
        ],
        child: const MaterialApp(home: EarningsScreen()),
      ),
    );

    // Let the postFrameCallback-triggered loadEarnings()/loadOrderHistory()/
    // loadProfile()/loadWithdrawals() calls resolve.
    await pumpUntilQuiet(tester);
    return driverProvider;
  }

  Future<void> openWithdrawDialog(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('withdraw_button')));
    await pumpUntilQuiet(tester);
  }

  testWidgets('submitting a valid amount calls the withdraw API',
      (tester) async {
    // A tall surface so the withdrawal-history list (now further down the
    // scroll view, below the new earnings-breakdown card) lands within the
    // visible viewport without needing to scroll the CustomScrollView.
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    when(
      () => mockApiClient.post(
        ApiEndpoints.walletWithdraw,
        data: any(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.walletWithdraw, {
        'success': true,
        'data': {
          'id': 'withdrawal-1',
          'driverId': 'driver-1',
          'amount': 20000,
          'status': 'pending',
          'payoutDestination': '+998901234567',
          'requestedAt': '2026-07-13T12:00:00.000Z',
          'processedAt': null,
          'adminNote': null,
        },
      }),
    );

    await pumpEarningsScreen(tester);
    await openWithdrawDialog(tester);

    expect(find.byKey(const ValueKey('withdraw_amount_field')), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('withdraw_amount_field')),
      '20000',
    );
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_destination_field')),
      '+998901234567',
    );
    await tester.tap(find.byKey(const ValueKey('withdraw_submit_button')));
    await pumpUntilQuiet(tester);

    verify(
      () => mockApiClient.post(
        ApiEndpoints.walletWithdraw,
        data: {'amount': 20000.0, 'payoutDestination': '+998901234567'},
      ),
    ).called(1);

    // Dialog closes on success and the new request shows up in the history
    // list without needing a refetch.
    expect(find.byKey(const ValueKey('withdraw_submit_button')), findsNothing);
    expect(find.byKey(const ValueKey('withdrawal_withdrawal-1')), findsOneWidget);
  });

  testWidgets(
      'an amount exceeding balance shows a validation error and never calls the API',
      (tester) async {
    await pumpEarningsScreen(tester);
    await openWithdrawDialog(tester);

    // Driver balance mocked at 50 000; request more than that.
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_amount_field')),
      '60000',
    );
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_destination_field')),
      '+998901234567',
    );
    await tester.tap(find.byKey(const ValueKey('withdraw_submit_button')));
    await pumpUntilQuiet(tester);

    final errorFinder = find.byKey(const ValueKey('withdraw_error_text'));
    expect(errorFinder, findsOneWidget);
    expect(
      (tester.widget(errorFinder) as Text).data,
      contains(Formatters.formatPrice(50000)),
    );

    // Dialog stays open (submission was blocked client-side).
    expect(find.byKey(const ValueKey('withdraw_submit_button')), findsOneWidget);

    verifyNever(
      () => mockApiClient.post(
        ApiEndpoints.walletWithdraw,
        data: any(named: 'data'),
      ),
    );
  });

  testWidgets('the withdrawal history list renders past requests',
      (tester) async {
    when(() => mockApiClient.get(ApiEndpoints.walletWithdrawals)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.walletWithdrawals, {
        'success': true,
        'data': [
          {
            'id': 'w-pending',
            'driverId': 'driver-1',
            'amount': 15000,
            'status': 'pending',
            'payoutDestination': '+998901234567',
            'requestedAt': '2026-07-13T10:00:00.000Z',
            'processedAt': null,
            'adminNote': null,
          },
          {
            'id': 'w-approved',
            'driverId': 'driver-1',
            'amount': 25000,
            'status': 'approved',
            'payoutDestination': '8600 1234 5678 9012',
            'requestedAt': '2026-07-12T10:00:00.000Z',
            'processedAt': '2026-07-12T11:00:00.000Z',
            'adminNote': null,
          },
          {
            'id': 'w-rejected',
            'driverId': 'driver-1',
            'amount': 5000,
            'status': 'rejected',
            'payoutDestination': '+998901112233',
            'requestedAt': '2026-07-11T10:00:00.000Z',
            'processedAt': '2026-07-11T11:00:00.000Z',
            'adminNote': "Ma'lumot noto'g'ri",
          },
          {
            'id': 'w-paid',
            'driverId': 'driver-1',
            'amount': 10000,
            'status': 'paid',
            'payoutDestination': '+998901112233',
            'requestedAt': '2026-07-10T10:00:00.000Z',
            'processedAt': '2026-07-10T11:00:00.000Z',
            'adminNote': null,
          },
        ],
      }),
    );

    // A tall surface so all four history cards land within the visible
    // viewport without needing to scroll the CustomScrollView.
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpEarningsScreen(tester);

    expect(find.byKey(const ValueKey('withdrawal_w-pending')), findsOneWidget);
    expect(find.byKey(const ValueKey('withdrawal_w-approved')), findsOneWidget);
    expect(find.byKey(const ValueKey('withdrawal_w-rejected')), findsOneWidget);
    expect(find.byKey(const ValueKey('withdrawal_w-paid')), findsOneWidget);

    expect(find.text('Kutilmoqda'), findsOneWidget);
    expect(find.text('Tasdiqlandi'), findsOneWidget);
    expect(find.text('Rad etildi'), findsOneWidget);
    expect(find.text("To'landi"), findsOneWidget);

    expect(find.text(Formatters.formatPrice(15000)), findsOneWidget);
    expect(find.text(Formatters.formatPrice(25000)), findsOneWidget);
    expect(find.text('8600 1234 5678 9012'), findsOneWidget);
  });

  testWidgets(
      'karta to\'ldirishi ushlab turilgan: dialog izohi va availableForWithdrawal chegarasi',
      (tester) async {
    when(() => mockApiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.paymentsWallet, {
        'success': true,
        'data': {
          'userId': 'user-1',
          'balance': 50000,
          'availableForWithdrawal': 20000,
          'withdrawalHold': 30000,
          'withdrawalHoldDays': 7,
        },
      }),
    );

    await pumpEarningsScreen(tester);
    await openWithdrawDialog(tester);

    expect(
      (tester.widget(find.byKey(const ValueKey('withdraw_available_text')))
              as Text)
          .data,
      contains(Formatters.formatPrice(20000)),
    );
    final note =
        (tester.widget(find.byKey(const ValueKey('withdraw_hold_note'))) as Text)
            .data!;
    expect(note, contains(Formatters.formatPrice(30000)));
    expect(note, contains('7 kundan keyin'));

    // Qoldiqdan kam, lekin yechish mumkin bo'lganidan ko'p.
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_amount_field')),
      '30000',
    );
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_destination_field')),
      '+998901234567',
    );
    await tester.tap(find.byKey(const ValueKey('withdraw_submit_button')));
    await pumpUntilQuiet(tester);

    expect(
      (tester.widget(find.byKey(const ValueKey('withdraw_error_text')))
              as Text)
          .data,
      contains(Formatters.formatPrice(20000)),
    );
    verifyNever(
      () => mockApiClient.post(
        ApiEndpoints.walletWithdraw,
        data: any(named: 'data'),
      ),
    );
  });

  testWidgets('server WALLET_WITHDRAWAL_ON_HOLD qaytarsa — ilova tilidagi izoh',
      (tester) async {
    when(
      () => mockApiClient.post(
        ApiEndpoints.walletWithdraw,
        data: any(named: 'data'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.walletWithdraw),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.walletWithdraw),
          statusCode: 400,
          data: {
            'success': false,
            'statusCode': 400,
            'message': 'srv',
            'code': 'WALLET_WITHDRAWAL_ON_HOLD',
            'details': {'available': 10000, 'held': 40000, 'holdDays': 5},
          },
        ),
      ),
    );

    await pumpEarningsScreen(tester);
    await openWithdrawDialog(tester);
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_amount_field')),
      '30000',
    );
    await tester.enterText(
      find.byKey(const ValueKey('withdraw_destination_field')),
      '+998901234567',
    );
    await tester.tap(find.byKey(const ValueKey('withdraw_submit_button')));
    await pumpUntilQuiet(tester);

    final text =
        (tester.widget(find.byKey(const ValueKey('withdraw_error_text')))
                as Text)
            .data!;
    expect(text, contains(Formatters.formatPrice(40000)));
    expect(text, contains('5 kundan keyin'));
    expect(text, contains(Formatters.formatPrice(10000)));
    expect(text, isNot(contains('srv')));
  });
}
