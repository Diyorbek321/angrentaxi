import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:angren_taxi/app.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM Driver] Background message: ${message.messageId}');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Firebase is optional in dev/mock mode: without valid google-services
  // credentials initializeApp throws, which must not crash app startup.
  var firebaseReady = false;
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    firebaseReady = true;
  } catch (e) {
    debugPrint('[Firebase] init skipped (dev/mock mode): $e');
  }

  await setupServiceLocator();

  if (firebaseReady) {
    _registerFcmToken();
  }

  runApp(const AngrenTaxiApp(flavor: AppFlavor.driver));
}

Future<void> _registerFcmToken() async {
  try {
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

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
