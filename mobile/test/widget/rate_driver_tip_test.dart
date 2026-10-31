// Chaqim (tips) UI sinovlari — mobile/lib/features/passenger/screens/
// rate_driver_screen.dart.
//
// Qamrov: tayyor summa tanlab yuborish POST /orders/:id/tip ga to'g'ri
// butun son yuboradi · chaqimsiz yuborish faqat bahoni jo'natadi ·
// 409 va 400 (mablag' yetmasligi) uchun ALOHIDA o'zbekcha xabar ·
// 320x568 ekranda va katta tizim shriftida ustun toshib ketmaydi.
//
// ApiClient mocktail bilan almashtiriladi (driver_wallet_withdraw_test.dart
// dagi naqsh). Baho `sl<ApiClient>()` orqali, chaqim esa OrderProvider
// orqali ketgani uchun bitta mock ikkala yo'lga ham beriladi.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/rate_driver_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

const String _orderId = 'order-1';

/// ⚠️ `Formatters` 'uz' lokalidagi guruh ajratgichini ishlatadi — u ODDIY
/// bo'shliq emas, uzilmas bo'shliq (U+00A0). Shu sabab kutilayotgan matn
/// qo'lda yozilmaydi, aynan shu formatterdan olinadi.
String _som(int amount) => Formatters.formatSom(amount.toDouble());

