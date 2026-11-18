import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Ilova yiqilishi va kutilmagan xatolar — Sentry'ga.
///
/// `--dart-define=SENTRY_DSN=...` bo'lmasa (dev, testlar, demo) butunlay
/// o'chiq: `run` shunchaki ilovani ishga tushiradi.
///
/// Shaxsiy ma'lumot chet elga ketmasin (ZRU-547, 27¹-modda): IP, ism,
/// telefon, so'rov tanasi, cookie va Authorization yuborilmaydi, skrinshot
/// olinmaydi. Faqat foydalanuvchi id (UUID) — xatoni odamga bog'lash uchun.
class CrashReporting {
  CrashReporting._();

  static const String _buildDsn = String.fromEnvironment('SENTRY_DSN');
  static final RegExp _uzPhone = RegExp(r'\+?998\d{9}');
  static const Set<String> _droppedHeaders = {'authorization', 'cookie', 'set-cookie'};

  static bool _enabled = false;
  static bool get isEnabled => _enabled;

  static Future<void> run({
    required AppFlavor flavor,
    required FutureOr<void> Function() appRunner,
    String dsn = _buildDsn,
  }) async {
    if (dsn.isEmpty || AppConfig.demoMode) {
      await appRunner();
      return;
    }
    _enabled = true;
    await SentryFlutter.init(
      (options) => configure(options, dsn: dsn, flavor: flavor),
      appRunner: appRunner,
    );
  }

  @visibleForTesting
  static void configure(SentryFlutterOptions options, {required String dsn, required AppFlavor flavor}) {
    options
      ..dsn = dsn
      ..environment = kReleaseMode ? 'production' : 'debug'
      ..sendDefaultPii = false
      ..attachScreenshot = false
      ..attachViewHierarchy = false
      // Bepul tarif kvotasi xatolar uchun; tracing yoqilmaydi.
      ..tracesSampleRate = null
      ..beforeSend = ((event, hint) => scrubEvent(event, flavor: flavor))
      ..beforeBreadcrumb = ((crumb, hint) => scrubBreadcrumb(crumb));
  }

  /// `catch` ichida ushlangan, lekin production'da ko'rinishi kerak bo'lgan
  /// xato. Ilgari bunday xatolar faqat `debugPrint` qilinardi va Sentry
  /// faqat yiqilishlarni ko'rardi — tarif/narx/safar tiklash haqiqiy
  /// foydalanuvchilarda yiqilayotganini bilishning iloji yo'q edi.
  ///
  /// Tarmoq uzilishi va 4xx kutilgan holat — ular yuborilmaydi (kvota va
  /// shovqin), faqat iz (breadcrumb) qoladi.
  static void reportHandled(Object error, StackTrace stack, String where) {
    debugPrint('[$where] $error');
    if (!_enabled) return;
    if (!shouldReport(error)) {
      unawaited(Future.sync(() => Sentry.addBreadcrumb(
            Breadcrumb(category: 'handled', message: '$where: ${error.runtimeType}'),
          )));
      return;
    }
    unawaited(Future.sync(() => Sentry.captureException(
          error,
          stackTrace: stack,
          withScope: (scope) => scope.setTag('where', where),
        )));
  }

  /// Faqat kutilmagan xatolar: 5xx, javobni o'qib bo'lmasligi (model
  /// o'zgargan), dasturiy xato. Internet yo'qligi va 4xx — yo'q.
  @visibleForTesting
  static bool shouldReport(Object error) {
    if (error is DioException) {
      final status = error.response?.statusCode;
      return status != null && status >= 500;
    }
    return true;
  }

  /// Kirish/chiqishda chaqiriladi: faqat id, telefon emas.
  static void setUserId(String? id) {
    if (!_enabled) return;
    unawaited(Future.sync(() => Sentry.configureScope((scope) => scope.setUser(id == null ? null : SentryUser(id: id)))));
  }

  static String? _mask(String? text) =>
      text?.replaceAllMapped(_uzPhone, (m) => m.group(0)!.startsWith('+') ? '+998***' : '998***');

  @visibleForTesting
  static SentryEvent scrubEvent(SentryEvent event, {required AppFlavor flavor}) {
    final message = event.message;
    final request = event.request;
    final user = event.user;
    return event.copyWith(
      message: message == null
          ? null
          : SentryMessage(_mask(message.formatted)!, template: message.template, params: message.params),
      exceptions: event.exceptions?.map((e) => e.copyWith(value: _mask(e.value))).toList(),
      user: user == null ? null : SentryUser(id: user.id),
      request: request == null
          ? null
          : SentryRequest(
              url: request.url,
              method: request.method,
              headers: Map.fromEntries(
                request.headers.entries.where((h) => !_droppedHeaders.contains(h.key.toLowerCase())),
              ),
            ),
      tags: {...?event.tags, 'flavor': flavor.name},
    );
  }

  @visibleForTesting
  static Breadcrumb? scrubBreadcrumb(Breadcrumb? crumb) =>
      crumb?.copyWith(message: _mask(crumb.message));
}
