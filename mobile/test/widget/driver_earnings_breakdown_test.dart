// Widget tests for the Bugun/Hafta/Oy earnings-breakdown segmented control
// added to EarningsScreen, backed by GET /orders/earnings/breakdown.
// ApiClient is mocked with mocktail; pattern mirrors
// driver_wallet_withdraw_test.dart.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/earnings_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
// Davr tanlash endi `AgOptionChips` — chip kalitlari `agOptionChipKey(id)`
// dan keladi (ilgari ekranga yozilgan `ValueKey('earnings_period_*')` edi).
import 'package:angren_taxi/shared/widgets/ag_option_chips.dart';
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
    await initializeDateFormatting('uz', null);
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    mockApiClient = MockApiClient();

    when(() => mockApiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01 A 123 BC',
          'balance': 50000,
          'user': {'id': 'user-1', 'phone': '+998901112233', 'status': 'approved'},
        },
      }),
    );

    when(() => mockApiClient.get(ApiEndpoints.driverEarnings)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverEarnings, {
        'success': true,
        'data': {'today': 0},
      }),
    );

    when(() => mockApiClient.get(ApiEndpoints.driverOrderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverOrderHistory, {
        'success': true,
        'data': {'orders': <dynamic>[]},
      }),
    );

    // EarningsScreen'ning initState'i hamyon qoldig'ini ham so'raydi. Bu
    // fayl daromad taqsimotiga tegishli, shuning uchun stub minimal —
    // stubsiz mock xatosi test logini bekorga to'ldirardi.
    when(() => mockApiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.paymentsWallet, {
        'success': true,
        'data': {'userId': 'user-1', 'balance': 0},
      }),
    );

    when(() => mockApiClient.get(ApiEndpoints.walletWithdrawals)).thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.walletWithdrawals,
        {'success': true, 'data': <dynamic>[]},
      ),
    );

    when(() => mockApiClient.get(ApiEndpoints.driverEarningsBreakdown))
        .thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverEarningsBreakdown, {
        'success': true,
        'data': {
          'today': {'gross': 20000, 'commission': 2000, 'net': 18000, 'trips': 1},
          'week': {'gross': 140000, 'commission': 14000, 'net': 126000, 'trips': 7},
          'month': {'gross': 550000, 'commission': 55000, 'net': 495000, 'trips': 30},
        },
      }),
    );

    when(() => mockApiClient.get(ApiEndpoints.driverBonusProgress)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverBonusProgress, {
        'success': true,
        'data': <dynamic>[
          {
            'ruleId': 'rule-1',
            'name': '10 ta safar bonusi',
            'ruleType': 'trip_count',
            'tripThreshold': 10,
            'bonusAmount': 50000,
            'currentCount': 4,
          },
        ],
      }),
    );
  });

  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 15}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> pumpEarningsScreen(WidgetTester tester) async {
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

    await pumpUntilQuiet(tester);
  }

  testWidgets('defaults to the "Bugun" tab showing today\'s breakdown',
      (tester) async {
    await pumpEarningsScreen(tester);

    expect(find.byKey(agOptionChipKey('today')), findsOneWidget);
    expect(find.byKey(agOptionChipKey('week')), findsOneWidget);
    expect(find.byKey(agOptionChipKey('month')), findsOneWidget);

    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_gross_value'))) as Text)
          .data,
      Formatters.formatPrice(20000),
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_commission_value')))
              as Text)
          .data,
      '- ${Formatters.formatPrice(2000)}',
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_net_value'))) as Text)
          .data,
      Formatters.formatPrice(18000),
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_trips_value'))) as Text)
          .data,
      '1',
    );
  });

  testWidgets('tapping "Hafta" switches to the week breakdown', (tester) async {
    await pumpEarningsScreen(tester);

    await tester.tap(find.byKey(agOptionChipKey('week')));
    await pumpUntilQuiet(tester, times: 3);

    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_gross_value'))) as Text)
          .data,
      Formatters.formatPrice(140000),
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_trips_value'))) as Text)
          .data,
      '7',
    );
  });

  testWidgets('tapping "Oy" switches to the month breakdown', (tester) async {
    await pumpEarningsScreen(tester);

    await tester.tap(find.byKey(agOptionChipKey('month')));
    await pumpUntilQuiet(tester, times: 3);

    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_gross_value'))) as Text)
          .data,
      Formatters.formatPrice(550000),
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_net_value'))) as Text)
          .data,
      Formatters.formatPrice(495000),
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('earnings_trips_value'))) as Text)
          .data,
      '30',
    );
  });

  testWidgets('renders bonus progress with the reward amount and trip count',
      (tester) async {
    // A tall surface so the bonus section (below the summary card and the
    // period-breakdown card) lands within the visible viewport without
    // needing to scroll the CustomScrollView.
    tester.view.physicalSize = const Size(1080, 3000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpEarningsScreen(tester);

    expect(
      find.byKey(const ValueKey('bonus_progress_rule-1')),
      findsOneWidget,
    );
    expect(find.text('10 ta safar bonusi'), findsOneWidget);
    expect(find.text('+${Formatters.formatPrice(50000)}'), findsOneWidget);
    expect(find.text('4/10 safar'), findsOneWidget);
  });
}
