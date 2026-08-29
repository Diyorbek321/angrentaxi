// Haydovchi bosh ekrani va "Yetib keldim" ekranining O'LCHAM va TARTIB
// qo'riqchisi.
//
// ⚠️ NEGA BU TESTLAR BOR. Haydovchi ekrani HARAKATDAGI avtomobildan
// ishlatiladi — bu yerdagi tartib xatosi bezak masalasi emas, XAVFSIZLIK
// masalasi. Uchta narsa regressiyaga eng moyil:
//
//   1. Sheet TOSHIB ketishi. Bosh ekran sheeti aylanmaydi
//      (`AdaptiveMapPanel` telefon rejimida skroll bermaydi), shuning
//      uchun hero + chiplar + talab kartasi + CTA eng kichik amaldagi
//      telefonga (320x568) ham sig'ishi SHART. Bitta blok qo'shilishi
//      bilan CTA ekran ostiga tushib ketadi va haydovchi smenani umuman
//      boshlay olmaydi.
//   2. Asosiy amal balandligi. `kControlHeight` (54, YO'LOVCHI o'lchami)
//      bu ekranlarda yetarli emas — `kControlHeightDriver` (64) kerak.
//   3. "Safarni boshlash" va "Yo'lovchi kelmadi" YONMA-YON qolishi.
//      Ularning natijalari qarama-qarshi; tebranayotgan mashinada
//      yonma-yon tugmalar noto'g'ri bosiladi va buyurtma bekor bo'ladi.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/arrived_screen.dart';
import 'package:angren_taxi/features/driver/screens/home_screen.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Haqiqiy geolocator platforma kanali `flutter test` da mavjud emas.
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

const String _orderId = 'order-1';

