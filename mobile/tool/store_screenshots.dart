// App Store skrinshotlari uchun kirish nuqtasi. Ilovaga KIRMAYDI (lib/ dan
// tashqarida). Faqat Mac + iOS simulyatorda:
//
//   flutter run -d <simulyator> -t tool/store_screenshots.dart \
//     --dart-define=DEMO_MODE=true
//
// Demo rejimda server so'rovlari DemoEngine'dan javob oladi, shuning uchun
// login avtomatik o'tadi va joylashuv doim Angren markazi (ruxsat oynasi
// chiqmaydi). Ochiladigan ekran: ilova konteyneridagi tmp/route.txt
// (`/phone` — login ekrani; bo'sh yoki `/home` — bosh ekran; boshqa nom —
// shu marshrut). iPhone 6.9" (1320×2868) simulyatorida Cmd+S bilan oling.
//
// Mac'dagi ishdan (origin/main 78e3a52) ko'chirilgan, joriy API'ga moslangan.
import 'dart:io' show Directory, File;

import 'package:angren_taxi/app.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';

const _flavor = AppFlavor.passenger;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!AppConfig.demoMode) {
    throw StateError('--dart-define=DEMO_MODE=true bilan ishga tushiring');
  }

  GoogleFonts.config.allowRuntimeFetching = false;
  await Future.wait<void>([
    initializeDateFormatting('uz', null),
    initializeDateFormatting('ru', null),
    setupServiceLocator(),
  ]);

  // Skrinshotda ruxsat oynasi bo'lmasin: doim "Angren'dagi" joylashuv.
  sl.unregister<LocationService>();
  sl.registerLazySingleton<LocationService>(_AngrenLocation.new);

  final routeFile = File('${Directory.systemTemp.path}/route.txt');
  final route =
      routeFile.existsSync() ? routeFile.readAsStringSync().trim() : null;
  if (route != '/phone') {
    // AngrenTaxiApp o'z AuthProvider'ini yaratadi va saqlangan sessiyani
    // o'qiydi — bu yerda kirish tokenni saqlab qo'yadi.
    final auth = buildAuthProvider(_flavor);
    await auth.sendOtp('+998901234567');
    await auth.verifyOtp('123456');
  }

  runApp(const AngrenTaxiApp(flavor: _flavor));

  if (route != null && route.isNotEmpty && route != '/home') {
    await Future<void>.delayed(const Duration(seconds: 5));
    await sl<GlobalKey<NavigatorState>>().currentState?.pushNamed(route);
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
    BackgroundNotice? background,
  }) =>
      Stream<Position>.value(_here);
}
