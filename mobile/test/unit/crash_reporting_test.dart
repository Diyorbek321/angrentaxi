// Sentry: DSN bo'lmasa o'chiq; yoqilganda shaxsiy ma'lumot chet elga ketmaydi.
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/observability/crash_reporting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

void main() {
  test('DSN bo\'lmasa Sentry ishga tushmaydi, ilova odatdagidek ochiladi', () async {
    var ran = false;
    await CrashReporting.run(
      flavor: AppFlavor.passenger,
      dsn: '',
      appRunner: () => ran = true,
    );
    expect(ran, isTrue);
    expect(CrashReporting.isEnabled, isFalse);
  });

  test('sozlamalar: PII, skrinshot va tracing o\'chiq', () {
    final options = SentryFlutterOptions(dsn: 'https://key@o1.ingest.sentry.io/1');
    CrashReporting.configure(options, dsn: 'https://key@o1.ingest.sentry.io/1', flavor: AppFlavor.driver);
    expect(options.sendDefaultPii, isFalse);
    expect(options.attachScreenshot, isFalse);
    expect(options.attachViewHierarchy, isFalse);
    expect(options.tracesSampleRate, isNull);
    expect(options.beforeSend, isNotNull);
    expect(options.beforeBreadcrumb, isNotNull);
  });

  test('hodisa tozalanadi: IP, telefon, sarlavhalar; flavor tegi qo\'shiladi', () {
    final event = SentryEvent(
      message: const SentryMessage('Login +998901234567 failed'),
      exceptions: const [SentryException(type: 'DioException', value: 'phone=998931913308')],
      user: SentryUser(id: 'u-1', ipAddress: '1.2.3.4', username: '+998901234567'),
      request: SentryRequest(
        url: 'https://api/x',
        headers: const {'Authorization': 'Bearer t', 'Accept': 'json'},
        cookies: 'a=b',
        data: const {'phone': '+998901234567'},
      ),
    );
    final scrubbed = CrashReporting.scrubEvent(event, flavor: AppFlavor.passenger);
    expect(scrubbed.message?.formatted, 'Login +998*** failed');
    expect(scrubbed.exceptions!.single.value, 'phone=998***');
    expect(scrubbed.user?.id, 'u-1');
    expect(scrubbed.user?.ipAddress, isNull);
    expect(scrubbed.user?.username, isNull);
    expect(scrubbed.request?.headers, {'Accept': 'json'});
    expect(scrubbed.request?.cookies, isNull);
    expect(scrubbed.request?.data, isNull);
    expect(scrubbed.tags?['flavor'], 'passenger');
  });

  test('breadcrumb xabaridagi telefon ham yashiriladi', () {
    final crumb = Breadcrumb(message: 'OTP sent to +998901234567');
    expect(CrashReporting.scrubBreadcrumb(crumb)?.message, 'OTP sent to +998***');
  });
}
