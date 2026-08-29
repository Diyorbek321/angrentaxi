// Haydovchi tekshiruv ekrani uchun vidjet testlari.
//
// ⚠️ Bu testlarning asosiy maqsadi — ekranda QATTIQ KODLANGAN RO'YXAT
// YO'QLIGINI qo'riqlash. Har bir test serverdan turlicha ro'yxat beradi va
// ekran aynan shu ro'yxatni (server bergan nom/izoh bilan) ko'rsatishi
// tekshiriladi.
//
// Qoplangan holatlar: bo'sh ro'yxat (bu NORMAL, xato emas), tarmoq xatosi +
// qayta urinish, muddat matni, rad etish sababi, noma'lum status va
// surat yuklash oqimi.
//
// image_picker `ImagePickerPlatform.instance` orqali soxtalashtiriladi
// (paket rasman shuni tavsiya qiladi), ApiClient esa mocktail bilan —
// hech qanday haqiqiy kamera/tarmoq ishlatilmaydi. `MultipartFile.fromFile`
// diskdan haqiqiy fayl o'qiydi, shuning uchun u `tester.runAsync` ichida
// haydaladi (test zonasi soxta-async).
import 'dart:io';

import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/verification_screen.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:mocktail/mocktail.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

class _FakeImagePickerPlatform extends Fake
    with MockPlatformInterfaceMixin
    implements ImagePickerPlatform {
  _FakeImagePickerPlatform(this.filePath);

  final String filePath;

  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async =>
      XFile(filePath);
}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );

