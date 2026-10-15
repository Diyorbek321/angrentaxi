// Hamyonni to'ldirish ekrani — docs/LEGAL-COMPLIANCE.md §11, §17.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/wallet_topup_screen.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
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
  late DriverProvider driver;
  var walletBalance = 20000;
  var topupStatus = 'pending';
  late List<PaymentInitiateResult> opened;

  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorage(await SharedPreferences.getInstance());
    api = MockApiClient();
    walletBalance = 20000;
    topupStatus = 'pending';
    opened = [];
    when(() => api.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _ok(ApiEndpoints.paymentsWallet, {'balance': walletBalance}),
    );
    when(() => api.get(ApiEndpoints.walletTopups)).thenAnswer(
      (_) async => _ok(ApiEndpoints.walletTopups, [
        {
          'id': 'old-1',
          'amount': 50000,
          'provider': 'click',
          'status': 'paid',
          'createdAt': '2026-10-10T08:00:00.000Z',
          'paidAt': '2026-10-10T08:01:00.000Z',
        },
      ]),
    );
    when(() => api.get(ApiEndpoints.walletTopupById('t-1'))).thenAnswer(
      (_) async => _ok(ApiEndpoints.walletTopupById('t-1'), {
        'id': 't-1',
        'amount': 100000,
        'provider': 'payme',
        'status': topupStatus,
      }),
    );
    when(() => api.post(ApiEndpoints.walletTopup, data: any(named: 'data')))
        .thenAnswer(
      (_) async => _ok(ApiEndpoints.walletTopup, {
        'id': 't-1',
        'topupId': 't-1',
        'checkoutUrl': 'https://checkout.paycom.uz/xyz',
        'amount': 100000,
        'provider': 'payme',
        'status': 'pending',
      }),
    );
  });

  void stubSettings(Map<String, dynamic> settings) {
    when(() => api.get(ApiEndpoints.settingsPublic)).thenAnswer(
      (_) async => _ok(ApiEndpoints.settingsPublic, settings),
    );
  }

  Future<void> pump(WidgetTester tester, {String? topupId}) async {
    tester.view.physicalSize = const Size(1080, 3200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: storage,
    );
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driver),
          ChangeNotifierProvider<DriverWalletProvider>(
            create: (_) => DriverWalletProvider(apiClient: api),
          ),
        ],
        child: MaterialApp(
          home: WalletTopupScreen(
            topupId: topupId,
            pollInterval: const Duration(milliseconds: 200),
            openCheckout: (context, result) async {
              opened.add(result);
              return true;
            },
          ),
        ),
      ),
    );
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  const enabled = {
    'supportPhone': '+998712000000',
    'walletTopupEnabled': true,
    'walletTopupMin': 10000,
    'walletTopupMax': 2000000,
    'walletTopupPresets': [50000, 100000, 200000],
  };

  testWidgets("o'chiq — operator orqali to'ldirish va telefon",
      (tester) async {
    stubSettings({'walletTopupEnabled': false, 'supportPhone': '+998712000000'});
    await pump(tester);

    expect(find.byKey(const ValueKey('topup_operator_card')), findsOneWidget);
    expect(find.text("Operator orqali to'ldirish"), findsOneWidget);
    expect(find.byKey(const ValueKey('topup_call_operator')), findsOneWidget);
    expect(find.byKey(const ValueKey('topup_pay_button')), findsNothing);
  });

  testWidgets('tayyor summalar va o\'rtadagisi oldindan tanlangan',
      (tester) async {
    stubSettings(enabled);
    await pump(tester);

    expect(find.byKey(const ValueKey('topup_preset_50000')), findsOneWidget);
    final field = tester.widget<TextField>(
        find.byKey(const ValueKey('topup_amount_field')));
    expect(field.controller!.text, '100000');
    // Tarix ham ko'rinadi.
    expect(find.byKey(const ValueKey('topup_row_old-1')), findsOneWidget);
  });

  testWidgets('minimumdan kam summa — maydon ostida xato, so\'rov ketmaydi',
      (tester) async {
    stubSettings(enabled);
    await pump(tester);

    await tester.enterText(
        find.byKey(const ValueKey('topup_amount_field')), '5000');
    await tester.tap(find.byKey(const ValueKey('topup_pay_button')));
    await tester.pump();

    expect(find.textContaining('Eng kam summa'), findsOneWidget);
    verifyNever(() => api.post(ApiEndpoints.walletTopup, data: any(named: 'data')));
  });

  testWidgets('to\'liq oqim: POST → checkout → so\'rov paid → muvaffaqiyat',
      (tester) async {
    stubSettings(enabled);
    await pump(tester);

    await tester.tap(find.byKey(const ValueKey('topup_provider_click')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('topup_preset_100000')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('topup_pay_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final captured = verify(() => api.post(ApiEndpoints.walletTopup,
        data: captureAny(named: 'data'))).captured.single as Map;
    expect(captured, {'amount': 100000, 'provider': 'click'});
    expect(opened.single.url, 'https://checkout.paycom.uz/xyz');
    expect(find.byKey(const ValueKey('topup_waiting')), findsOneWidget);

    // Provayder callback'i o'tdi — keyingi so'rov `paid` ni ko'radi.
    topupStatus = 'paid';
    walletBalance = 120000;
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byKey(const ValueKey('topup_success')), findsOneWidget);
    expect(
      tester.widget<Text>(find.byKey(const ValueKey('topup_new_balance'))).data,
      'Yangi balans: ${Formatters.formatPrice(120000)}',
    );
  });

  testWidgets('realtime wallet:updated ham muvaffaqiyatga o\'tkazadi',
      (tester) async {
    stubSettings(enabled);
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('topup_pay_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('topup_waiting')), findsOneWidget);

    walletBalance = 120000;
    driver.applyWalletUpdate(const WalletUpdate(
      balance: 120000,
      delta: 100000,
      reason: 'topup',
      topupId: 't-1',
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byKey(const ValueKey('topup_success')), findsOneWidget);
  });

  testWidgets("to'lov o'tmadi — xato holati va qayta urinish", (tester) async {
    stubSettings(enabled);
    topupStatus = 'failed';
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('topup_pay_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byKey(const ValueKey('topup_failed')), findsOneWidget);
    await tester.tap(find.text('Qayta urinish'));
    await tester.pump();
    expect(find.byKey(const ValueKey('topup_pay_button')), findsOneWidget);
  });

  // To'lovdan qaytish havolasi (§24): forma emas, shu to'ldirish holati.
  testWidgets("qaytish havolasi (topupId): pending → so'rov → paid",
      (tester) async {
    stubSettings(enabled);
    await pump(tester, topupId: 't-1');
    expect(find.byKey(const ValueKey('topup_waiting')), findsOneWidget);
    expect(find.byKey(const ValueKey('topup_pay_button')), findsNothing);

    topupStatus = 'paid';
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('topup_success')), findsOneWidget);
    expect(opened, isEmpty);
  });

  testWidgets("qaytish havolasi: allaqachon paid — darhol muvaffaqiyat",
      (tester) async {
    stubSettings(enabled);
    topupStatus = 'paid';
    await pump(tester, topupId: 't-1');
    expect(find.byKey(const ValueKey('topup_success')), findsOneWidget);
  });

  testWidgets("WALLET_TOPUP_AMOUNT_OUT_OF_RANGE — server matni va oraliq",
      (tester) async {
    stubSettings(enabled);
    when(() => api.post(ApiEndpoints.walletTopup, data: any(named: 'data')))
        .thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.walletTopup),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.walletTopup),
          statusCode: 400,
          data: {
            'success': false,
            'message': "Summa ruxsat etilgan oraliqda emas",
            'code': 'WALLET_TOPUP_AMOUNT_OUT_OF_RANGE',
            'details': {'min': 20000, 'max': 500000},
          },
        ),
      ),
    );
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('topup_pay_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final text = tester
        .widget<Text>(find.byKey(const ValueKey('topup_server_error')))
        .data!;
    expect(text, contains('Summa ruxsat etilgan oraliqda emas'));
    expect(text, contains(Formatters.formatPrice(20000)));
    expect(text, contains(Formatters.formatPrice(500000)));
  });

  testWidgets(
      'WALLET_TOPUP_TOO_MANY_PENDING — ochiq to\'lovlarni ko\'rish va davom ettirish',
      (tester) async {
    stubSettings(enabled);
    var attempts = 0;
    when(() => api.post(ApiEndpoints.walletTopup, data: any(named: 'data')))
        .thenAnswer((_) async {
      attempts++;
      if (attempts == 1) {
        throw DioException(
          requestOptions: RequestOptions(path: ApiEndpoints.walletTopup),
          response: Response(
            requestOptions: RequestOptions(path: ApiEndpoints.walletTopup),
            statusCode: 409,
            data: {
              'success': false,
              'message': 'srv',
              'code': 'WALLET_TOPUP_TOO_MANY_PENDING',
              'details': {'maxPending': 3},
            },
          ),
        );
      }
      // Bir xil summa+provayder — server mavjud to'ldirishni qaytaradi.
      return _ok(ApiEndpoints.walletTopup, {
        'id': 'p-1',
        'topupId': 'p-1',
        'checkoutUrl': 'https://checkout.paycom.uz/p1',
        'amount': 70000,
        'provider': 'payme',
        'status': 'pending',
      });
    });
    when(() => api.get(ApiEndpoints.walletTopups)).thenAnswer(
      (_) async => _ok(ApiEndpoints.walletTopups, [
        {
          'id': 'p-1',
          'amount': 70000,
          'provider': 'payme',
          'status': 'pending',
          'createdAt': '2026-10-15T08:00:00.000Z',
        },
      ]),
    );
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('topup_pay_button')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final text = tester
        .widget<Text>(find.byKey(const ValueKey('topup_server_error')))
        .data!;
    expect(text, contains('3 ta'));
    expect(find.byKey(const ValueKey('topup_show_pending')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('topup_show_pending')));
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byKey(const ValueKey('topup_continue_p-1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    final body = verify(() => api.post(ApiEndpoints.walletTopup,
            data: captureAny(named: 'data')))
        .captured
        .last as Map;
    expect(body, {'amount': 70000, 'provider': 'payme'});
    expect(opened.single.url, 'https://checkout.paycom.uz/p1');
    expect(find.byKey(const ValueKey('topup_waiting')), findsOneWidget);
  });
}
