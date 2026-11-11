// Huquqiy darvoza (VMQ 200) bosh ekranda: blok banneri va onlayn chiqish
// rad etilganda sabablar ro'yxati — docs/LEGAL-COMPLIANCE.md §1.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/legal/driver_legal_provider.dart';
import 'package:angren_taxi/features/driver/readiness/driver_readiness.dart';
import 'package:angren_taxi/features/driver/readiness/readiness_checker.dart';
import 'package:angren_taxi/features/driver/screens/home_screen.dart';
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
  /// Oxirgi so'ralgan oqimning fon xizmati sozlamasi — onlayn haydovchi
  /// oqimi FOREGROUND SERVICE bilan ochilishini tekshirish uchun.
  BackgroundNotice? lastBackground;
  int streams = 0;

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
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    BackgroundNotice? background,
  }) {
    streams++;
    lastBackground = background;
    return const Stream<Position>.empty();
  }
}

/// Plaginlarsiz tayyorlik tekshiruvchisi.
class _FakeReadiness implements ReadinessChecker {
  _FakeReadiness(Set<ReadinessItem> ok) : ok = {...ok};

  final Set<ReadinessItem> ok;
  final fixed = <ReadinessItem>[];

  @override
  Future<DriverReadiness> check() async =>
      DriverReadiness({for (final i in ReadinessItem.values) i: ok.contains(i)});

  @override
  Future<void> fix(ReadinessItem item) async {
    fixed.add(item);
    ok.add(item);
  }
}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );


const _legalRejection =
    "Taksi uchun onlayn chiqa olmaysiz: JShShIR (PINFL) kiritilmagan; "
    "Tibbiy ko'rik hujjati yo'q. Ilovadagi «Hujjatlar» bo'limida to'ldiring.";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient api;
  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorage(await SharedPreferences.getInstance());
    api = MockApiClient();
    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());

    when(() => api.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'user': {'phone': '+998901112233', 'status': 'active'},
        },
      }),
    );
    when(() => api.get(ApiEndpoints.driverOrderHistory)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverOrderHistory, {
        'success': true,
        'data': {'orders': <dynamic>[]},
      }),
    );
    when(() => api.get(ApiEndpoints.driverVerification)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverVerification, {
        'success': true,
        'data': {'canGoOnline': true, 'items': <dynamic>[]},
      }),
    );
  });

  tearDown(() async => sl.reset());

  void stubLegal({required bool enforced, required bool blocking}) {
    when(() => api.get(ApiEndpoints.driverLegal)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverLegal, {
        'success': true,
        'data': {
          'profile': {'citizenship': 'UZ'},
          'eligibility': {
            'eligible': false,
            'enforced': enforced,
            'enforcedFrom': '2026-09-01T00:00:00.000Z',
            'appliesToTaxi': true,
            'blocking': blocking,
            'reasons': [
              {'code': 'pinfl_missing', 'message': 'JShShIR (PINFL) kiritilmagan'},
              {
                'code': 'document_medical_check',
                'message': "Tibbiy ko'rik hujjati yo'q",
              },
            ],
          },
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
    final driver = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: _FakeLocationService(),
      localStorage: storage,
    );
    final auth = AuthProvider(
      apiClient: api,
      localStorage: storage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driver),
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
          ChangeNotifierProvider<DriverLegalProvider>(
            create: (_) => DriverLegalProvider(apiClient: api),
          ),
        ],
        child: MaterialApp(
          home: DriverHomeScreen(
            readinessChecker: _FakeReadiness(ReadinessItem.values.toSet()),
          ),
          routes: {
            '/driver/legal': (_) =>
                const Scaffold(body: Text('huquqiy-profil-ekrani')),
          },
        ),
      ),
    );
    await pumpUntilQuiet(tester);
  }

  testWidgets('majburlangan va bloklangan — banner va CTA', (tester) async {
    stubLegal(enforced: true, blocking: true);
    await pumpHome(tester);

    expect(find.byKey(const ValueKey('driver_legal_blocked')), findsOneWidget);
    expect(find.text('Taksi uchun onlayn chiqa olmaysiz'), findsOneWidget);
    expect(find.text('Huquqiy talablar bajarilmagan: 2 ta'), findsOneWidget);

    await tester.tap(find.text("To'ldirish"));
    await pumpUntilQuiet(tester);
    expect(find.text('huquqiy-profil-ekrani'), findsOneWidget);
  });

  testWidgets("majburlanmagan (ogohlantirish) — banner yo'q", (tester) async {
    stubLegal(enforced: false, blocking: false);
    await pumpHome(tester);
    expect(find.byKey(const ValueKey('driver_legal_blocked')), findsNothing);
  });

  testWidgets("onlayn chiqish 400 (huquqiy) — sabablar ro'yxati, umumiy xato emas",
      (tester) async {
    stubLegal(enforced: true, blocking: false);
    when(() => api.patch(ApiEndpoints.driverStatus, data: any(named: 'data')))
        .thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverStatus),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.driverStatus),
          statusCode: 400,
          data: {'success': false, 'message': _legalRejection},
        ),
      ),
    );
    await pumpHome(tester);

    await tester.tap(find.byKey(const ValueKey('driver_online_toggle')));
    await pumpUntilQuiet(tester);

    expect(find.byKey(const ValueKey('legal_block_sheet')), findsOneWidget);
    expect(find.text("Onlayn chiqib bo'lmadi"), findsOneWidget);
    expect(find.text('JShShIR (PINFL) kiritilmagan'), findsOneWidget);
    expect(find.text("Tibbiy ko'rik hujjati yo'q"), findsOneWidget);
    // Uzun server matni snackbar sifatida CHIQMAYDI.
    expect(find.text(_legalRejection), findsNothing);

    await tester.tap(find.byKey(const ValueKey('legal_block_open_profile')));
    await pumpUntilQuiet(tester);
    expect(find.text('huquqiy-profil-ekrani'), findsOneWidget);
  });

  testWidgets("v4: LEGAL_NOT_ELIGIBLE kodi — sabablar xatodagi reasons[] dan",
      (tester) async {
    stubLegal(enforced: true, blocking: false);
    when(() => api.patch(ApiEndpoints.driverStatus, data: any(named: 'data')))
        .thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverStatus),
        response: Response(
          requestOptions: RequestOptions(path: ApiEndpoints.driverStatus),
          statusCode: 400,
          data: {
            'success': false,
            // Ruscha matn — prefiks zaxirasi buni tanimasdi.
            'message': 'Вы не можете выйти на линию такси',
            'code': 'LEGAL_NOT_ELIGIBLE',
            'reasons': [
              {'code': 'pinfl_missing', 'message': 'ПИНФЛ не указан'},
            ],
          },
        ),
      ),
    );
    await pumpHome(tester);

    await tester.tap(find.byKey(const ValueKey('driver_online_toggle')));
    await pumpUntilQuiet(tester);

    expect(find.byKey(const ValueKey('legal_block_sheet')), findsOneWidget);
    expect(find.text('ПИНФЛ не указан'), findsOneWidget);
    // Profildagi (eskirgan bo'lishi mumkin) ro'yxat emas — xatodagisi.
    expect(find.text('JShShIR (PINFL) kiritilmagan'), findsNothing);
  });
}
