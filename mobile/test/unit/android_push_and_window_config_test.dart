// Android konfiguratsiyasi regressiyasi (2026-10-16 qurilma sinovi):
//   • "Push kelmadi" — manifest bazaviy FirebaseMessagingService'ni qayta
//     e'lon qilib, FCM xabarlarini firebase_messaging plaginidan tortib
//     olardi; backend ishlatadigan `angren_taxi_orders` kanali va monoxrom
//     bildirishnoma ikonkasi yo'q edi.
//   • "Ekran qorayib ochilyapti" — oyna temasi `Theme.Black`, foni qora edi.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final manifest = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

  test('bazaviy FirebaseMessagingService qayta e\'lon qilinmaydi', () {
    expect(
      RegExp(r'<service\s+android:name="com\.google\.firebase\.messaging\.FirebaseMessagingService"')
          .hasMatch(manifest),
      isFalse,
    );
  });

  test('standart kanal = backend channelId, monoxrom ikonka', () {
    final backend = File('../backend/src/modules/notifications/firebase.service.ts');
    if (backend.existsSync()) {
      expect(backend.readAsStringSync(), contains("channelId: 'angren_taxi_orders'"));
    }
    expect(manifest, contains('com.google.firebase.messaging.default_notification_channel_id'));
    expect(manifest, contains('android:value="angren_taxi_orders"'));
    expect(manifest, contains('@drawable/ic_stat_notification'));
    expect(File('android/app/src/main/res/drawable/ic_stat_notification.xml').existsSync(), isTrue);
    expect(
      File('android/app/src/main/kotlin/uz/angren/taxi/PushNotifications.kt').readAsStringSync(),
      contains('ORDERS_CHANNEL_ID = "angren_taxi_orders"'),
    );
  });

  test('oyna temasi qora emas — foni ilova foni', () {
    final styles = File('android/app/src/main/res/values/styles.xml').readAsStringSync();
    expect(styles, isNot(contains('parent="@android:style/Theme.Black')));
    expect(styles, contains('@color/app_background'));
    final colors = File('android/app/src/main/res/values/colors.xml').readAsStringSync();
    expect(colors, contains('#FFF4F7F8')); // kBackground
  });
}
