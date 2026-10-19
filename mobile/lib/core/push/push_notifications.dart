import 'dart:async';
import 'dart:convert';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/push/push_tap_router.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

// ============================================================================
// PUSH BILDIRISHNOMALARI — ikkala flavor uchun umumiy (yo'lovchi + haydovchi).
//
// "Push kelmadi" ildizlari (2026-10-16 qurilma sinovi):
//   1. AndroidManifest bazaviy `FirebaseMessagingService` ni qayta e'lon
//      qilardi — FCM xabarlari firebase_messaging plaginiga yetmasdi
//      (manifestdagi izohga qarang).
//   2. `angren_taxi_orders` kanali hech qachon yaratilmagan — backend aynan
//      shu kanalga yuboradi.
//   3. Ilova ochiq turganda FCM bildirishnomani ko'rsatmaydi — `onMessage`
//      tinglanmagan edi, ya'ni old planda push "yo'qolardi".
//   4. Android 13+ `POST_NOTIFICATIONS` faqat taksi buyurtmasida so'ralardi —
//      faqat ovqat/market buyurtma qilgan foydalanuvchida ruxsat yo'q edi.
//   5. Token faqat sovuq startdan 3 s keyin bir marta yuborilardi: o'sha
//      paytda kirilmagan bo'lsa (yangi o'rnatish → OTP) 401 bilan yo'qolardi,
//      `onTokenRefresh` esa umuman tinglanmasdi — serverda eski token qolardi.
// ============================================================================

/// Android tomoni: `android/app/src/main/kotlin/uz/angren/taxi/PushNotifications.kt`.
class PushNotifications {
  PushNotifications._();

  static final PushNotifications instance = PushNotifications._();

  static const MethodChannel _channel = MethodChannel('uz.angren.taxi/push');

  ApiClient? _api;
  String _role = 'passenger';
  bool _started = false;
  String? _lastSentToken;
  StreamSubscription<String>? _refreshSub;
  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedSub;

  /// Old planda kelgan xabarni ko'rsatishdan oldin tekshiradi. `false` —
  /// ilova xabarni o'zi ko'rsatadi (masalan haydovchi hamyoni snackbar'i).
  bool Function(RemoteMessage message)? shouldShowInForeground;

  /// `false` — FCM bosishlarini (`onMessageOpenedApp`, `getInitialMessage`)
  /// chaqiruvchi o'zi uzatadi. Haydovchi ilovasi ularni hamyon shinasi uchun
  /// allaqachon tinglaydi, `getInitialMessage` esa bir martalik — ikkinchi
  /// chaqiruv bo'sh qaytishi mumkin.
  bool forwardFcmTaps = true;

  /// Sozlamalardagi "Bildirishnomalar" tugmasi — o'chirilgan bo'lsa token
  /// serverga yuborilmaydi.
  bool Function()? isUserEnabled;

  bool get _firebaseReady {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// `main_*.dart` dan, Firebase ishga tushgach chaqiriladi.
  Future<void> start({required ApiClient api, required String role}) async {
    _api = api;
    _role = role;
    if (_started || !_firebaseReady) return;
    _started = true;

    await ensureChannels();

    _foregroundSub = FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    _listenForTaps();
    _refreshSub = FirebaseMessaging.instance.onTokenRefresh.listen(
      (token) => unawaited(_sendToken(token)),
      onError: (Object e) => debugPrint('[Push] onTokenRefresh: $e'),
    );
    // iOS: old planda ham ko'rsatish. Android'da bu chaqiruv ta'sirsiz.
    try {
      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);
    } catch (e) {
      debugPrint('[Push] presentation options: $e');
    }
  }

