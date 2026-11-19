// App Store screenshot entry point. Not shipped — build with
//   flutter build ios --simulator --flavor <f> -t tool/store_screenshots.dart \
//     --dart-define=DEMO_MODE=true --dart-define=FLAVOR=<f>
// then write the route into <data container>/tmp/route.txt and launch.
import 'dart:io' show Directory, File;

import 'package:angren_taxi/app.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  assert(AppConfig.demoMode, 'build with --dart-define=DEMO_MODE=true');
  const flavorName = String.fromEnvironment('FLAVOR', defaultValue: 'passenger');
  final flavor = flavorName == 'driver' ? AppFlavor.driver : AppFlavor.passenger;

  await setupServiceLocator();
  // No permission prompt in screenshots: always "in Angren".
  sl.unregister<LocationService>();
  sl.registerLazySingleton<LocationService>(() => _AngrenLocation());
  // Written by the screenshot script into the app container's tmp/ dir.
  final routeFile = File('${Directory.systemTemp.path}/route.txt');
  final route =
      routeFile.existsSync() ? routeFile.readAsStringSync().trim() : null;
  if (route != '/phone') {
    final auth = buildAuthProvider();
    await auth.sendOtp('+998901234567');
    await auth.verifyOtp('123456');
  }

  runApp(AngrenTaxiApp(flavor: flavor));

  if (route != null && route.isNotEmpty && route != '/home') {
    await Future<void>.delayed(const Duration(seconds: 5));
    sl<GlobalKey<NavigatorState>>().currentState?.pushNamed(route);
  }
}

class _AngrenLocation extends LocationService {
  Position get _here => Position(
        latitude: AppConfig.defaultLat,
        longitude: AppConfig.defaultLng,
        timestamp: DateTime.now(),
        accuracy: 5,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );

  @override
  Future<bool> requestPermission() async => true;

  @override
  Future<Position?> getCurrentPosition() async => _here;

  @override
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    bool background = false,
  }) =>
      Stream<Position>.value(_here);
}
