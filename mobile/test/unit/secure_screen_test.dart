import 'package:angren_taxi/core/platform/secure_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('uz.angren.taxi/secure-test');
  late List<bool> calls;
  late SecureScreen secure;

  setUp(() {
    calls = [];
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add((call.arguments as Map)['secure'] as bool);
      return null;
    });
    secure = SecureScreen(channel);
  });

  tearDown(() => debugDefaultTargetPlatformOverride = null);

  test('ustma-ust ikki ekran: ustidagi yopilganda himoya qoladi', () async {
    secure
      ..acquire()
      ..acquire()
      ..release();
    await pumpEventQueue();
    expect(calls, [true]);

    secure.release();
    await pumpEventQueue();
    expect(calls, [true, false]);
  });

  test('ortiqcha release hisobni manfiyga tushirmaydi', () async {
    secure
      ..release()
      ..acquire();
    await pumpEventQueue();
    expect(calls, [true]);
    expect(secure.holders, 1);
  });
}
