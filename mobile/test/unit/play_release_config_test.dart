// Google Play reliz talablari (2026-10-29 tayyorlik auditi):
//   • targetSdk ≥ 36 — 2026-08-31 dan yangi ilova/yangilanish uchun majburiy.
//   • Yo'lovchi ilovasida location foreground service YO'Q — aks holda Play
//     ishlatilmayotgan ruxsat uchun video-deklaratsiya so'raydi va rad etadi.
//   • Reliz skripti Play uchun AAB yig'a oladi.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('targetSdk 36 yoki yuqori', () {
    final gradle = File('android/app/build.gradle').readAsStringSync();
    final match = RegExp(r'targetSdk\s*=\s*(\d+)').firstMatch(gradle);
    expect(match, isNotNull, reason: 'targetSdk aniq son bo\'lishi kerak (Flutter standarti 35)');
    expect(int.parse(match!.group(1)!), greaterThanOrEqualTo(36));
  });

  test("yo'lovchi flavori location FGS ruxsati va xizmatini olib tashlaydi", () {
    final manifest = File('android/app/src/passenger/AndroidManifest.xml').readAsStringSync();
    for (final name in [
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.FOREGROUND_SERVICE',
      'com.baseflow.geolocator.GeolocatorLocationService',
    ]) {
      expect(
        RegExp('android:name="${RegExp.escape(name)}"\\s+tools:node="remove"').hasMatch(manifest),
        isTrue,
        reason: name,
      );
    }
  });

  test("fon joylashuvi ruxsati hech qayerda e'lon qilinmagan", () {
    for (final path in [
      'android/app/src/main/AndroidManifest.xml',
      'android/app/src/driver/AndroidManifest.xml',
    ]) {
      expect(File(path).readAsStringSync(), isNot(contains('<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"')));
    }
  });

  test('reliz skripti BUNDLE=1 da appbundle yig\'adi', () {
    final script = File('tool/build_release.sh').readAsStringSync();
    expect(script, contains('flutter build appbundle --release'));
  });
}
