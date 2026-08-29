// Haydovchi XIZMAT TURLARI ekrani uchun vidjet testlari.
//
// ⚠️ Asosiy maqsad — ekranda QATTIQ KODLANGAN RO'YXAT YO'QLIGINI
// qo'riqlash (tekshiruv ekranidagi naqshning aynan o'zi). Har bir test
// serverdan turlicha ro'yxat beradi va ekran aynan shu ro'yxatni server
// bergan nom/izoh bilan ko'rsatishi tekshiriladi.
//
// Qoplangan holatlar: yuklanish, tarmoq xatosi + qayta urinish, bo'sh
// ro'yxat (NORMAL holat), bloklangan turni yoqib bo'lmasligi, bo'sh
// tanlovning rad etilishi, saqlash va serverning 400 javobi.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/driver_services_screen.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );

Map<String, dynamic> _option({
  required String serviceType,
  required String label,
  String? description,
  bool enabled = false,
  bool canEnable = true,
  String? blockedReason,
  List<String> missingRequirements = const [],
}) =>
    {
      'serviceType': serviceType,
      'label': label,
      'description': description,
      'enabled': enabled,
      'canEnable': canEnable,
      'blockedReason': blockedReason,
      'missingRequirements': missingRequirements,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late LocalStorage localStorage;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: '/'));
  });

  void stubVerification({List<Map<String, dynamic>> items = const []}) {
    when(() => apiClient.get(ApiEndpoints.driverVerification)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverVerification, {
        'success': true,
        'data': {'canGoOnline': true, 'items': items},
      }),
    );
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    apiClient = MockApiClient();

    // Tekshiruv ro'yxati — `missingRequirements` kodlarining O'ZBEKCHA
    // nomlari faqat shu javobda bo'ladi. Standart holat: bo'sh.
    stubVerification();
  });

  void stubServices({
    List<String>? enabled,
    List<Map<String, dynamic>> options = const [],
  }) {
    when(() => apiClient.get(ApiEndpoints.driverServices)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverServices, {
        'success': true,
        'data': {
          'enabled': enabled ??
              [
                for (final option in options)
                  if (option['enabled'] == true) option['serviceType'] as String,
              ],
          'options': options,
        },
      }),
    );
  }

  void stubSaveSuccess(List<Map<String, dynamic>> options) {
    when(
      () => apiClient.patch(
        ApiEndpoints.driverServices,
        data: any(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverServices, {
        'success': true,
        'data': {
          'enabled': [
            for (final option in options)
              if (option['enabled'] == true) option['serviceType'] as String,
          ],
          'options': options,
        },
      }),
    );
  }

  void stubSaveRejected(String message) {
    when(
      () => apiClient.patch(
        ApiEndpoints.driverServices,
        data: any(named: 'data'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverServices),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ApiEndpoints.driverServices),
          statusCode: 400,
          data: {'success': false, 'message': message},
        ),
        type: DioExceptionType.badResponse,
      ),
    );
  }

  // Skeleton shimmer cheksiz kadr rejalashtiradi — `pumpAndSettle()` emas.
  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 15}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<DriverProvider> pumpScreen(WidgetTester tester) async {
    final provider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );

    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: provider,
        child: MaterialApp(
          home: const DriverServicesScreen(),
          routes: {
            '/driver/verification': (_) => const Scaffold(
                  body: Text('tekshiruv-ekrani'),
                ),
          },
        ),
      ),
    );
    await pumpUntilQuiet(tester);
    return provider;
  }

  testWidgets("ro'yxat faqat serverdan keladi — nom va izoh o'zgarmaydi",
      (tester) async {
    stubServices(options: [
      _option(
        serviceType: 'taxi',
        label: 'Taksi',
        description: "Yo'lovchi tashish",
        enabled: true,
      ),
      _option(
        serviceType: 'food',
        label: 'Ovqat yetkazish',
        description: 'Restorandan mijozga',
      ),
    ]);

    await pumpScreen(tester);

    // Ikkala element ham SERVER bergan nom bilan — ilovada bu kalitlar
    // uchun hech qanday tarjima jadvali yo'q.
    expect(
      tester.widget<Text>(find.byKey(const ValueKey('service_label_taxi'))).data,
      'Taksi',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('service_description_food')))
          .data,
      'Restorandan mijozga',
    );
    expect(find.byKey(const ValueKey('service_item_food')), findsOneWidget);
  });

  testWidgets("server yubormagan tur ekranda YO'Q", (tester) async {
    // Ilova `market` ni "biladi", lekin server uni taklif qilmadi —
    // demak ekranda ham bo'lmasligi kerak.
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
    ]);

    await pumpScreen(tester);

    expect(find.byKey(const ValueKey('service_item_taxi')), findsOneWidget);
    expect(find.byKey(const ValueKey('service_item_market')), findsNothing);
    expect(find.byKey(const ValueKey('service_item_food')), findsNothing);
  });

  testWidgets('bloklangan turni YOQIB BO\'LMAYDI', (tester) async {
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(
        serviceType: 'food',
        label: 'Ovqat yetkazish',
        canEnable: false,
        blockedReason: 'Termo-sumka fotosi tasdiqlanmagan',
        missingRequirements: ['thermal_bag_photo'],
      ),
    ]);

    await pumpScreen(tester);

    // Sabab serverning o'z matni bilan ko'rinadi.
    expect(find.text('Termo-sumka fotosi tasdiqlanmagan'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('service_blocked_food')),
      findsOneWidget,
    );

    final toggle = tester.widget<Switch>(
      find.byKey(const ValueKey('service_toggle_food')),
    );
    // `onChanged == null` — tugma o'chiq.
    expect(toggle.onChanged, isNull);
    expect(toggle.value, isFalse);

    // Bosishga urinish holatni o'zgartirmaydi va saqlash paneli ham
    // paydo bo'lmaydi (o'zgarish yo'q).
    await tester.tap(
      find.byKey(const ValueKey('service_toggle_food')),
      warnIfMissed: false,
    );
    await pumpUntilQuiet(tester);
    expect(
      tester
          .widget<Switch>(find.byKey(const ValueKey('service_toggle_food')))
          .value,
      isFalse,
    );
    expect(find.byKey(const ValueKey('driver_services_save')), findsNothing);
  });

  testWidgets('bloklangan turdan tekshiruv ekraniga o\'tiladi',
      (tester) async {
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(
        serviceType: 'food',
        label: 'Ovqat yetkazish',
        canEnable: false,
        blockedReason: 'Termo-sumka fotosi tasdiqlanmagan',
      ),
    ]);

    await pumpScreen(tester);

    await tester.tap(find.text('Tekshiruvni ochish'));
    await pumpUntilQuiet(tester);

    expect(find.text('tekshiruv-ekrani'), findsOneWidget);
  });

  testWidgets(
      "yetishmayotgan talab TEKSHIRUV javobidagi nom bilan ko'rsatiladi",
      (tester) async {
    // ⚠️ `thermal_bag_photo` ning o'zbekcha nomi ilovada YO'Q — u ham
    // serverdan (tekshiruv ro'yxatidan) olinadi.
    stubVerification(items: [
      {
        'code': 'thermal_bag_photo',
        'label': 'Termo-sumka surati',
        'kind': 'vehicle_photo',
        'status': 'missing',
      },
    ]);
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(
        serviceType: 'food',
        label: 'Ovqat yetkazish',
        canEnable: false,
        blockedReason: 'Termo-sumka fotosi tasdiqlanmagan',
        missingRequirements: ['thermal_bag_photo'],
      ),
    ]);

    await pumpScreen(tester);

    expect(find.text('Kerak: Termo-sumka surati'), findsOneWidget);
  });

  testWidgets("noma'lum kod umuman ko'rsatilmaydi", (tester) async {
    // Tekshiruv ro'yxatida bunday kod yo'q — xom `code` ni haydovchiga
    // ko'rsatib qo'yishdan ko'ra jim qolgan afzal.
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(
        serviceType: 'food',
        label: 'Ovqat yetkazish',
        canEnable: false,
        blockedReason: 'Talab bajarilmagan',
        missingRequirements: ['thermal_bag_photo'],
      ),
    ]);

    await pumpScreen(tester);

    expect(find.textContaining('thermal_bag_photo'), findsNothing);
    expect(find.textContaining('Kerak:'), findsNothing);
    // Sabab esa baribir ko'rinadi.
    expect(find.text('Talab bajarilmagan'), findsOneWidget);
  });

  testWidgets("BO'SH TANLOV saqlanmaydi — so'rov ham yuborilmaydi",
      (tester) async {
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
    ]);

    await pumpScreen(tester);

    // Yagona yoqilgan turni o'chirish.
    await tester.tap(find.byKey(const ValueKey('service_toggle_taxi')));
    await pumpUntilQuiet(tester);

    await tester.tap(find.byKey(const ValueKey('driver_services_save')));
    await pumpUntilQuiet(tester);

    expect(
      find.byKey(const ValueKey('driver_services_save_error')),
      findsOneWidget,
    );
    expect(find.text(kDriverServicesEmptySelectionError), findsOneWidget);
    verifyNever(
      () => apiClient.patch(
        ApiEndpoints.driverServices,
        data: any(named: 'data'),
      ),
    );
  });

  testWidgets('tanlov PATCH bilan saqlanadi', (tester) async {
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(serviceType: 'food', label: 'Ovqat yetkazish'),
    ]);
    stubSaveSuccess([
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(serviceType: 'food', label: 'Ovqat yetkazish', enabled: true),
    ]);

    await pumpScreen(tester);

    // O'zgarish bo'lmaguncha saqlash paneli ko'rinmaydi.
    expect(find.byKey(const ValueKey('driver_services_save')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('service_toggle_food')));
    await pumpUntilQuiet(tester);
    expect(find.byKey(const ValueKey('driver_services_save')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('driver_services_save')));
    await pumpUntilQuiet(tester);

    final captured = verify(
      () => apiClient.patch(
        ApiEndpoints.driverServices,
        data: captureAny(named: 'data'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(captured['serviceTypes'], ['taxi', 'food']);

    // Saqlangandan keyin panel yana yashiriladi (o'zgarish qolmadi).
    expect(find.byKey(const ValueKey('driver_services_save')), findsNothing);
    expect(find.text('Xizmat turlari saqlandi'), findsOneWidget);
  });

  testWidgets("server 400 javobi tushunarli ko'rsatiladi", (tester) async {
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(serviceType: 'food', label: 'Ovqat yetkazish'),
    ]);
    stubSaveRejected(
      "Ovqat yetkazish uchun termo-sumka fotosi tasdiqlanmagan",
    );

    await pumpScreen(tester);

    await tester.tap(find.byKey(const ValueKey('service_toggle_food')));
    await pumpUntilQuiet(tester);
    await tester.tap(find.byKey(const ValueKey('driver_services_save')));
    await pumpUntilQuiet(tester);

    expect(
      find.byKey(const ValueKey('driver_services_save_error')),
      findsOneWidget,
    );
    expect(
      find.text("Ovqat yetkazish uchun termo-sumka fotosi tasdiqlanmagan"),
      findsOneWidget,
    );
    // Tanlov yo'qolmaydi — haydovchi qaytadan bosishi shart emas.
    expect(
      tester
          .widget<Switch>(find.byKey(const ValueKey('service_toggle_food')))
          .value,
      isTrue,
    );
  });

  testWidgets("bo'sh ro'yxat XATO deb ko'rsatilmaydi", (tester) async {
    stubServices(options: const []);

    await pumpScreen(tester);

    expect(
      find.byKey(const ValueKey('driver_services_empty')),
      findsOneWidget,
    );
    expect(find.byType(AppEmptyState), findsOneWidget);
    expect(find.byType(AppErrorState), findsNothing);
    expect(find.text('Qayta urinish'), findsNothing);
  });

  testWidgets("tarmoq xatosi qayta urinish bilan ko'rsatiladi",
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.driverServices)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverServices),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ApiEndpoints.driverServices),
          statusCode: 500,
          data: {'success': false, 'message': 'Server javob bermadi'},
        ),
        type: DioExceptionType.badResponse,
      ),
    );

    await pumpScreen(tester);

    expect(find.byType(AppErrorState), findsOneWidget);
    expect(find.text('Server javob bermadi'), findsOneWidget);

    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
    ]);
    await tester.tap(find.text('Qayta urinish'));
    await pumpUntilQuiet(tester);

    expect(find.byType(AppErrorState), findsNothing);
    expect(find.byKey(const ValueKey('service_item_taxi')), findsOneWidget);
  });

  testWidgets('birinchi yuklashda skeleton ko\'rsatiladi', (tester) async {
    // So'rov osilib turgan holat — spinner emas, skeleton.
    when(() => apiClient.get(ApiEndpoints.driverServices)).thenAnswer(
      (_) => Future<Response<dynamic>>.delayed(
        const Duration(seconds: 5),
        () => _jsonResponse(ApiEndpoints.driverServices, {
          'success': true,
          'data': {'enabled': <String>[], 'options': <dynamic>[]},
        }),
      ),
    );

    final provider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: provider,
        child: const MaterialApp(home: DriverServicesScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.byType(AppSkeletonGroup), findsOneWidget);

    // Osilib qolgan taymerni yakunlash.
    await tester.pump(const Duration(seconds: 6));
    await pumpUntilQuiet(tester);
  });

  testWidgets(
      "yoqilgan turni O'CHIRISH bloklangan bo'lsa ham mumkin",
      (tester) async {
    // Hujjat muddati smena o'rtasida tugab qolgan holat: turni yoqib
    // bo'lmaydi, lekin o'chirib qo'yish YO'LI OCHIQ qolishi shart —
    // aks holda haydovchi bajarolmaydigan buyurtmalarni olishda davom
    // etardi va uni to'xtata olmasdi.
    stubServices(options: [
      _option(serviceType: 'taxi', label: 'Taksi', enabled: true),
      _option(
        serviceType: 'food',
        label: 'Ovqat yetkazish',
        enabled: true,
        canEnable: false,
        blockedReason: "Termo-sumka fotosi muddati o'tgan",
      ),
    ]);

    await pumpScreen(tester);

    final toggle = tester.widget<Switch>(
      find.byKey(const ValueKey('service_toggle_food')),
    );
    expect(toggle.value, isTrue);
    expect(toggle.onChanged, isNotNull);

    await tester.tap(find.byKey(const ValueKey('service_toggle_food')));
    await pumpUntilQuiet(tester);

    expect(
      tester
          .widget<Switch>(find.byKey(const ValueKey('service_toggle_food')))
          .value,
      isFalse,
    );
  });
}