Map<String, dynamic> _item({
  required String code,
  required String label,
  String? hint,
  String kind = 'document',
  String status = 'ok',
  String? validUntil,
  num? daysLeft,
  String? rejectionReason,
  bool isRequired = true,
}) =>
    {
      'code': code,
      'label': label,
      'hint': hint,
      'kind': kind,
      'status': status,
      'validUntil': validUntil,
      'daysLeft': daysLeft,
      'rejectionReason': rejectionReason,
      'isRequired': isRequired,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient mockApiClient;
  late LocalStorage localStorage;
  late String tempFilePath;
  late ImagePickerPlatform originalImagePickerPlatform;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: '/'));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    mockApiClient = MockApiClient();

    // `MultipartFile.fromFile` diskda haqiqiy fayl kutadi.
    final tempFile = await File(
      '${Directory.systemTemp.path}/driver_verification_test_'
      '${DateTime.now().microsecondsSinceEpoch}.jpg',
    ).create();
    await tempFile.writeAsBytes([0xFF, 0xD8, 0xFF, 0xD9]);
    tempFilePath = tempFile.path;

    originalImagePickerPlatform = ImagePickerPlatform.instance;
    ImagePickerPlatform.instance = _FakeImagePickerPlatform(tempFilePath);
  });

  tearDown(() {
    ImagePickerPlatform.instance = originalImagePickerPlatform;
    final file = File(tempFilePath);
    if (file.existsSync()) file.deleteSync();
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

  // `AdaptiveProgress`/skeleton shimmer cheksiz kadr rejalashtiradi, shuning
  // uchun `pumpAndSettle()` emas — belgilangan sondagi qisqa `pump`.
  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 15}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<DriverProvider> pumpScreen(WidgetTester tester) async {
    final driverProvider = DriverProvider(
      apiClient: mockApiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );

    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: driverProvider,
        child: const MaterialApp(home: DriverVerificationScreen()),
      ),
    );
    await pumpUntilQuiet(tester);
    return driverProvider;
  }

  Future<void> pickGalleryPhotoFor(WidgetTester tester, String code) async {
    await tester.tap(find.byKey(ValueKey('verification_upload_$code')));
    await pumpUntilQuiet(tester);

    expect(find.text('Galereya'), findsOneWidget);
    await tester.tap(find.text('Galereya'));

    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await pumpUntilQuiet(tester);
  }

  testWidgets("ro'yxat faqat serverdan keladi — nom va izoh o'zgarmaydi",
      (tester) async {
    stubVerification(items: [
      _item(
        code: 'vehicle_photo_front',
        label: 'Avtomobil old tomondan',
        hint: "Davlat raqami ko'rinsin",
        kind: 'vehicle_photo',
        status: 'missing',
      ),
      _item(
        code: 'taxi_permit_2027',
        label: 'Taksi litsenziyasi (2027)',
        status: 'pending_review',
      ),
    ]);

    await pumpScreen(tester);

    // Ikkala element ham server bergan nom bilan chiqadi — ilovada bu
    // kodlar uchun hech qanday jadval yo'q.
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey(
              'verification_label_vehicle_photo_front')))
          .data,
      'Avtomobil old tomondan',
    );
    expect(
      tester
          .widget<Text>(
              find.byKey(const ValueKey('verification_hint_vehicle_photo_front')))
          .data,
      "Davlat raqami ko'rinsin",
    );
    expect(
      tester
          .widget<Text>(
              find.byKey(const ValueKey('verification_label_taxi_permit_2027')))
          .data,
      'Taksi litsenziyasi (2027)',
    );

    // Holat matni ham chiqadi (rang yagona signal emas).
    expect(find.text('Yuklanmagan'), findsOneWidget);
    expect(find.text('Tekshirilmoqda'), findsOneWidget);
  });

  testWidgets("bo'sh ro'yxat XATO deb ko'rsatilmaydi", (tester) async {
    // Server "sizdan hech narsa talab qilinmayapti" deyishi — normal holat.
    stubVerification(items: const []);

    await pumpScreen(tester);

    expect(find.byKey(const ValueKey('verification_empty')), findsOneWidget);
    expect(find.byType(AppEmptyState), findsOneWidget);

    // Xato UI'sining hech bir belgisi bo'lmasligi kerak.
    expect(find.byType(AppErrorState), findsNothing);
    expect(find.text('Qayta urinish'), findsNothing);
    expect(find.text('Xatolik yuz berdi'), findsNothing);
  });

  testWidgets("muddat matni: qolgan va kechikkan kunlar", (tester) async {
    stubVerification(
      canGoOnline: false,
      blockedReason: "Guvohnoma muddati o'tgan",
      items: [
        _item(
          code: 'driver_license',
          label: 'Haydovchilik guvohnomasi',
          status: 'overdue',
          daysLeft: -5,
        ),
        _item(
          code: 'insurance',
          label: 'Sug\'urta polisi',
          status: 'due_soon',
          daysLeft: 12,
        ),
      ],
    );

    await pumpScreen(tester);

    expect(
      tester
          .widget<Text>(
              find.byKey(const ValueKey('verification_deadline_driver_license')))
          .data,
      '5 kun kechikkan',
    );
    expect(
      tester
          .widget<Text>(
              find.byKey(const ValueKey('verification_deadline_insurance')))
          .data,
      '12 kun qoldi',
    );
  });

  testWidgets('muddatsiz talabda muddat qatori umuman chiqmaydi',
      (tester) async {
    stubVerification(items: [
      _item(
        code: 'vehicle_photo_back',
        label: 'Avtomobil orqa tomondan',
        kind: 'vehicle_photo',
        status: 'ok',
      ),
    ]);

    await pumpScreen(tester);

    expect(
      find.byKey(const ValueKey('verification_deadline_vehicle_photo_back')),
      findsNothing,
    );
  });

  testWidgets('rad etilgan element sababi bilan ko\'rsatiladi',
      (tester) async {
    stubVerification(
      canGoOnline: false,
      blockedReason: 'Bitta hujjat rad etilgan',
      items: [
        _item(
          code: 'passport',
          label: 'Pasport',
          status: 'rejected',
          rejectionReason: 'Surat xira, matn o\'qilmayapti',
        ),
      ],
    );

    await pumpScreen(tester);

    expect(find.text('Rad etilgan'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('verification_rejection_passport')),
      findsOneWidget,
    );
    expect(find.text('Surat xira, matn o\'qilmayapti'), findsOneWidget);

    // Blok banneri serverning o'z sababini ko'rsatadi.
    expect(
      find.byKey(const ValueKey('verification_blocked_banner')),
      findsOneWidget,
    );
    expect(find.text('Bitta hujjat rad etilgan'), findsOneWidget);
  });

  testWidgets("noma'lum status ekranni yiqitmaydi", (tester) async {
    // Server kelajakda yangi holat qo'shsa, eski APK ishlashda davom etadi.
    stubVerification(items: [
      _item(
        code: 'medical_check',
        label: "Tibbiy ko'rik",
        status: 'grace_period_2027',
      ),
    ]);

    await pumpScreen(tester);

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('verification_item_medical_check')),
      findsOneWidget,
    );
    expect(find.text("E'tibor talab qiladi"), findsOneWidget);
  });

  testWidgets("tarmoq xatosi qayta urinish bilan ko'rsatiladi",
      (tester) async {
    when(() => mockApiClient.get(ApiEndpoints.driverVerification)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverVerification),
        response: _jsonResponse(ApiEndpoints.driverVerification, {
          'success': false,
          'message': 'Server javob bermadi',
        }),
        type: DioExceptionType.badResponse,
      ),
    );

    await pumpScreen(tester);

    expect(find.byType(AppErrorState), findsOneWidget);
    expect(find.text('Server javob bermadi'), findsOneWidget);

    // "Qayta urinish" yangi so'rov yuboradi.
    stubVerification(items: [
      _item(code: 'passport', label: 'Pasport', status: 'missing'),
    ]);
    await tester.tap(find.text('Qayta urinish'));
    await pumpUntilQuiet(tester);

    expect(find.byType(AppErrorState), findsNothing);
    expect(
      find.byKey(const ValueKey('verification_item_passport')),
      findsOneWidget,
    );
  });

  testWidgets('surat tanlash serverga yuklash so\'rovini yuboradi',
      (tester) async {
    stubVerification(
      canGoOnline: false,
      blockedReason: 'Avtomobil surati yuklanmagan',
      items: [
        _item(
          code: 'vehicle_photo_front',
          label: 'Avtomobil old tomondan',
          kind: 'vehicle_photo',
          status: 'missing',
        ),
      ],
    );

    final uploadPath =
        ApiEndpoints.driverVerificationUpload('vehicle_photo_front');
    when(
      () => mockApiClient.post(
        uploadPath,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).thenAnswer(
      (_) async => _jsonResponse(uploadPath, {
        'success': true,
        'data': _item(
          code: 'vehicle_photo_front',
          label: 'Avtomobil old tomondan',
          kind: 'vehicle_photo',
          status: 'pending_review',
        ),
      }),
    );

    await pumpScreen(tester);
    expect(find.text('Yuklanmagan'), findsOneWidget);

    await pickGalleryPhotoFor(tester, 'vehicle_photo_front');

    verify(
      () => mockApiClient.post(
        uploadPath,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).called(1);

    // Server qaytargan yangi holat darhol ekranda.
    expect(find.text('Tekshirilmoqda'), findsOneWidget);
    expect(find.text('Yuklanmagan'), findsNothing);
  });

  testWidgets('yuklash muvaffaqiyatsiz bo\'lsa sabab va qayta urinish chiqadi',
      (tester) async {
    stubVerification(items: [
      _item(code: 'passport', label: 'Pasport', status: 'missing'),
    ]);

    final uploadPath = ApiEndpoints.driverVerificationUpload('passport');
    when(
      () => mockApiClient.post(
        uploadPath,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: uploadPath),
        response: _jsonResponse(uploadPath, {
          'success': false,
          'message': 'Fayl hajmi juda katta',
        }),
        type: DioExceptionType.badResponse,
      ),
    );

    await pumpScreen(tester);
    await pickGalleryPhotoFor(tester, 'passport');

    expect(
      find.byKey(const ValueKey('verification_upload_error_passport')),
      findsOneWidget,
    );
    expect(find.text('Fayl hajmi juda katta'), findsOneWidget);
    expect(find.text('Qayta urinish'), findsOneWidget);
  });
}
