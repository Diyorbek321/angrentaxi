// Widget tests for driver KYC document upload on the onboarding screen.
// Covers: picking a file triggers an upload call, a successful upload shows
// "pending" status, and a failed upload shows a retry action.
//
// image_picker is faked via ImagePickerPlatform.instance (the officially
// supported way to stub the plugin in widget tests) so no real camera/
// gallery is touched. ApiClient is mocked with mocktail so no real network
// call is made. The upload path still reads a real file from disk via
// MultipartFile.fromFile, so that step runs inside `tester.runAsync` —
// widget tests otherwise execute in a fake-async zone where genuine dart:io
// operations never complete.
import 'dart:io';

import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/driver_onboarding_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:mocktail/mocktail.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

// Fakes the image_picker plugin at the platform-interface level (the pattern
// documented by the image_picker package for widget tests) and always
// "returns" the same pre-created file, regardless of camera/gallery choice.
class _FakeImagePickerPlatform extends Fake
    with MockPlatformInterfaceMixin
    implements ImagePickerPlatform {
  _FakeImagePickerPlatform(this.filePath);

  final String filePath;

  @override
  Future<XFile?> getImageFromSource({
    required ImageSource source,
    ImagePickerOptions options = const ImagePickerOptions(),
  }) async {
    return XFile(filePath);
  }
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

    // A real file on disk: MultipartFile.fromFile needs one to exist.
    final tempFile = await File(
      '${Directory.systemTemp.path}/driver_kyc_upload_test_${DateTime.now().microsecondsSinceEpoch}.jpg',
    ).create();
    await tempFile.writeAsBytes([0xFF, 0xD8, 0xFF, 0xD9]);
    tempFilePath = tempFile.path;

    originalImagePickerPlatform = ImagePickerPlatform.instance;
    ImagePickerPlatform.instance = _FakeImagePickerPlatform(tempFilePath);

    // GET /drivers/me — a driver who already applied and is pending review.
    when(() => mockApiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01 A 123 BC',
          'user': {'phone': '+998901112233', 'status': 'pending'},
        },
      }),
    );

    // GET /drivers/documents — starts out empty for every test.
    when(() => mockApiClient.get(ApiEndpoints.driverDocuments)).thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.driverDocuments,
        {'success': true, 'data': <dynamic>[]},
      ),
    );
  });

  tearDown(() {
    ImagePickerPlatform.instance = originalImagePickerPlatform;
    final f = File(tempFilePath);
    if (f.existsSync()) f.deleteSync();
  });

  // LoadingWidget (shown briefly while `_checking` resolves) uses
  // flutter_animate's `.repeat()`, and Material's indeterminate progress
  // indicators do the same — both schedule frames forever, which makes
  // `pumpAndSettle()` time out. Draining a fixed number of short pumps
  // instead reliably flushes the mocked (near-instant) async calls without
  // waiting on a repeating animation to finish.
  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 15}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> pumpOnboardingScreen(WidgetTester tester) async {
    final driverProvider = DriverProvider(
      apiClient: mockApiClient,
      socketService: SocketService(),
      locationService: LocationService(),
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
        child: const MaterialApp(home: DriverOnboardingScreen()),
      ),
    );

    // Let the postFrameCallback-triggered checkOnboarding()/loadDriverDocuments()
    // calls resolve.
    await pumpUntilQuiet(tester);
  }

  // Taps a document's upload/retry button, opens the camera/gallery sheet,
  // and picks "Galereya". The MultipartFile.fromFile disk read that
  // DriverProvider.uploadDriverDocument performs is genuine dart:io I/O, so
  // it's driven inside `tester.runAsync` — plain `pump()` never lets real
  // (non-fake) async work complete in a widget test.
  Future<void> pickGalleryPhotoFor(WidgetTester tester, String buttonKey) async {
    await tester.tap(find.byKey(ValueKey(buttonKey)));
    await pumpUntilQuiet(tester);

    expect(find.text('Galereya'), findsOneWidget);
    await tester.tap(find.text('Galereya'));

    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await pumpUntilQuiet(tester);
  }

  testWidgets('picking a document photo triggers an upload call',
      (tester) async {
    when(
      () => mockApiClient.post(
        ApiEndpoints.driverDocuments,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverDocuments, {
        'success': true,
        'data': {
          'id': 'doc-1',
          'driverId': 'driver-1',
          'documentType': 'license_front',
          'fileUrl': '/uploads/driver-documents/doc-1.jpg',
          'reviewStatus': 'pending',
          'uploadedAt': '2026-07-13T19:55:00.000Z',
        },
      }),
    );

    await pumpOnboardingScreen(tester);

    expect(find.byKey(const ValueKey('doc_upload_licenseFront')), findsOneWidget);
    await pickGalleryPhotoFor(tester, 'doc_upload_licenseFront');

    verify(
      () => mockApiClient.post(
        ApiEndpoints.driverDocuments,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).called(1);
  });

  testWidgets('a successful upload shows pending status', (tester) async {
    when(
      () => mockApiClient.post(
        ApiEndpoints.driverDocuments,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverDocuments, {
        'success': true,
        'data': {
          'id': 'doc-1',
          'driverId': 'driver-1',
          'documentType': 'license_front',
          'fileUrl': '/uploads/driver-documents/doc-1.jpg',
          'reviewStatus': 'pending',
          'uploadedAt': '2026-07-13T19:55:00.000Z',
        },
      }),
    );

    await pumpOnboardingScreen(tester);
    await pickGalleryPhotoFor(tester, 'doc_upload_licenseFront');

    final statusFinder = find.byKey(const ValueKey('doc_status_licenseFront'));
    expect(statusFinder, findsOneWidget);
    expect((tester.widget(statusFinder) as Text).data, 'Tekshirilmoqda');
  });

  testWidgets('a failed upload shows a retry option', (tester) async {
    when(
      () => mockApiClient.post(
        ApiEndpoints.driverDocuments,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.driverDocuments),
        response: _jsonResponse(ApiEndpoints.driverDocuments, {
          'success': false,
          'message': 'Fayl hajmi juda katta',
        }),
        type: DioExceptionType.badResponse,
      ),
    );

    await pumpOnboardingScreen(tester);
    await pickGalleryPhotoFor(tester, 'doc_upload_licenseFront');

    expect(find.byKey(const ValueKey('doc_retry_licenseFront')), findsOneWidget);
    expect(find.text('Qayta urinish'), findsOneWidget);

    final statusFinder = find.byKey(const ValueKey('doc_status_licenseFront'));
    expect((tester.widget(statusFinder) as Text).data, 'Fayl hajmi juda katta');

    // Retry re-triggers the upload flow.
    await pickGalleryPhotoFor(tester, 'doc_retry_licenseFront');

    verify(
      () => mockApiClient.post(
        ApiEndpoints.driverDocuments,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).called(2);
  });
}