  /// Kanal nomini joriy tilda (qayta) yozadi.
  Future<void> ensureChannels() async {
    try {
      await _channel.invokeMethod<void>('ensureChannels', {
        'name': AppL10n.current.shPushChannelOrders,
        'description': AppL10n.current.shPushChannelOrdersDescription,
      });
    } catch (e) {
      debugPrint('[Push] ensureChannels: $e');
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;
    if (shouldShowInForeground?.call(message) == false) return;
    final title = notification.title ?? '';
    final body = notification.body ?? '';
    if (title.isEmpty && body.isEmpty) return;
    unawaited(showLocal(title: title, body: body, data: message.data));
  }

  /// Tizim bildirishnomasini darhol ko'rsatadi (`angren_taxi_orders` kanali).
  /// [data] bosilganda qaytadi — tegishli ekran ochiladi ([PushTapRouter]).
  Future<void> showLocal({
    required String title,
    required String body,
    Map<String, dynamic> data = const {},
  }) async {
    try {
      await _channel.invokeMethod<void>('show', {
        'title': title,
        'body': body,
        'data': {for (final e in data.entries) e.key: '${e.value}'},
      });
    } catch (e) {
      debugPrint('[Push] show: $e');
    }
  }

  /// Push bosilishining uch manbasi → [PushTapRouter].
  void _listenForTaps() {
    final router = PushTapRouter.instance;
    if (forwardFcmTaps) {
      _openedSub = FirebaseMessaging.onMessageOpenedApp.listen((m) => router.handle(m.data));
      FirebaseMessaging.instance.getInitialMessage().then((m) {
        if (m != null) router.handle(m.data);
      }).catchError((Object e) {
        debugPrint('[Push] getInitialMessage: $e');
      });
    }
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'tapped') _handleLocalTap(call.arguments);
    });
    _channel.invokeMethod<String>('takeLaunchTap').then(_handleLocalTap).catchError((Object e) {
      debugPrint('[Push] takeLaunchTap: $e');
    });
  }

  void _handleLocalTap(dynamic json) {
    if (json is! String || json.isEmpty) return;
    try {
      final data = jsonDecode(json);
      if (data is Map) PushTapRouter.instance.handle(Map<String, dynamic>.from(data));
    } catch (e) {
      debugPrint('[Push] tap data: $e');
    }
  }

  /// Kirish muvaffaqiyatli bo'lgach va ilova ochilganda: joriy tokenni
  /// serverga yozadi. Bir xil tokenni ikki marta yubormaydi.
  Future<void> syncToken() async {
    if (!_firebaseReady) return;
    if (isUserEnabled?.call() == false) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _sendToken(token);
    } catch (e) {
      debugPrint('[Push] getToken: $e');
    }
  }

  Future<void> _sendToken(String token) async {
    final api = _api;
    if (api == null || token == _lastSentToken) return;
    try {
      await api.post(
        ApiEndpoints.registerFcmToken,
        data: {'token': token, 'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android', 'role': _role},
      );
      _lastSentToken = token;
    } catch (e) {
      // Kirilmagan bo'lsa 401 — kirishdan keyin `syncToken` qayta yuboradi.
      debugPrint('[Push] token registration failed: $e');
    }
  }

  /// Chiqishda: keyingi kirishda token qayta yuborilsin.
  void forgetSentToken() => _lastSentToken = null;

  /// Android 13+ `POST_NOTIFICATIONS` (iOS — FCM ruxsati). Faqat hali
  /// so'ralmagan / bir marta rad etilgan bo'lsa tizim dialogi chiqadi;
  /// butunlay rad etilgan bo'lsa bezovta qilmaydi. Plagin yo'q muhitda
  /// (testlar) jim.
  Future<void> ensurePermission() async {
    try {
      if (await ph.Permission.notification.isDenied) {
        await ph.Permission.notification.request();
      }
      if (_firebaseReady && defaultTargetPlatform == TargetPlatform.iOS) {
        await FirebaseMessaging.instance.requestPermission();
      }
    } catch (e) {
      debugPrint('[Push] permission request skipped: $e');
    }
  }

  @visibleForTesting
  Future<void> debugReset() async {
    await _refreshSub?.cancel();
    await _foregroundSub?.cancel();
    await _openedSub?.cancel();
    _refreshSub = null;
    _foregroundSub = null;
    _openedSub = null;
    _started = false;
    _lastSentToken = null;
    _api = null;
    shouldShowInForeground = null;
    isUserEnabled = null;
    forwardFcmTaps = true;
  }
}
