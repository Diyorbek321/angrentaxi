// Haydovchi bosh ekranidagi tekshiruv "darvozasi" uchun testlar.
//
// Qoplangan xatti-harakat:
//   · `canGoOnline == false` → onlayn tugmasi O'CHIQ, sabab ko'rinadi va
//     tekshiruv ekraniga o'tish tugmasi bor;
//   · `due_soon` element → OGOHLANTIRISH banneri, lekin tugma ochiq
//     (bloklamaydi);
//   · hammasi joyida → hech qanday banner yo'q, tugma ochiq.
//
// Xarita (`AppVectorMap`) uslub hujjatini asinxron o'qigunicha oddiy
// `ColoredBox` chizadi, shuning uchun bu testlarda native xarita ishga
// tushmaydi. `LocationService` esa DI orqali soxta bilan almashtiriladi —
// haqiqiy geolocator kanali `flutter test` da mavjud emas.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/home_screen.dart';
import 'package:angren_taxi/features/driver/screens/verification_screen.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Haqiqiy geolocator platforma kanalisiz qat'iy fiks beradi.
class _FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 41.0167,
        longitude: 70.1436,
        timestamp: DateTime(2026, 8, 19, 10),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );

  @override
  Stream<Position> getPositionStream({int distanceFilter = 10}) =>
      const Stream<Position>.empty();
}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient mockApiClient;
  late LocalStorage localStorage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    mockApiClient = MockApiClient();

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());

    when(() => mockApiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01 A 123 BC',
          'user': {'phone': '+998901112233', 'status': 'active'},
        },
      }),
    );

    // Faol buyurtma yo'q — bosh ekran onlayn toggle blokini ko'rsatadi.
    when(() => mockApiClient.get(ApiEndpoints.driverOrderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverOrderHistory, {
        'success': true,
        'data': {'orders': <dynamic>[]},
      }),
    );
  });

  tearDown(() async {
    await sl.reset();
  });

  void stubVerification({
    bool canGoOnline = true,
    String? blockedReason,
    List<Map<String, dynamic>> items = const [],
  }) {
    when(() => mockApiClient.get(ApiEndpoints.driverVerification)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverVerification, {
        'success': true,
        'data': {
          'canGoOnline': canGoOnline,
          'blockedReason': blockedReason,
          'items': items,
        },
      }),
    );
  }

  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 20}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> pumpHome(WidgetTester tester) async {
    final driverProvider = DriverProvider(
      apiClient: mockApiClient,
      socketService: SocketService(),
      locationService: _FakeLocationService(),
      localStorage: localStorage,
    );
    final authProvider = AuthProvider(
      apiClient: mockApiClient,
      localStorage: localStorage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driverProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ],
        child: MaterialApp(
          home: const DriverHomeScreen(),
          routes: {
            '/driver/verification': (_) => const DriverVerificationScreen(),
            '/driver/services': (_) => const Scaffold(
                  body: Text('xizmat-turlari-ekrani'),
                ),
          },
        ),
      ),
    );
    await pumpUntilQuiet(tester);
  }

  AppPressable onlineToggle(WidgetTester tester) =>
      tester.widget<AppPressable>(
        find.byKey(const ValueKey('driver_online_toggle')),
      );

  testWidgets('bloklangan holatda onlayn tugmasi o\'chiq bo\'ladi',
      (tester) async {
    stubVerification(
      canGoOnline: false,
      blockedReason: "Haydovchilik guvohnomasi muddati o'tgan",
      items: [
        {
          'code': 'driver_license',
          'label': 'Haydovchilik guvohnomasi',
          'kind': 'document',
          'status': 'overdue',
          'daysLeft': -3,
          'isRequired': true,
        },
      ],
    );

    await pumpHome(tester);

    // Tugma bor, lekin bosilmaydi.
    expect(find.byKey(const ValueKey('driver_online_toggle')), findsOneWidget);
    expect(onlineToggle(tester).onTap, isNull);

    // Sabab serverdan kelgan matn bilan ko'rsatiladi.
    expect(
      find.byKey(const ValueKey('driver_verification_blocked')),
      findsOneWidget,
    );
    expect(find.text("Haydovchilik guvohnomasi muddati o'tgan"), findsOneWidget);
    expect(find.text('Tekshiruvni ochish'), findsOneWidget);
  });

  testWidgets('blok bannerdagi tugma tekshiruv ekraniga o\'tadi',
      (tester) async {
    stubVerification(
      canGoOnline: false,
      blockedReason: 'Avtomobil surati yuklanmagan',
      items: [
        {
          'code': 'vehicle_photo_front',
          'label': 'Avtomobil old tomondan',
          'kind': 'vehicle_photo',
          'status': 'missing',
          'isRequired': true,
        },
      ],
    );

    await pumpHome(tester);

    await tester.tap(find.text('Tekshiruvni ochish'));
    await pumpUntilQuiet(tester);

    expect(find.byType(DriverVerificationScreen), findsOneWidget);
  });

  testWidgets('due_soon faqat ogohlantiradi — tugma ochiq qoladi',
      (tester) async {
    stubVerification(
      canGoOnline: true,
      items: [
        {
          'code': 'insurance',
          'label': "Sug'urta polisi",
          'kind': 'document',
          'status': 'due_soon',
          'daysLeft': 6,
          'isRequired': true,
        },
      ],
    );

    await pumpHome(tester);

    expect(
      find.byKey(const ValueKey('driver_verification_due_soon')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('driver_verification_blocked')),
      findsNothing,
    );
    // Ogohlantirish ishni TO'XTATMAYDI.
    expect(onlineToggle(tester).onTap, isNotNull);
  });

  testWidgets('hammasi joyida bo\'lsa banner umuman chiqmaydi',
      (tester) async {
    stubVerification(
      canGoOnline: true,
      items: [
        {
          'code': 'passport',
          'label': 'Pasport',
          'kind': 'document',
          'status': 'ok',
          'isRequired': true,
        },
      ],
    );

    await pumpHome(tester);

    expect(
      find.byKey(const ValueKey('driver_verification_blocked')),
      findsNothing,
    );
    expect(
      find.byKey(const ValueKey('driver_verification_due_soon')),
      findsNothing,
    );
    expect(onlineToggle(tester).onTap, isNotNull);
  });

  testWidgets('tekshiruv so\'rovi yiqilsa haydovchi bloklanmaydi',
      (tester) async {
    // Eski backend yoki tarmoq uzilishi haydovchini ishdan to'xtatmasligi
    // kerak — cheklovni server baribir o'zi qo'llaydi.
    when(() => mockApiClient.get(ApiEndpoints.driverVerification)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverVerification),
        type: DioExceptionType.connectionError,
      ),
    );

    await pumpHome(tester);

    expect(onlineToggle(tester).onTap, isNotNull);
    expect(
      find.byKey(const ValueKey('driver_verification_blocked')),
      findsNothing,
    );
  });

  testWidgets("menyuda XIZMAT TURLARI ga kirish nuqtasi bor",
      (tester) async {
    // Haydovchi o'z vertikallarini tanlay olmasa, ovqat va market
    // buyurtmalari unga umuman kelmaydi — kirish nuqtasi yashirin
    // qolmasligi kerak.
    stubVerification();

    await pumpHome(tester);

    await tester.tap(find.byIcon(Icons.menu));
    await pumpUntilQuiet(tester);

    expect(
      find.byKey(const ValueKey('driver_menu_services')),
      findsOneWidget,
    );
    expect(find.text('Xizmat turlari'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('driver_menu_services')));
    await pumpUntilQuiet(tester);

    expect(find.text('xizmat-turlari-ekrani'), findsOneWidget);
  });
}