Response<dynamic> _ok(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

DioException _httpError(String path, int status, String message) {
  final options = RequestOptions(path: path);
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: options,
      statusCode: status,
      data: {'success': false, 'message': message, 'statusCode': status},
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late OrderProvider orderProvider;
  late GlobalKey<NavigatorState> navKey;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() async {
    apiClient = MockApiClient();
    orderProvider = OrderProvider(
      apiClient: apiClient,
      socketService: SocketService(),
    );
    navKey = GlobalKey<NavigatorState>();

    await sl.reset();
    sl.registerSingleton<ApiClient>(apiClient);

    // POST /ratings — baho har doim o'tadi; sinovlar chaqim yo'liga qaraydi.
    when(() => apiClient.post(ApiEndpoints.submitRating,
            data: any(named: 'data')))
        .thenAnswer((_) async => _ok(ApiEndpoints.submitRating, {'id': 'r1'}));
    when(() => apiClient.post(ApiEndpoints.addTip(_orderId),
        data: any(named: 'data'))).thenAnswer(
      (_) async => _ok(
        ApiEndpoints.addTip(_orderId),
        {'tipAmount': 5000, 'walletBalance': 95000},
      ),
    );
  });

  tearDown(() async {
    await sl.reset();
  });

  Future<void> pumpRateScreen(
    WidgetTester tester, {
    double textScale = 1.0,
    Size size = const Size(420, 1000),
  }) async {
    // Baholash ekrani baland — oqim sinovlari uchun hamma narsa sig'adigan
    // oyna beriladi; kichik ekran alohida sinovda tekshiriladi.
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ChangeNotifierProvider<OrderProvider>.value(
        value: orderProvider,
        child: MaterialApp(
          navigatorKey: navKey,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: const Scaffold(body: Text('bosh ekran')),
        ),
      ),
    );
    navKey.currentState!.push(
      MaterialPageRoute<void>(
        builder: (_) => const RateDriverScreen(
          orderId: _orderId,
          driverName: 'Sardor',
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// Beshinchi yulduzni bosadi — chaqimsiz ham, chaqim bilan ham baho
  /// bo'lmasa "Yuborish" ishlamaydi.
  Future<void> rateFiveStars(WidgetTester tester) async {
    await tester.tap(find.byIcon(Icons.star_outline_rounded).at(4));
    await tester.pumpAndSettle();
  }

  /// So'rov + haptika `Future.delayed` larini to'liq bo'shatadi (aks holda
  /// sinov "A Timer is still pending" bilan yiqiladi).
  Future<void> drain(WidgetTester tester) async {
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 120));
    }
  }

  testWidgets('tayyor summa tanlanib yuborilsa POST /orders/:id/tip ketadi',
      (tester) async {
    await pumpRateScreen(tester);
    await rateFiveStars(tester);

    await tester.tap(find.text(_som(5000)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    verify(() => apiClient.post(ApiEndpoints.submitRating,
        data: any(named: 'data'))).called(1);
    // ⚠️ Butun son — backend `@IsInt`; `5000.0` yuborilsa 400 qaytardi.
    verify(() => apiClient.post(
          ApiEndpoints.addTip(_orderId),
          data: {'amount': 5000},
        )).called(1);
  });

  testWidgets('chaqim tanlanmasa faqat baho yuboriladi', (tester) async {
    await pumpRateScreen(tester);
    await rateFiveStars(tester);

    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    verify(() => apiClient.post(ApiEndpoints.submitRating,
        data: any(named: 'data'))).called(1);
    verifyNever(() => apiClient.post(ApiEndpoints.addTip(_orderId),
        data: any(named: 'data')));
  });

  testWidgets('tanlangan chip qayta bosilsa chaqim bekor qilinadi',
      (tester) async {
    await pumpRateScreen(tester);
    await rateFiveStars(tester);

    await tester.tap(find.text(_som(2000)));
    await tester.pumpAndSettle();
    await tester.tap(find.text(_som(2000)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    verifyNever(() => apiClient.post(ApiEndpoints.addTip(_orderId),
        data: any(named: 'data')));
  });

  testWidgets('"Boshqa" summasi chegaradan chiqsa so\'rov yuborilmaydi',
      (tester) async {
    await pumpRateScreen(tester);
    await rateFiveStars(tester);

    await tester.tap(find.text('Boshqa'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, '500');
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    expect(
      find.textContaining('Chaqim ${Formatters.formatAmount(1000)}'),
      findsOneWidget,
    );
    verifyNever(() => apiClient.post(ApiEndpoints.addTip(_orderId),
        data: any(named: 'data')));
    verifyNever(() => apiClient.post(ApiEndpoints.submitRating,
        data: any(named: 'data')));
  });

  // ⚠️ Chaqim IXTIYORIY: "Boshqa" ochilib bo'sh qoldirilsa, u chaqimdan voz
  // kechish demak. Aks holda ixtiyoriy maydon bahoni yuborishga to'siq
  // bo'lardi — foydalanuvchi "Boshqa" ni qanday yopishni topmaguncha ekranda
  // qamalib qolardi.
  testWidgets('"Boshqa" bo\'sh qoldirilsa baho chaqimsiz yuboriladi',
      (tester) async {
    await pumpRateScreen(tester);
    await rateFiveStars(tester);

    await tester.tap(find.text('Boshqa'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);
    await tester.pumpAndSettle();

    verify(() => apiClient.post(ApiEndpoints.submitRating,
        data: any(named: 'data'))).called(1);
    verifyNever(() => apiClient.post(ApiEndpoints.addTip(_orderId),
        data: any(named: 'data')));
    // Ekran yopildi — xato bilan to'xtab qolmadi.
    expect(find.text('bosh ekran'), findsOneWidget);
  });

  testWidgets('409 — "allaqachon berilgan" xabari va tanlov yopiladi',
      (tester) async {
    when(() => apiClient.post(ApiEndpoints.addTip(_orderId),
            data: any(named: 'data')))
        .thenThrow(_httpError(ApiEndpoints.addTip(_orderId), 409,
            'Bu safar uchun chaqim allaqachon berilgan'));

    await pumpRateScreen(tester);
    await rateFiveStars(tester);
    await tester.tap(find.text(_som(5000)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    expect(
      find.text('Bu safar uchun chaqim allaqachon berilgan.'),
      findsOneWidget,
    );
    // Qayta urinish foydasiz — summalar olib tashlanadi.
    expect(find.text(_som(5000)), findsNothing);
    expect(find.text('Yopish'), findsOneWidget);
    // Baho saqlangan, foydalanuvchi ekranda qolgan.
    expect(find.text('bosh ekran'), findsNothing);
  });

  testWidgets("400 — hamyonda mablag' yetmasligi alohida tushuntiriladi",
      (tester) async {
    when(() => apiClient.post(ApiEndpoints.addTip(_orderId),
            data: any(named: 'data')))
        .thenThrow(_httpError(ApiEndpoints.addTip(_orderId), 400,
            "Hamyonda mablag' yetarli emas. Avval hamyonni to'ldiring."));

    await pumpRateScreen(tester);
    await rateFiveStars(tester);
    await tester.tap(find.text(_som(10000)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    expect(find.textContaining("mablag' yetarli emas"), findsOneWidget);
    expect(find.textContaining('kichikroq summa'), findsOneWidget);
    // 409 dan farqli — kichikroq summa tanlash mumkin bo'lib qoladi.
    expect(find.text(_som(2000)), findsOneWidget);
  });

  testWidgets('chaqim xatosidan keyin qayta yuborishda baho takrorlanmaydi',
      (tester) async {
    when(() => apiClient.post(ApiEndpoints.addTip(_orderId),
            data: any(named: 'data')))
        .thenThrow(_httpError(ApiEndpoints.addTip(_orderId), 400,
            "Hamyonda mablag' yetarli emas."));

    await pumpRateScreen(tester);
    await rateFiveStars(tester);
    await tester.tap(find.text(_som(10000)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    // Kichikroq summa bilan qayta urinish.
    when(() => apiClient.post(ApiEndpoints.addTip(_orderId),
        data: any(named: 'data'))).thenAnswer(
      (_) async => _ok(ApiEndpoints.addTip(_orderId),
          {'tipAmount': 2000, 'walletBalance': 3000}),
    );
    await tester.tap(find.text(_som(2000)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yuborish'));
    await drain(tester);

    verify(() => apiClient.post(ApiEndpoints.submitRating,
        data: any(named: 'data'))).called(1);
    verify(() => apiClient.post(
          ApiEndpoints.addTip(_orderId),
          data: {'amount': 2000},
        )).called(1);
  });

  testWidgets('muvaffaqiyatda ekran yopiladi', (tester) async {
    await pumpRateScreen(tester);
    await rateFiveStars(tester);
    await tester.tap(find.text(_som(5000)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Yuborish'));
    await drain(tester);
    await tester.pumpAndSettle();

    expect(find.text('bosh ekran'), findsOneWidget);
    expect(find.textContaining('haydovchiga yuborildi'), findsOneWidget);
  });

  testWidgets("320x568 ekranda, 1.3x shriftda ustun toshib ketmaydi",
      (tester) async {
    await pumpRateScreen(
      tester,
      textScale: 1.3,
      size: const Size(320, 568),
    );
    expect(tester.takeException(), isNull);

    // "Boshqa" maydoni ochilgan holat — ustunning eng baland ko'rinishi.
    await tester.ensureVisible(find.text('Boshqa'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Boshqa'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    // Aylantirish ishlaydi: pastdagi tugmalarga yetib borish mumkin.
    await tester.dragUntilVisible(
      find.text("O'tkazib yuborish"),
      find.byType(SingleChildScrollView),
      const Offset(0, -80),
    );
    expect(find.text("O'tkazib yuborish"), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
