// Haydovchi buyurtma oqimi XIZMAT TURIGA moslashishini tekshiruvchi
// vidjet testlari.
//
// ⚠️ MUAMMO: haydovchi ekranlari butunlay taksiga qurilgan edi
// ("Yo'lovchi", "Safarni boshlash"). Ovqat buyurtmasida esa olish nuqtasi
// RESTORAN, market'da DO'KON. Matn bitta jadvaldan
// (features/driver/service_wording.dart) kelishi va ekranlarda takrorlanmasligi
// shart — shu testlar aynan buni qo'riqlaydi.
//
// Uchinchi test guruhi eng muhimi: NOMA'LUM tur ilovani yiqitmasligi kerak.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/arrived_screen.dart';
import 'package:angren_taxi/features/driver/screens/order_offer_screen.dart';
import 'package:angren_taxi/features/driver/screens/trip_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/widgets/ag_slide_action.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Haqiqiy geolocator kanali `flutter test` da mavjud emas.
class _FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 41.0167,
        longitude: 70.1436,
        timestamp: DateTime(2026, 7, 13, 10),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
}

const String _orderId = 'order-1';

Map<String, dynamic> _orderJson({
  String? serviceType,
  String status = 'in_progress',
}) =>
    {
      'id': _orderId,
      'passengerId': 'passenger-1',
      'passenger': {
        'firstName': 'Aziz',
        'lastName': 'Karimov',
        'phone': '+998900000000',
      },
      'pickup': {
        'address': "Angren, Bobur ko'chasi, 10",
        'lat': 41.0167,
        'lng': 70.1436,
      },
      'dropoff': {
        'address': 'Angren, Mustaqillik maydoni',
        'lat': 41.0200,
        'lng': 70.1500,
      },
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-07-13T10:00:00.000Z',
      if (serviceType != null) 'serviceType': serviceType,
    };

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) =>
    Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late DriverProvider driverProvider;
  late AuthProvider authProvider;
  late LocalStorage localStorage;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    apiClient = MockApiClient();

    // Haptika platforma kanaliga chiqadi — testda keraksiz shovqin.
    AppHaptics.enabled = false;

    driverProvider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );
    authProvider = AuthProvider(
      apiClient: apiClient,
      localStorage: localStorage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );
    await localStorage.saveToken('test-token');
    await localStorage.saveUser({
      'id': 'driver-user-1',
      'phone': '+998901112233',
      'firstName': 'Sardor',
      'lastName': 'Toshev',
      'role': 'driver',
    });
    await authProvider.initialize();

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());
    sl.registerLazySingleton<ApiClient>(() => apiClient);
    sl.registerLazySingleton<SocketService>(() => SocketService());
  });

  tearDown(() async {
    AppHaptics.enabled = true;
    await sl.reset();
  });

  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 10}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  /// PATCH /orders/:id/accept — `activeOrder` ni haqiqiy yo'l bilan to'ldiradi.
  Future<void> seedActiveOrder(Map<String, dynamic> orderJson) async {
    when(() => apiClient.patch(ApiEndpoints.acceptOrder(_orderId))).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.acceptOrder(_orderId), orderJson),
    );
    await driverProvider.acceptOrder(_orderId);
  }

  Future<void> pumpOfferScreen(
    WidgetTester tester,
    Map<String, dynamic> orderJson,
  ) async {
    driverProvider.debugSetPendingOfferForTest(Order.fromJson(orderJson));
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: driverProvider,
        child: const MaterialApp(home: OrderOfferScreen()),
      ),
    );
    await pumpUntilQuiet(tester);
  }

  Future<void> pumpArrivedScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: driverProvider,
        child: const MaterialApp(home: ArrivedScreen()),
      ),
    );
    await pumpUntilQuiet(tester);
  }

  Future<void> pumpTripScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driverProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ],
        child: MaterialApp(
          home: TripScreen(sosService: SosService(apiClient: apiClient)),
        ),
      ),
    );
    await pumpUntilQuiet(tester);
    // Xarita plitkalari testda yuklanmaydi — bu xatolar oqimni buzmasin.
    tester.takeException();
  }

  group('Buyurtma taklifi — TUR aniq ko\'rinadi', () {
    testWidgets('ovqat buyurtmasi restoran sifatida ko\'rsatiladi',
        (tester) async {
      await pumpOfferScreen(tester, _orderJson(serviceType: 'food'));

      // Tur yorlig'i + ikonka: haydovchi NIMA qabul qilayotganini biladi.
      expect(find.byKey(const ValueKey('offer_service_type')), findsOneWidget);
      expect(find.text('Ovqat yetkazish'), findsWidgets);
      expect(find.byIcon(Icons.restaurant_rounded), findsWidgets);

      // Olish nuqtasi — RESTORAN, "Olish joyi" emas.
      expect(find.text('Restoran'), findsOneWidget);
      expect(find.text('Yetkazish manzili'), findsOneWidget);
      expect(find.text('Olish joyi'), findsNothing);
    });

    testWidgets('market buyurtmasi do\'kon sifatida ko\'rsatiladi',
        (tester) async {
      await pumpOfferScreen(tester, _orderJson(serviceType: 'market'));

      expect(find.text('Market yetkazish'), findsWidgets);
      expect(find.byIcon(Icons.storefront_rounded), findsWidgets);
      expect(find.text("Do'kon"), findsOneWidget);
    });

    testWidgets('yuk buyurtmasi', (tester) async {
      await pumpOfferScreen(tester, _orderJson(serviceType: 'cargo'));

      expect(find.text('Yuk tashish'), findsWidgets);
      expect(find.byIcon(Icons.local_shipping_rounded), findsWidgets);
      expect(find.text('Yukni olish joyi'), findsOneWidget);
    });

    testWidgets('serviceType kelmasa — taksi (eski realtime paketlari)',
        (tester) async {
      await pumpOfferScreen(tester, _orderJson());

      expect(find.text('Taksi'), findsWidgets);
      expect(find.byIcon(Icons.local_taxi), findsWidgets);
      expect(find.text('Olish joyi'), findsOneWidget);
      expect(find.text('Manzil'), findsOneWidget);
    });

    testWidgets("noma'lum tur ekranni yiqitmaydi", (tester) async {
      await pumpOfferScreen(tester, _orderJson(serviceType: 'pharmacy'));

      expect(tester.takeException(), isNull);
      // Zaxira — taksi matnlari; buyurtma baribir ko'rinadi.
      expect(find.text('Taksi'), findsWidgets);
      expect(find.text('Qabul qilish'), findsOneWidget);
    });
  });

  group('Yetib keldim ekrani — qadam turga moslashadi', () {
    testWidgets('ovqat: restoranda buyurtma olinadi', (tester) async {
      await seedActiveOrder(
        _orderJson(serviceType: 'food', status: 'arrived'),
      );
      await pumpArrivedScreen(tester);

      expect(find.text('Restorandasiz!'), findsOneWidget);
      expect(find.text('Buyurtmani oling'), findsOneWidget);
      expect(find.text('Yetkazishni boshlash'), findsOneWidget);
      expect(find.text('Buyurtma berilmadi'), findsOneWidget);

      // Taksi so'zlari umuman qolmasligi kerak.
      expect(find.text('Safarni boshlash'), findsNothing);
      expect(find.text("Yo'lovchi kelmadi"), findsNothing);
    });

    testWidgets('yuk: yukni olish', (tester) async {
      await seedActiveOrder(
        _orderJson(serviceType: 'cargo', status: 'arrived'),
      );
      await pumpArrivedScreen(tester);

      expect(find.text('Yukni oling'), findsOneWidget);
      expect(find.text('Yetkazishni boshlash'), findsOneWidget);
    });

    testWidgets('taksi matnlari o\'zgarmadi', (tester) async {
      await seedActiveOrder(_orderJson(status: 'arrived'));
      await pumpArrivedScreen(tester);

      expect(find.text('Olish joyida turibsiz!'), findsOneWidget);
      expect(find.text("Yo'lovchini oling"), findsOneWidget);
      expect(find.text('Safarni boshlash'), findsOneWidget);
      expect(find.text("Yo'lovchi kelmadi"), findsOneWidget);
    });
  });

  group('Safar ekrani — yetkazish so\'zlari', () {
    testWidgets('ovqat: "yetkazish", tomon esa MIJOZ', (tester) async {
      await seedActiveOrder(_orderJson(serviceType: 'food'));
      await pumpTripScreen(tester);

      expect(find.text('Buyurtma yetkazilmoqda'), findsOneWidget);
      expect(find.text('Yetkazishni yakunlash'), findsOneWidget);
      expect(find.text('Mijoz'), findsOneWidget);
      expect(find.text('Yetkazish manzili'), findsOneWidget);

      expect(find.text('Safar davom etmoqda'), findsNothing);
      expect(find.text('Safarni yakunlash'), findsNothing);
    });

    // ⚠️ Bu test ilgari TASDIQ DIALOGINI tekshirardi. Dialog ataylab olib
    // tashlandi: harakatdagi avtomobilda modal ekranni yopadi va tasodifiy
    // teginishdan himoya qilmaydi (sabab
    // shared/widgets/ag_slide_action.dart boshida). Endi yakunlash SURISH
    // bilan bajariladi, matn esa o'sha-o'sha jadvaldan keladi — test aynan
    // shuni qo'riqlaydi: xizmat turiga mos so'z + dialog QAYTIB
    // KELMAGANLIGI.
    testWidgets('ovqat: surib yakunlash ham yetkazish so\'zlarini beradi',
        (tester) async {
      await seedActiveOrder(_orderJson(serviceType: 'food'));
      when(() => apiClient.patch(ApiEndpoints.completeTrip(_orderId)))
          .thenAnswer(
        (_) async => _jsonResponse(
          ApiEndpoints.completeTrip(_orderId),
          _orderJson(serviceType: 'food', status: 'completed'),
        ),
      );
      await pumpTripScreen(tester);

      final slider = find.byType(AgSlideAction);
      expect(slider, findsOneWidget);

      // Oddiy teginish HECH NARSA qilmasligi kerak — eski dialogdan farqi
      // aynan shu.
      await tester.tap(slider);
      await pumpUntilQuiet(tester);
      expect(
        find.text('Buyurtmani mijozga topshirganingizni tasdiqlaysizmi?'),
        findsNothing,
      );
      verifyNever(() => apiClient.patch(ApiEndpoints.completeTrip(_orderId)));

      // Chegaradan (70%) uzun surish — amal bajariladi.
      await tester.drag(slider, Offset(tester.getSize(slider).width, 0));
      await pumpUntilQuiet(tester);

      verify(() => apiClient.patch(ApiEndpoints.completeTrip(_orderId)))
          .called(1);
      expect(
        find.text('Buyurtma muvaffaqiyatli yetkazildi!'),
        findsOneWidget,
      );
    });

    testWidgets('taksi matnlari o\'zgarmadi', (tester) async {
      await seedActiveOrder(_orderJson());
      await pumpTripScreen(tester);

      expect(find.text('Safar davom etmoqda'), findsOneWidget);
      expect(find.text('Safarni yakunlash'), findsOneWidget);
      expect(find.text("Yo'lovchi"), findsOneWidget);
      expect(find.text('Manzil'), findsOneWidget);
    });
  });
}
