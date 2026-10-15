// Huquqiy profil ekrani — `GET/PATCH /drivers/me/legal`
// (docs/LEGAL-COMPLIANCE.md §1, §5) va kuryer hamyon dialogi (§7).
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/legal/driver_legal_provider.dart';
import 'package:angren_taxi/features/driver/legal/legal_rejection.dart';
import 'package:angren_taxi/features/driver/screens/driver_legal_screen.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_events_host.dart';
import 'package:angren_taxi/features/driver/widgets/vendor_wallet_insufficient_dialog.dart';
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

Map<String, dynamic> _summary({
  Map<String, dynamic> profile = const {'citizenship': 'UZ'},
  List<Map<String, String>> reasons = const [
    {'code': 'pinfl_missing', 'message': 'JShShIR (PINFL) kiritilmagan'},
    {'code': 'document_taxi_licence', 'message': 'Taksi litsenziya varaqasi yuklanmagan'},
  ],
}) =>
    {
      'profile': profile,
      'eligibility': {
        'eligible': reasons.isEmpty,
        'enforced': false,
        'enforcedFrom': null,
        'appliesToTaxi': true,
        'blocking': false,
        'reasons': reasons,
      },
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MockApiClient api;

  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  setUp(() {
    api = MockApiClient();
    when(() => api.get(ApiEndpoints.driverLegal))
        .thenAnswer((_) async => _ok(ApiEndpoints.driverLegal, _summary()));
  });

  Future<void> pump(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverLegalProvider>(
        create: (_) => DriverLegalProvider(apiClient: api),
        child: MaterialApp(
          home: const DriverLegalScreen(),
          routes: {
            '/driver/verification': (_) =>
                const Scaffold(body: Text('tekshiruv-ekrani')),
          },
        ),
      ),
    );
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Finder field(String key) => find.byKey(ValueKey(key));

  testWidgets("sabablar ko'rinadi, hujjat sababi tekshiruvga olib boradi",
      (tester) async {
    await pump(tester);

    expect(find.text('Bajarilmagan talablar'), findsOneWidget);
    expect(find.text('JShShIR (PINFL) kiritilmagan'), findsOneWidget);
    expect(find.text('Taksi litsenziya varaqasi yuklanmagan'), findsOneWidget);
    // Majburlanmagan — ogohlantirish, blok emas.
    expect(find.textContaining('Hozircha ogohlantirish'), findsOneWidget);

    await tester.tap(field('legal_open_documents'));
    await tester.pumpAndSettle();
    expect(find.text('tekshiruv-ekrani'), findsOneWidget);
  });

  testWidgets("noto'g'ri JShShIR va YaTT uchun STIR yo'q — PATCH yuborilmaydi",
      (tester) async {
    await pump(tester);

    await tester.tap(field('legal_tax_individual_entrepreneur'));
    await tester.pump();
    await tester.enterText(field('legal_pinfl_field'), '12345');
    await tester.tap(field('legal_save_button'));
    await tester.pump();

    expect(find.text("JShShIR 14 ta raqamdan iborat bo'lishi kerak"), findsOneWidget);
    expect(find.text('YaTT uchun STIR majburiy'), findsOneWidget);
    verifyNever(() => api.patch(ApiEndpoints.driverLegal, data: any(named: 'data')));
  });

  testWidgets('soliq maqomi tanlanmasa xato', (tester) async {
    await pump(tester);
    await tester.enterText(field('legal_pinfl_field'), '12345678901234');
    await tester.tap(field('legal_save_button'));
    await tester.pump();
    expect(find.text('Soliq maqomini tanlang'), findsOneWidget);
  });

  testWidgets("to'g'ri ma'lumot — PATCH tanasi va yangilangan xulosa",
      (tester) async {
    when(() => api.patch(ApiEndpoints.driverLegal, data: any(named: 'data')))
        .thenAnswer((_) async => _ok(
              ApiEndpoints.driverLegal,
              _summary(
                profile: {
                  'taxStatus': 'self_employed',
                  'pinfl': '12345678901234',
                  'citizenship': 'UZ',
                },
                reasons: const [],
              ),
            ));
    await pump(tester);

    await tester.tap(field('legal_tax_self_employed'));
    await tester.pump();
    await tester.enterText(field('legal_pinfl_field'), '12345678901234');
    await tester.enterText(field('legal_taxi_licence_field'), 'TL-77');
    await tester.tap(field('legal_save_button'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final body = verify(() => api.patch(ApiEndpoints.driverLegal,
        data: captureAny(named: 'data'))).captured.single as Map;
    expect(body['taxStatus'], 'self_employed');
    expect(body['pinfl'], '12345678901234');
    expect(body['tin'], isNull);
    expect(body['taxiLicenceNumber'], 'TL-77');
    expect(find.text('Barcha talablar bajarilgan'), findsOneWidget);
    expect(find.text('Huquqiy profil saqlandi'), findsOneWidget);
  });

  group('kuryer hamyon rejimi', () {
    const message = "Hamyonda mablag' yetarli emas: do'konga 85 000 so'm "
        "o'tkazish kerak, balansingiz 10 000 so'm. Avval hamyonni to'ldiring.";

    test('acceptOrder 400 — errorKind vendorWalletInsufficient', () async {
      SharedPreferences.setMockInitialValues({});
      final driver = DriverProvider(
        apiClient: api,
        socketService: SocketService(),
        locationService: LocationService(),
        localStorage: LocalStorage(await SharedPreferences.getInstance()),
      );
      when(() => api.patch(ApiEndpoints.acceptOrder('o-1'))).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/orders/o-1/accept'),
          response: Response(
            requestOptions: RequestOptions(path: '/orders/o-1/accept'),
            statusCode: 400,
            data: {'success': false, 'message': message},
          ),
        ),
      );
      await driver.acceptOrder('o-1');
      expect(driver.state, DriverProviderState.error);
      expect(driver.errorKind, DriverErrorKind.vendorWalletInsufficient);
      expect(driver.error, message);
      driver.clearError();
      expect(driver.errorKind, isNull);
    });

    testWidgets("dialog: server matni + To'ldirish to'ldirish ekranini ochadi",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          routes: {
            kDriverTopupRoute: (_) =>
                const Scaffold(body: Text('toldirish-ekrani')),
          },
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () =>
                    showVendorWalletInsufficientDialog(context, message),
                child: const Text('ochish'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('ochish'));
      await tester.pumpAndSettle();

      expect(find.text("Hamyonda mablag' yetarli emas"), findsOneWidget);
      expect(find.text(message), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('vendor_wallet_topup_button')));
      await tester.pumpAndSettle();
      expect(find.text('toldirish-ekrani'), findsOneWidget);
    });
  });

  group('qulf va takror (§25 #4)', () {
    DioException coded(int status, Map<String, dynamic> body) => DioException(
          requestOptions: RequestOptions(path: ApiEndpoints.driverLegal),
          response: Response(
            requestOptions: RequestOptions(path: ApiEndpoints.driverLegal),
            statusCode: status,
            data: {'success': false, 'statusCode': status, ...body},
          ),
        );

    Future<void> fillAndSave(WidgetTester tester) async {
      await tester.tap(field('legal_tax_self_employed'));
      await tester.pump();
      await tester.enterText(field('legal_pinfl_field'), '12345678901234');
      await tester.tap(field('legal_save_button'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets(
        "LEGAL_PROFILE_LOCKED — izoh, maydonlar faqat o'qish, qiymat qaytariladi",
        (tester) async {
      when(() => api.patch(ApiEndpoints.driverLegal, data: any(named: 'data')))
          .thenThrow(coded(403, {'code': 'LEGAL_PROFILE_LOCKED', 'message': 'srv'}));
      await pump(tester);
      expect(field('legal_locked_note'), findsNothing);

      await fillAndSave(tester);

      expect(field('legal_locked_note'), findsOneWidget);
      expect(find.textContaining('operatorga murojaat qiling'), findsWidgets);
      final pinfl = tester.widget<TextField>(find.descendant(
          of: field('legal_pinfl_field'), matching: find.byType(TextField)));
      expect(pinfl.enabled, isFalse);
      // Server qiymatiga (bo'sh) qaytdi — keyingi saqlash qulfga urilmaydi.
      expect(pinfl.controller!.text, isEmpty);
      final chip = tester.widget<ChoiceChip>(field('legal_tax_self_employed'));
      expect(chip.onSelected, isNull);
    });

    testWidgets('LEGAL_PROFILE_DUPLICATE — maydon ostida xato', (tester) async {
      when(() => api.patch(ApiEndpoints.driverLegal, data: any(named: 'data')))
          .thenThrow(coded(409, {
        'code': 'LEGAL_PROFILE_DUPLICATE',
        'message': 'srv',
        'details': {'field': 'pinfl'},
      }));
      await pump(tester);

      await fillAndSave(tester);
      await tester.pump();

      expect(
        find.text("Bu JShShIR boshqa haydovchi profilida ro'yxatdan o'tgan"),
        findsWidgets,
      );
      expect(field('legal_locked_note'), findsNothing);
    });
  });
}
