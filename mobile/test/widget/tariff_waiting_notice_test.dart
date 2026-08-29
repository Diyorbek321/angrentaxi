// Tarif ekranidagi KUTISH QOIDASI va "narx belgilangan" va'dasi.
//
// NEGA BU TEST BOR: kutish haqi endi qat'iy narx kafolatidan TASHQARIDA
// undiriladi (`orders-completion.service.ts`). Ya'ni yo'lovchi ko'rsatilgan
// summadan ortiq to'lashi mumkin. Buni BOSISHDAN OLDIN aytmaslik — chekdagi
// e'tirozning va bekor qilishning eng arzon sababi, shuning uchun matnning
// borligi ko'rinish emas, SHARTNOMA sifatida qo'riqlanadi.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/tariff_select_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

/// `flutter test` ostida haqiqiy OSRM chaqiruvidan qochadi.
class FakeRouteService extends RouteService {
  @override
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async =>
      null;
}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  setUpAll(() async {
    registerFallbackValue(<String, dynamic>{});
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient apiClient;
  late OrderProvider orderProvider;

  /// Tarif kutish maydonlarini O'ZI beradi — ekran hech narsani o'ylab
  /// topmasligi kerak.
  Map<String, dynamic> tariffJson({bool withWaitingFields = true}) => {
        'id': 'tariff-1',
        'name': 'Standard',
        'basePrice': 3000,
        'pricePerKm': 1500,
        'minPrice': 5000,
        'surgeMultiplier': 1,
        'isActive': true,
        if (withWaitingFields) ...{
          'freeWaitMinutes': 4,
          'waitingPricePerMinute': 700,
        },
      };

  void mockTariffs(Map<String, dynamic> tariff) {
    when(() => apiClient.get('${ApiEndpoints.tariffs}?serviceType=taxi'))
        .thenAnswer(
            (_) async => _jsonResponse(ApiEndpoints.tariffs, [tariff]));
  }

  setUp(() {
    apiClient = MockApiClient();
    orderProvider =
        OrderProvider(apiClient: apiClient, socketService: SocketService());

    sl.registerLazySingleton<RouteService>(() => FakeRouteService());

    mockTariffs(tariffJson());
    when(() =>
            apiClient.post(ApiEndpoints.estimatePrice, data: any(named: 'data')))
        .thenAnswer((_) async =>
            _jsonResponse(ApiEndpoints.estimatePrice, {'price': 18000}));

    orderProvider.setPendingPickup(
      const OrderLocation(address: 'Pickup', lat: 40.75, lng: 72.34),
    );
    orderProvider.setPendingDropoff(
      const OrderLocation(address: 'Dropoff', lat: 40.76, lng: 72.35),
    );
  });

  tearDown(() {
    if (sl.isRegistered<RouteService>()) {
      sl.unregister<RouteService>();
    }
  });

  Future<void> pumpTariffScreen(WidgetTester tester) async {
    // ⚠️ TELEFON O'LCHAMI MAJBURIY — `flutter test` ning 800x600 oynasi
    // `AdaptiveMapPanel` ni yon panelga aylantiradi.
    tester.view.physicalSize = const Size(412 * 3, 915 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ChangeNotifierProvider<OrderProvider>.value(
        value: orderProvider,
        child: MaterialApp(
          home: TariffSelectScreen(
            paymentService: PaymentService(apiClient: apiClient),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('kutish qoidasi buyurtmadan OLDIN va tarif qiymatlari bilan',
      (tester) async {
    await pumpTariffScreen(tester);

    // Raqamlar tarifdan keladi (4 daqiqa / 700 so'm), qattiq kodlanmaydi.
    expect(find.textContaining('4 daqiqa kutish'), findsOneWidget);
    expect(find.textContaining('700'), findsOneWidget);
    // Eng muhimi: haq narxdan TASHQARIDA ekani aytiladi.
    expect(find.textContaining('alohida'), findsOneWidget);
  });

  // ⚠️ ORQAGA MOSLIK: migratsiyadan o'tmagan server bu ikki kalitni
  // yubormaydi. Ekran raqamsiz qolmasligi kerak — zaxira qiymatlar
  // backend ustunlarining o'z DEFAULT'i bilan bir xil (3 daqiqa / 500 so'm).
  testWidgets('eski server kutish maydonlarini yubormasa ham qoida ko\'rinadi',
      (tester) async {
    mockTariffs(tariffJson(withWaitingFields: false));
    await pumpTariffScreen(tester);

    expect(find.textContaining('3 daqiqa kutish'), findsOneWidget);
    expect(find.textContaining('500'), findsOneWidget);
  });

  // ⚠️ VA'DA REGRESSIYASI. Eski matn "Narx hozir qotiriladi va safar kunida
  // o'zgarmaydi." deb tugardi — endi bu to'liq rost emas, chunki kutish haqi
  // kafolatdan tashqarida qo'shiladi. Bu test eski, shartsiz va'da qaytib
  // kelishini to'sadi.
  testWidgets('rejalashtirish banneri kutish istisnosini aytadi',
      (tester) async {
    await pumpTariffScreen(tester);

    orderProvider.setScheduledAt(DateTime.now().add(const Duration(hours: 3)));
    await tester.pumpAndSettle();

    expect(find.textContaining('Narx hozir qotiriladi'), findsOneWidget);
    expect(
      find.textContaining('kutish haqi bundan tashqari'),
      findsOneWidget,
    );
    // Eski shartsiz va'da matni qolmagan.
    expect(
      find.textContaining("o'zgarmaydi. Haydovchi"),
      findsNothing,
    );
  });
}
