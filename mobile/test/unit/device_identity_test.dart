import 'package:angren_taxi/core/platform/device_identity.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('uz.angren.taxi/device-test');

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('Android: ANDROID_ID olinadi va keshlanadi', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    var calls = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls++;
      return call.method == 'deviceId' ? '9774d56d682e549c' : null;
    });

    final identity = DeviceIdentity(channel);
    expect(await identity.id(), '9774d56d682e549c');
    expect(await identity.id(), '9774d56d682e549c');
    expect(calls, 1);
  });

  test('kanal yo\'q bo\'lsa null — so\'rovlar to\'xtamaydi', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    expect(await DeviceIdentity(channel).id(), isNull);
  });

  test('iOS da sarlavha yuborilmaydi', () async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    expect(await DeviceIdentity(channel).id(), isNull);
  });
}
