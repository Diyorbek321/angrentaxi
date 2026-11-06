// Daromad zanjiri: gross − komissiya − soliq (1%) − smena = sof
// (docs/LEGAL-COMPLIANCE.md §9) va smena kartasi.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/earnings_screen.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/shared/models/driver_earnings_breakdown.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MockApiClient api;
  late LocalStorage storage;

  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorage(await SharedPreferences.getInstance());
    api = MockApiClient();
    void stub(String path, dynamic data) =>
        when(() => api.get(path)).thenAnswer((_) async => _ok(path, data));

    stub(ApiEndpoints.driverProfile, {
      'id': 'driver-1',
      'balance': 0,
      'user': {'id': 'user-1', 'phone': '+998901112233', 'status': 'approved'},
    });
    stub(ApiEndpoints.driverEarnings, {'today': 0});
    stub(ApiEndpoints.driverOrderHistory, {'orders': <dynamic>[]});
    stub(ApiEndpoints.paymentsWallet, {'balance': 30000});
    stub(ApiEndpoints.walletWithdrawals, <dynamic>[]);
    stub(ApiEndpoints.driverBonusProgress, <dynamic>[]);
    stub(ApiEndpoints.settingsPublic, {'walletTopupEnabled': true});
    stub(ApiEndpoints.driverEarningsBreakdown, {
      'today': {
        'gross': 20000,
        'commission': 2000,
        'taxWithheld': 200,
        'shiftPassCost': 25000,
        'net': -7200,
        'trips': 1,
      },
      'week': {
        'gross': 140000,
        'commission': 14000,
        'taxWithheld': 1400,
        'shiftPassCost': 0,
        'net': 124600,
        'trips': 7,
      },
      // v4 (§22): chaqim — `net` ga kirmaydi, `netWithTips` = net + tips.
      'month': {
        'gross': 50000,
        'commission': 5000,
        'net': 45000,
        'trips': 2,
        'tips': 3000,
        'netWithTips': 48000,
      },
    });
    stub(ApiEndpoints.driverShiftPass, {
      'enabled': true,
      'price': 25000,
      'durationHours': 24,
      'serviceTypes': ['taxi'],
      'current': null,
      'comparison': {
        'periodDays': 7,
        'commissionPaid': 84000,
        'workingDays': 3,
        'passCost': 75000,
        'cheaperOption': 'shift_pass',
        'savings': 9000,
      },
    });
  });

  Future<void> pump(WidgetTester tester, {bool withWallet = true}) async {
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    final driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: storage,
    );
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driver),
          if (withWallet)
            ChangeNotifierProvider<DriverWalletProvider>(
              create: (_) => DriverWalletProvider(apiClient: api),
            ),
        ],
        child: const MaterialApp(home: EarningsScreen()),
      ),
    );
    for (var i = 0; i < 15; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  String valueOf(WidgetTester tester, String key) =>
      tester.widget<Text>(find.byKey(ValueKey(key))).data!;

  test('model: totalDeductions va eski javob (yangi maydonlarsiz)', () {
    final p = DriverEarningsPeriod.fromJson(const {
      'gross': 20000,
      'commission': 2000,
      'taxWithheld': 200,
      'shiftPassCost': 25000,
      'net': -7200,
      'trips': 1,
    });
    expect(p.totalDeductions, 27200);
    expect(p.gross - p.totalDeductions, p.net);
    final legacy = DriverEarningsPeriod.fromJson(
        const {'gross': 100, 'commission': 10, 'net': 90, 'trips': 1});
    expect(legacy.taxWithheld, 0);
    expect(legacy.shiftPassCost, 0);
  });

  testWidgets('bugun: gross / komissiya / soliq / smena / sof', (tester) async {
    await pump(tester);

    expect(valueOf(tester, 'earnings_gross_value'), Formatters.formatPrice(20000));
    expect(valueOf(tester, 'earnings_commission_value'),
        '- ${Formatters.formatPrice(2000)}');
    expect(valueOf(tester, 'earnings_tax_value'),
        '- ${Formatters.formatPrice(200)}');
    expect(valueOf(tester, 'earnings_shift_pass_value'),
        '- ${Formatters.formatPrice(25000)}');
    // Sof — serverniki (manfiy bo'lishi mumkin: smena kun boshida olingan).
    expect(valueOf(tester, 'earnings_net_value'), Formatters.formatPrice(-7200));
    expect(valueOf(tester, 'earnings_ledger_net_value'),
        Formatters.formatPrice(-7200));
    expect(find.text('Soliq (1%)'), findsOneWidget);
  });

  testWidgets("smena 0 bo'lgan davrda smena qatori yo'q, soliq qatori bor",
      (tester) async {
    await pump(tester);
    await tester.tap(find.text('Hafta'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(valueOf(tester, 'earnings_tax_value'),
        '- ${Formatters.formatPrice(1400)}');
    expect(find.byKey(const ValueKey('earnings_shift_pass_value')), findsNothing);
    expect(valueOf(tester, 'earnings_net_value'), Formatters.formatPrice(124600));
  });

  testWidgets('smena kartasi taqqoslash matni bilan, to\'ldirish tugmasi bor',
      (tester) async {
    await pump(tester);

    expect(find.byKey(const ValueKey('shift_pass_card')), findsOneWidget);
    expect(
      valueOf(tester, 'shift_pass_comparison'),
      "So'nggi 7 kunda komissiyaga ${Formatters.formatPrice(84000)} "
      "to'ladingiz, smena bilan ${Formatters.formatPrice(75000)} bo'lardi.",
    );
    expect(find.byKey(const ValueKey('topup_open_button')), findsOneWidget);
  });

  testWidgets("smena o'chiq — karta chizilmaydi", (tester) async {
    when(() => api.get(ApiEndpoints.driverShiftPass)).thenAnswer(
      (_) async => _ok(ApiEndpoints.driverShiftPass, {'enabled': false}),
    );
    await pump(tester);
    expect(find.byKey(const ValueKey('shift_pass_card')), findsNothing);
  });

  testWidgets("hamyon provayderisiz (eski qurilish) ekran ishlaydi",
      (tester) async {
    await pump(tester, withWallet: false);
    expect(find.byKey(const ValueKey('shift_pass_card')), findsNothing);
    expect(find.byKey(const ValueKey('topup_open_button')), findsNothing);
    expect(valueOf(tester, 'earnings_tax_value'),
        '- ${Formatters.formatPrice(200)}');
  });

  testWidgets("smena sotib olish: tasdiqlash → POST → faol", (tester) async {
    when(() => api.post(ApiEndpoints.driverShiftPass)).thenAnswer(
      (_) async => _ok(ApiEndpoints.driverShiftPass, {
        'id': 'p1',
        'startsAt': DateTime.now().toUtc().toIso8601String(),
        'endsAt': DateTime.now()
            .add(const Duration(hours: 24))
            .toUtc()
            .toIso8601String(),
        'price': 25000,
        'status': 'active',
        'serviceTypes': ['taxi'],
      }),
    );
    await pump(tester);

    await tester.tap(find.byKey(const ValueKey('shift_pass_buy_button')));
    await tester.pumpAndSettle();
    expect(find.text('Smena sotib olinsinmi?'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('shift_pass_confirm_button')));
    await tester.pumpAndSettle();

    verify(() => api.post(ApiEndpoints.driverShiftPass)).called(1);
    expect(find.text('Smena faol'), findsOneWidget);
    expect(find.byKey(const ValueKey('shift_pass_remaining')), findsOneWidget);
    // Kartadagi daqiqalik taymer — ekran yopilishi bilan to'xtaydi.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets("smena: 400 mablag' yetmaydi — server matni va To'ldirish",
      (tester) async {
    when(() => api.post(ApiEndpoints.driverShiftPass)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverShiftPass),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.driverShiftPass),
          statusCode: 400,
          data: {
            'success': false,
            'message': "Hamyonda mablag' yetarli emas: smena narxi 25 000 so'm",
          },
        ),
      ),
    );
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('shift_pass_buy_button')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('shift_pass_confirm_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.textContaining("Hamyonda mablag' yetarli emas"), findsOneWidget);
    expect(find.widgetWithText(SnackBarAction, "To'ldirish"), findsOneWidget);
  });

  testWidgets("chaqim > 0: yo'l haqidan sof → + chaqim → jami sof tushum",
      (tester) async {
    await pump(tester);
    // Chaqimsiz davrda qatorlar yo'q.
    expect(find.byKey(const ValueKey('earnings_tips_value')), findsNothing);

    await tester.tap(find.text('Oy'));
    await tester.pump(const Duration(milliseconds: 100));

    expect(valueOf(tester, 'earnings_fares_net_value'),
        Formatters.formatPrice(45000));
    expect(valueOf(tester, 'earnings_tips_value'),
        '+ ${Formatters.formatPrice(3000)}');
    expect(valueOf(tester, 'earnings_ledger_net_value'),
        Formatters.formatPrice(48000));
    expect(valueOf(tester, 'earnings_net_value'), Formatters.formatPrice(48000));
    expect(find.text('Jami sof tushum'), findsOneWidget);
  });

  testWidgets("smena: SHIFT_PASS_INSUFFICIENT_BALANCE — details summalari",
      (tester) async {
    when(() => api.post(ApiEndpoints.driverShiftPass)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverShiftPass),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.driverShiftPass),
          statusCode: 400,
          data: {
            'success': false,
            'message': 'Недостаточно средств для смены',
            'code': 'SHIFT_PASS_INSUFFICIENT_BALANCE',
            'details': {'price': 25000, 'balance': 1000},
          },
        ),
      ),
    );
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('shift_pass_buy_button')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('shift_pass_confirm_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      find.textContaining('Narxi: ${Formatters.formatPrice(25000)}, '
          'balans: ${Formatters.formatPrice(1000)}'),
      findsOneWidget,
    );
  });
}
