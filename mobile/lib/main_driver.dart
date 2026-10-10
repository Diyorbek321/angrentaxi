import 'dart:async';

import 'package:angren_taxi/app.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/map_offline_region.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart'
    show LicenseEntryWithLineBreaks, LicenseRegistry;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/date_symbol_data_local.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM Driver] Background message: ${message.messageId}');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Shriftlar `assets/google_fonts/` da — tarmoqdan yuklanmaydi. Aks holda
  // birinchi ishga tushishda matn boshqa shriftda chiqib, keyin almashardi
  // va sekin internetda kechikardi.
  GoogleFonts.config.allowRuntimeFetching = false;
  // OFL litsenziyasi shrift bilan birga tarqatilishi shart.
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString('assets/google_fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(['google_fonts'], license);
  });

  // ⚠️ `intl` LOKAL MA'LUMOTLARINI YUKLASH — ILOVA ISHGA TUSHISHIDA MAJBURIY.
  //
  // `Formatters` ning har bir sana metodi `DateFormat(pattern, 'uz')` ni
  // ishlatadi, va u lokal ma'lumotlarisiz `LocaleDataException` tashlaydi:
  // "Locale data has not been initialized". Ya'ni buni chaqirmasdan chek
  // ekrani, safarlar tarixi, bildirishnomalar, promo-kodlar va
  // rejalashtirilgan safarlar ekrani — sana ko'rsatadigan HAR BIR ekran —
  // qizil xato ekraniga aylanardi.
  //
  // Bu vidjet testlarida sezilmay qolgan edi: ular `setUpAll` da
  // `initializeDateFormatting('uz')` ni O'ZLARI chaqiradi, ya'ni testlar
  // yashil bo'lib turgan holda ilova prodda yiqilardi.
  //
  // Bir-biriga bog'liq bo'lmagan ishga tushirishlar PARALLEL: ilgari ular
  // ketma-ket kutilardi va har biri sovuq startga o'z vaqtini qo'shardi.
  final results = await Future.wait<bool>([
    initializeDateFormatting('uz', null).then((_) => true),
    initializeDateFormatting('ru', null).then((_) => true),
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]).then((_) => true),
    _initFirebase(),
    setupServiceLocator().then((_) => true),
  ]);
  final firebaseReady = results[3];

  if (firebaseReady) {
    _registerFcmToken();
  }

  runApp(const AngrenTaxiApp(flavor: AppFlavor.driver));

  // Angren xaritasini fonda offline bazaga yuklash. Kechiktirilgan — birinchi
  // ekran o'z so'rovlari bilan tarmoq uchun raqobatlashmasin.
  unawaited(
    Future<void>.delayed(
      const Duration(seconds: 8),
      MapOfflineRegion.ensureDownloaded,
    ),
  );
}

Future<void> _registerFcmToken() async {
  try {
    final messaging = FirebaseMessaging.instance;
    // Bildirishnoma ruxsati bu yerda SO'RALMAYDI: ilova ochilgan zahoti,
    // tushuntirishsiz chiqadigan dialog ko'pincha rad etiladi. Haydovchi uni
    // "Ishga tayyorlik" oynasida, nima uchun kerakligini o'qib beradi.
    // Android'da token ruxsatsiz ham olinadi.

    final token = await messaging.getToken();
    if (token != null) {
      await Future<void>.delayed(const Duration(seconds: 2));
      final apiClient = sl<ApiClient>();
      await apiClient.post(
        ApiEndpoints.registerFcmToken,
        data: {'token': token, 'platform': 'android', 'role': 'driver'},
      );
    }
  } catch (e) {
    debugPrint('[FCM Driver] Token registration failed: $e');
  }
}

/// Firebase dev/mock rejimida ixtiyoriy: haqiqiy google-services
/// ma'lumotlarisiz `initializeApp` xato tashlaydi va u ilovani yiqitmasligi
/// kerak.
Future<bool> _initFirebase() async {
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    return true;
  } catch (e) {
    debugPrint('[Firebase] init skipped (dev/mock mode): $e');
    return false;
  }
}
