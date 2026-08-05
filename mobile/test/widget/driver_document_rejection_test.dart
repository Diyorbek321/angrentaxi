// Widget tests for driver KYC document rejection display + re-upload.
// Covers: a rejected document shows its rejectionReason text prominently,
// and tapping the re-upload action on a rejected document triggers the same
// upload flow as a fresh document.
//
// Follows the same mocking pattern as test/widget/driver_kyc_upload_test.dart:
// image_picker is faked via ImagePickerPlatform.instance, ApiClient is mocked
// with mocktail, and the real MultipartFile.fromFile disk read is driven
// inside tester.runAsync.
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

    final tempFile = await File(
      '${Directory.systemTemp.path}/driver_document_rejection_test_${DateTime.now().microsecondsSinceEpoch}.jpg',
    ).create();
    await tempFile.writeAsBytes([0xFF, 0xD8, 0xFF, 0xD9]);
    tempFilePath = tempFile.path;

    originalImagePickerPlatform = ImagePickerPlatform.instance;
    ImagePickerPlatform.instance = _FakeImagePickerPlatform(tempFilePath);

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

    // GET /drivers/documents — a license_front doc already rejected with a
    // reason, so the screen renders the rejected state on first load.
    when(() => mockApiClient.get(ApiEndpoints.driverDocuments)).thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.driverDocuments,
        {
          'success': true,
          'data': [
            {
              'id': 'doc-1',
              'driverId': 'driver-1',
              'documentType': 'license_front',
              'fileUrl': '/uploads/driver-documents/doc-1.jpg',
              'reviewStatus': 'rejected',
              'rejectionReason': 'Photo is blurry, license number not legible',
              'uploadedAt': '2026-07-13T19:55:00.000Z',
            },
          ],
        },
      ),
    );
  });

  tearDown(() {
    ImagePickerPlatform.instance = originalImagePickerPlatform;
    final f = File(tempFilePath);
    if (f.existsSync()) f.deleteSync();
  });

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

    await pumpUntilQuiet(tester);
  }

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

  testWidgets('a rejected document shows its rejection reason text',
      (tester) async {
    await pumpOnboardingScreen(tester);

    final statusFinder = find.byKey(const ValueKey('doc_status_licenseFront'));
    expect(statusFinder, findsOneWidget);
    expect(
      (tester.widget(statusFinder) as Text).data,
      'Rad etilgan — qayta yuklang',
    );

    final reasonFinder =
        find.byKey(const ValueKey('doc_rejection_reason_licenseFront'));
    expect(reasonFinder, findsOneWidget);
    expect(
      (tester.widget(reasonFinder) as Text).data,
      'Photo is blurry, license number not legible',
    );
  });

  testWidgets(
      'tapping re-upload after rejection triggers the same upload flow as a fresh document',
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
          'id': 'doc-2',
          'driverId': 'driver-1',
          'documentType': 'license_front',
          'fileUrl': '/uploads/driver-documents/doc-2.jpg',
          'reviewStatus': 'pending',
          'rejectionReason': null,
          'uploadedAt': '2026-07-14T09:00:00.000Z',
        },
      }),
    );

    await pumpOnboardingScreen(tester);

    // The re-upload button on a rejected document uses the same
    // 'doc_upload_<type>' key as a fresh document (it's not treated as an
    // upload-failure retry), and remains tappable while rejected.
    final uploadButtonFinder =
        find.byKey(const ValueKey('doc_upload_licenseFront'));
    expect(uploadButtonFinder, findsOneWidget);
    expect(find.text('Qayta yuklash'), findsOneWidget);

    await pickGalleryPhotoFor(tester, 'doc_upload_licenseFront');

    verify(
      () => mockApiClient.post(
        ApiEndpoints.driverDocuments,
        data: any(named: 'data'),
        onSendProgress: any(named: 'onSendProgress'),
      ),
    ).called(1);

    // After the re-upload response comes back, the rejection reason clears
    // and the row reflects the new pending status.
    final statusFinder = find.byKey(const ValueKey('doc_status_licenseFront'));
    expect((tester.widget(statusFinder) as Text).data, 'Tekshirilmoqda');
    expect(
      find.byKey(const ValueKey('doc_rejection_reason_licenseFront')),
      findsNothing,
    );
  });
}