Response<dynamic> _res(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient api;
  late LocalStorage localStorage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    localStorage = LocalStorage(await SharedPreferences.getInstance());
    api = MockApiClient();
    // Haptika platforma kanaliga chiqadi — testda keraksiz shovqin.
    AppHaptics.enabled = false;

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());

    when(() => api.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01 A 123 BC',
          'user': {'phone': '+998901112233', 'status': 'active'},
        },
      }),
    );
    when(() => api.get(ApiEndpoints.driverOrderHistory)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverOrderHistory, {
        'success': true,
        'data': {'orders': <dynamic>[]},
      }),
    );
    when(() => api.get(ApiEndpoints.driverEarnings)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverEarnings, {
        'success': true,
        'data': {'today': 1284000},
      }),
    );
    when(() => api.get(ApiEndpoints.driverEarningsBreakdown)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverEarningsBreakdown, {
        'success': true,
        'data': {
          'today': {
            'gross': 1400000,
            'commission': 116000,
            'net': 1284000,
            'trips': 12,
          },
          'week': {
            'gross': 4800000,
            'commission': 400000,
            'net': 4400000,
            'trips': 48,
          },
          'month': {'gross': 0, 'commission': 0, 'net': 0, 'trips': 0},
        },
      }),
    );
    when(() => api.get(ApiEndpoints.driverBonusProgress)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverBonusProgress, {
        'success': true,
        'data': [
          {
            'ruleId': 'rule-1',
            'name': 'Haftalik maqsad',
            'ruleType': 'weekly_goal',
            'tripThreshold': 40,
            'bonusAmount': 150000,
            'currentCount': 32,
          },
        ],
      }),
    );
    when(() => api.get(ApiEndpoints.driverServices)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverServices, {
        'success': true,
        'data': {
          'enabled': ['taxi', 'cargo'],
          'options': [
            {
              'serviceType': 'taxi',
              'label': 'Taksi',
              'enabled': true,
              'canEnable': true,
            },
            {
              'serviceType': 'cargo',
              'label': 'Yuk',
              'enabled': true,
              'canEnable': true,
            },
            {
              'serviceType': 'food',
              'label': 'Ovqat',
              'enabled': false,
              'canEnable': false,
              'blockedReason': 'Termosumka rasmi kerak',
              'missingRequirements': ['thermo_bag'],
            },
            // Server yuborgan NOMA'LUM tur — ikonkasiz chiqishi va
            // ekranni yiqitmasligi kerak.
            {
              'serviceType': 'pharmacy',
              'label': 'Dorixona',
              'enabled': false,
              'canEnable': true,
            },
          ],
        },
      }),
    );
  });

  tearDown(() async {
    AppHaptics.enabled = true;
    await sl.reset();
  });

  void stubVerification({
    bool canGoOnline = true,
    List<Map<String, dynamic>> items = const [],
  }) {
    when(() => api.get(ApiEndpoints.driverVerification)).thenAnswer(
      (_) async => _res(ApiEndpoints.driverVerification, {
        'success': true,
        'data': {
          'canGoOnline': canGoOnline,
          'blockedReason':
              canGoOnline ? null : "Haydovchilik guvohnomasi muddati o'tgan",
          'items': items,
        },
      }),
    );
  }

  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 30}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<DriverProvider> pumpHome(WidgetTester tester, Size size) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final driverProvider = DriverProvider(
      apiClient: api,
      socketService: SocketService(),
      locationService: _FakeLocationService(),
      localStorage: localStorage,
    );
    final authProvider = AuthProvider(
      apiClient: api,
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
        child: const MaterialApp(home: DriverHomeScreen()),
      ),
    );
    await pumpUntilQuiet(tester);
    return driverProvider;
  }

  // ------------------------------------------------------------------
  // 1. SHEET TOSHMAYDI.
  //
  // Ekran o'lchamlari: eng kichik amaldagi telefon, keng tarqalgan
  // Android, zamonaviy telefon va 720dp dan keng ekran (u yerda
  // `AdaptiveMapPanel` yon panelga o'tadi — butunlay boshqa tartib).
  // ------------------------------------------------------------------
  const sizes = <Size>[
    Size(320, 568),
    Size(360, 640),
    Size(412, 892),
    Size(800, 1280),
  ];

  for (final size in sizes) {
    testWidgets(
        "to'liq ma'lumot bilan sheet toshmaydi — "
        '${size.width.toInt()}x${size.height.toInt()}', (tester) async {
      stubVerification();
      await pumpHome(tester, size);

      // Toshish `FlutterError` bo'lib chiqadi — uni shu yerda ushlaymiz.
      expect(tester.takeException(), isNull);

      // Hero va uning uchala qatlami joyida.
      expect(find.text('Bugungi daromad'), findsOneWidget);
      expect(find.textContaining('284'), findsWidgets);
      expect(find.text('12 ta safar'), findsOneWidget);
      // Bonus FOIZ emas, NISBAT bilan.
      expect(find.text('32/40'), findsOneWidget);
      expect(find.textContaining('%'), findsNothing);
      // Xizmat chiplari — server bergan yorliqlar bilan.
      expect(find.text('Taksi'), findsOneWidget);
      expect(find.text('Dorixona'), findsOneWidget);
    });

    testWidgets(
        'bloklangan holatda sheet toshmaydi — '
        '${size.width.toInt()}x${size.height.toInt()}', (tester) async {
      stubVerification(
        canGoOnline: false,
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
      await pumpHome(tester, size);

      expect(tester.takeException(), isNull);
      expect(
        find.byKey(const ValueKey('driver_verification_blocked')),
        findsOneWidget,
      );
      // Bloklangan haydovchining yagona vazifasi — hujjatni tuzatish.
      // Bonus ham, chiplar ham hozir hech narsani hal qilmaydi.
      expect(find.text('32/40'), findsNothing);
      expect(find.text('Taksi'), findsNothing);
    });
  }

  // ------------------------------------------------------------------
  // 2. ASOSIY AMAL — HAYDOVCHI O'LCHAMI.
  // ------------------------------------------------------------------
  testWidgets('onlayn tugmasi kControlHeightDriver (64dp) balandlikda',
      (tester) async {
    stubVerification();
    await pumpHome(tester, const Size(360, 640));

    final toggle = find.descendant(
      of: find.byKey(const ValueKey('driver_online_toggle')),
      matching: find.byType(AnimatedContainer),
    );
    expect(tester.getSize(toggle.first).height, kControlHeightDriver);
  });

  // Xarita ustidagi doira tugmalar ham HAYDOVCHI nishoni: `AgMapFab`
  // ning o'zi 48dp (yo'lovchi o'lchami), shuning uchun bosh ekran uni
  // 56dp li qutiga o'raydi. O'ram olib tashlansa test yiqiladi.
  testWidgets('xarita tugmalarining tegish maydoni kamida 56dp',
      (tester) async {
    stubVerification();
    await pumpHome(tester, const Size(360, 640));

    final fabs = find.byType(AgMapFab);
    expect(fabs, findsNWidgets(2));
    for (var i = 0; i < fabs.evaluate().length; i++) {
      final size = tester.getSize(fabs.at(i));
      expect(size.width, greaterThanOrEqualTo(kMinTapTargetDriver));
      expect(size.height, greaterThanOrEqualTo(kMinTapTargetDriver));
    }
  });

  // ------------------------------------------------------------------
  // 3. "YETIB KELDIM" — IKKI TUGMA HECH QACHON YONMA-YON EMAS.
  // ------------------------------------------------------------------
  group('Yetib keldim — amallar ergonomikasi', () {
    Future<void> pumpArrived(WidgetTester tester) async {
      final driverProvider = DriverProvider(
        apiClient: api,
        socketService: SocketService(),
        locationService: _FakeLocationService(),
        localStorage: localStorage,
      );
      when(() => api.patch(ApiEndpoints.acceptOrder(_orderId))).thenAnswer(
        (_) async => _res(ApiEndpoints.acceptOrder(_orderId), {
          'success': true,
          'data': {
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
            'status': 'arrived',
            'serviceType': 'taxi',
            'estimatedPrice': 42000.0,
            'createdAt': '2026-07-13T10:00:00.000Z',
          },
        }),
      );
      await driverProvider.acceptOrder(_orderId);

      await tester.pumpWidget(
        ChangeNotifierProvider<DriverProvider>.value(
          value: driverProvider,
          child: const MaterialApp(home: ArrivedScreen()),
        ),
      );
      await pumpUntilQuiet(tester, times: 10);
    }

    testWidgets(
        "'Safarni boshlash' 64dp, 'Yo'lovchi kelmadi' esa PASTDA va 56dp",
        (tester) async {
      await pumpArrived(tester);

      final start = find.byType(ElevatedButton);
      final noShow = find.byType(OutlinedButton);
      expect(start, findsOneWidget);
      expect(noShow, findsOneWidget);

      final startRect = tester.getRect(start);
      final noShowRect = tester.getRect(noShow);

      // Asosiy amal — haydovchi boshqaruv balandligi.
      expect(startRect.height, kControlHeightDriver);
      // Ikkilamchi — haydovchi minimal nishoni, lekin asosiydan PAST.
      expect(noShowRect.height, kMinTapTargetDriver);
      expect(noShowRect.height, lessThan(startRect.height));

      // ⚠️ ENG MUHIM TEKSHIRUV: buzg'unchi amal asosiy amalning
      // OSTIDA turadi, yonida emas, va oraliq kamida 12dp.
      expect(noShowRect.top, greaterThanOrEqualTo(startRect.bottom + kSpace3));
    });

    // Tasdiq dialogi ikkinchi to'siq — lekin `AlertDialog` standart
    // holatda tugmalarni GORIZONTAL tizadi va orasida atigi 8dp
    // qoldiradi. Buyurtmani bekor qiladigan tanlov uchun bu yetarli
    // emas: qoida ekranda ham, dialogda ham bir xil.
    testWidgets('bekor qilish dialogida tanlovlar yonma-yon EMAS',
        (tester) async {
      await pumpArrived(tester);

      // Ekran past bo'lsa amallar blokiga skroll qilinadi ("Yetib keldim"
      // sahifasi aylanadi) — avval tugmani ko'rinishga chiqaramiz.
      await tester.ensureVisible(find.byType(OutlinedButton));
      await pumpUntilQuiet(tester, times: 10);

      await tester.tap(find.byType(OutlinedButton));
      await pumpUntilQuiet(tester, times: 10);

      final keep = find.byKey(const ValueKey('no_show_keep_waiting'));
      final cancel = find.byKey(const ValueKey('no_show_confirm_cancel'));
      expect(keep, findsOneWidget);
      expect(cancel, findsOneWidget);

      final keepRect = tester.getRect(keep);
      final cancelRect = tester.getRect(cancel);

      // Ikkalasi ham haydovchi nishoni.
      expect(keepRect.height, greaterThanOrEqualTo(kMinTapTargetDriver));
      expect(cancelRect.height, greaterThanOrEqualTo(kMinTapTargetDriver));

      // Buzg'unchi tanlov PASTDA va kamida 12dp uzoqda.
      expect(cancelRect.top, greaterThanOrEqualTo(keepRect.bottom + kSpace3));
    });
  });
}
