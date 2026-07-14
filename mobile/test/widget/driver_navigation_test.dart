// Widget tests for the "Navigatsiyani ochish" (open navigation) button
// added to NavigationScreen (mobile/lib/features/driver/screens/
// navigation_screen.dart) — the driver-side "en route to pickup" screen.
//
// Tapping the button should hand the device's default maps/navigation app a
// deep link to the order's pickup point (this screen only ever shows before
// pickup — see home_screen.dart#_navigateToActiveOrder — but the target
// still falls back to the dropoff if the active order's status is somehow
// already inProgress, exercised by the third test below).
//
// url_launcher is faked at the platform-interface level (UrlLauncherPlatform
// .instance), the officially supported way to stub the plugin in widget
// tests — same seam used for image_picker in
// test/widget/driver_kyc_upload_test.dart. DriverProvider is seeded with a
// real active order the same way as test/widget/driver_trip_screen_test.dart
// (via a mocked ApiClient + DriverProvider.acceptOrder).
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/navigation_screen.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Avoids the real geolocator platform channel, which isn't available under
/// plain `flutter test` — hands NavigationScreen's map-centering fetch a
/// fixed fix, same pattern as test/widget/driver_trip_screen_test.dart.
class _FakeLocationService extends LocationService {
  @override
  Future<Position?> getCurrentPosition() async => Position(
        latitude: 41.0100,
        longitude: 70.1400,
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

/// Fakes the url_launcher plugin at the platform-interface level (the
/// pattern documented by the url_launcher package for widget tests, mirrors
/// _FakeImagePickerPlatform in test/widget/driver_kyc_upload_test.dart).
/// Records every canLaunch/launchUrl call so tests can assert on the exact
/// URI shape without touching a real platform channel.
class _FakeUrlLauncherPlatform extends Fake
    with MockPlatformInterfaceMixin
    implements UrlLauncherPlatform {
  _FakeUrlLauncherPlatform({this.canLaunchResult = true});

  final bool canLaunchResult;
  final List<String> canLaunchCalls = [];
  final List<String> launchedUrls = [];

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> canLaunch(String url) async {
    canLaunchCalls.add(url);
    return canLaunchResult;
  }

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launchedUrls.add(url);
    return true;
  }
}

const String _orderId = 'order-1';

const Map<String, dynamic> _enRouteOrderJson = {
  'id': _orderId,
  'passengerId': 'passenger-1',
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
  'status': 'accepted',
  'estimatedPrice': 20000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

const Map<String, dynamic> _inProgressOrderJson = {
  'id': _orderId,
  'passengerId': 'passenger-1',
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
  'status': 'in_progress',
  'estimatedPrice': 20000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late DriverProvider driverProvider;
  late _FakeUrlLauncherPlatform fakeUrlLauncher;
  late UrlLauncherPlatform originalUrlLauncher;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
    originalUrlLauncher = UrlLauncherPlatform.instance;
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final localStorage = LocalStorage(prefs);

    apiClient = MockApiClient();
    driverProvider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );

    await sl.reset();
    sl.registerLazySingleton<LocationService>(() => _FakeLocationService());

    fakeUrlLauncher = _FakeUrlLauncherPlatform();
    UrlLauncherPlatform.instance = fakeUrlLauncher;
  });

  tearDown(() async {
    await sl.reset();
    UrlLauncherPlatform.instance = originalUrlLauncher;
  });

  Future<void> seedActiveOrder(Map<String, dynamic> orderJson) async {
    when(() => apiClient.patch(ApiEndpoints.acceptOrder(_orderId)))
        .thenAnswer((_) async => _jsonResponse(
              ApiEndpoints.acceptOrder(_orderId),
              orderJson,
            ));
    await driverProvider.acceptOrder(_orderId);
  }

  Future<void> pumpNavigationScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: driverProvider,
        child: const MaterialApp(home: NavigationScreen()),
      ),
    );
    // Drains the initState-triggered map-centering location fetch without
    // waiting on flutter_map's tile-layer animations to fully settle, same
    // pattern as test/widget/driver_trip_screen_test.dart.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets(
    'shows a prominent "Navigatsiyani ochish" button on the pickup navigation screen',
    (tester) async {
      await seedActiveOrder(_enRouteOrderJson);
      await pumpNavigationScreen(tester);

      expect(find.text('Navigatsiyani ochish'), findsOneWidget);
      expect(find.byIcon(Icons.navigation), findsWidgets);

      tester.takeException();
    },
  );

  testWidgets(
    'tapping the button on Android launches a geo: URI for the pickup point',
    (tester) async {
      await seedActiveOrder(_enRouteOrderJson);
      await pumpNavigationScreen(tester);

      await tester.tap(find.text('Navigatsiyani ochish'));
      await tester.pump();

      expect(fakeUrlLauncher.canLaunchCalls, hasLength(1));
      expect(fakeUrlLauncher.launchedUrls, hasLength(1));
      final launched = fakeUrlLauncher.launchedUrls.single;
      expect(launched, startsWith('geo:0,0?q=41.0167,70.1436('));
      expect(launched, contains(Uri.encodeComponent("Angren, Bobur ko'chasi, 10")));

      tester.takeException();
    },
    skip: Platform.isIOS,
  );

  testWidgets(
    'when the active order is already inProgress, navigation targets the dropoff instead of the pickup',
    (tester) async {
      await seedActiveOrder(_inProgressOrderJson);
      await pumpNavigationScreen(tester);

      await tester.tap(find.text('Navigatsiyani ochish'));
      await tester.pump();

      final launched = fakeUrlLauncher.launchedUrls.single;
      expect(launched, contains('41.02'));
      expect(launched, contains('70.15'));
      expect(launched, contains(Uri.encodeComponent('Angren, Mustaqillik maydoni')));

      tester.takeException();
    },
    skip: Platform.isIOS,
  );

  testWidgets(
    'shows a SnackBar instead of silently failing when no app can handle the URI',
    (tester) async {
      fakeUrlLauncher = _FakeUrlLauncherPlatform(canLaunchResult: false);
      UrlLauncherPlatform.instance = fakeUrlLauncher;

      await seedActiveOrder(_enRouteOrderJson);
      await pumpNavigationScreen(tester);

      await tester.tap(find.text('Navigatsiyani ochish'));
      await tester.pump();

      expect(fakeUrlLauncher.launchedUrls, isEmpty);
      expect(find.text('Navigatsiya ilovasi topilmadi'), findsOneWidget);

      tester.takeException();
    },
  );
}
