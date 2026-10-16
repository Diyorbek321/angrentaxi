import 'dart:async';

import 'package:angren_taxi/app.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/map_offline_region.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/observability/crash_reporting.dart';
import 'package:angren_taxi/core/push/push_notifications.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/wallet/driver_push_events.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_deep_links.dart';
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
    _forwardPushMessages();
  }

  // To'lovdan qaytish havolasi (`angrengo://wallet/topup/<id>`, §24).
  // runApp'dan OLDIN — kuzatuvchi WidgetsApp'dan oldin turishi kerak.
  DriverDeepLinks.instance.install();

  // Yiqilishlar Sentry'ga (SENTRY_DSN bo'lmasa — oddiy runApp).
  await CrashReporting.run(
    flavor: AppFlavor.driver,
    appRunner: () => runApp(const AngrenTaxiApp(flavor: AppFlavor.driver)),
  );

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
  // Bildirishnoma ruxsati bu yerda SO'RALMAYDI: ilova ochilgan zahoti,
  // tushuntirishsiz chiqadigan dialog ko'pincha rad etiladi. Haydovchi uni
  // "Ishga tayyorlik" oynasida, nima uchun kerakligini o'qib beradi.
  final push = PushNotifications.instance
    ..isUserEnabled = () => sl<LocalStorage>().getPushEnabled();
  // Hamyon hodisalarini ilova o'zi snackbar bilan ko'rsatadi — old planda
  // ikkinchi marta tizim bildirishnomasi chiqmasin.
  push.shouldShowInForeground = (m) =>
      driverPushAction(m.data['event']?.toString()) == DriverPushAction.none;
  await push.start(api: sl<ApiClient>(), role: 'driver');
  await push.syncToken();
}

/// FCM xabarlarini ilova ichidagi shinaga uzatadi — hamyon hodisalari
/// (`data.event`, docs/LEGAL-COMPLIANCE.md §17) shu yerdan
/// `DriverWalletEventsHost` ga yetadi.
void _forwardPushMessages() {
  DriverPushMessage toMessage(RemoteMessage m, {required bool opened}) =>
      DriverPushMessage(
        data: Map<String, dynamic>.from(m.data),
        title: m.notification?.title,
        body: m.notification?.body,
        opened: opened,
      );

  try {
    FirebaseMessaging.onMessage.listen(
      (m) => DriverPushBus.instance.add(toMessage(m, opened: false)),
    );
    FirebaseMessaging.onMessageOpenedApp.listen(
      (m) => DriverPushBus.instance.add(toMessage(m, opened: true)),
    );
    FirebaseMessaging.instance.getInitialMessage().then((m) {
      if (m != null) DriverPushBus.instance.add(toMessage(m, opened: true));
    }).catchError((Object e) {
      debugPrint('[FCM Driver] getInitialMessage failed: $e');
    });
  } catch (e) {
    debugPrint('[FCM Driver] push forwarding failed: $e');
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
