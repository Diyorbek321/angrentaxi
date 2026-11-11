// To'lovdan qaytish havolasi `angrengo://wallet/topup/<id>`
// (docs/LEGAL-COMPLIANCE.md §24): marshrutni tanish va bosh ekran
// tayyor bo'lguncha saqlab turish.
import 'package:angren_taxi/features/driver/wallet/wallet_deep_links.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

const _uuid = '3f2b8c1e-9a4d-4f6b-8e2a-1c5d7e9f0a12';

void main() {
  group('parseWalletTopupLink', () {
    test("to'liq URI va Flutter bergan yo'l shakllari", () {
      expect(parseWalletTopupLink('angrengo://wallet/topup/$_uuid'), _uuid);
      expect(parseWalletTopupLink('ANGRENGO://wallet/topup/$_uuid/'), _uuid);
      expect(parseWalletTopupLink('angrengo://wallet/topup/$_uuid?x=1'), _uuid);
      expect(parseWalletTopupLink('/topup/$_uuid'), _uuid);
      expect(parseWalletTopupLink('/wallet/topup/$_uuid'), _uuid);
      expect(
        parseWalletTopupLink('https://angrengo.uz/app/wallet/topup/$_uuid'),
        _uuid,
      );
    });

    test('begona yoki buzuq havolalar — null', () {
      for (final link in [
        null,
        '',
        '/',
        '/driver/home',
        '/topup',
        '/topup/',
        '/topup/$_uuid/extra',
        'angrengo://orders/topup/$_uuid',
        'angren-taxi://wallet/topup/$_uuid',
        'https://evil.example/app/wallet/topup/$_uuid',
        'angrengo://wallet/topup/..%2F..%2Fadmin',
        'angrengo://wallet/topup/${'a' * 65}',
      ]) {
        expect(parseWalletTopupLink(link), isNull, reason: '$link');
      }
    });

    test("WebView qaytish sxemasini taniydi", () {
      expect(isAppReturnUrl('angrengo://wallet/topup/$_uuid'), isTrue);
      expect(isAppReturnUrl('https://checkout.paycom.uz/abc'), isFalse);
    });
  });

  group('DriverDeepLinks', () {
    test("bosh ekran tayyor bo'lguncha saqlanadi, keyin bir marta uzatiladi",
        () async {
      final links = DriverDeepLinks();
      final got = <String>[];
      final sub = links.topupLinks.listen(got.add);

      expect(links.handle('/topup/$_uuid'), isTrue);
      await Future<void>.delayed(Duration.zero);
      expect(got, isEmpty);

      links.markReady();
      await Future<void>.delayed(Duration.zero);
      expect(got, [_uuid]);

      // Tayyor bo'lgach — darhol.
      expect(links.handle('angrengo://wallet/topup/abc-1'), isTrue);
      await Future<void>.delayed(Duration.zero);
      expect(got, [_uuid, 'abc-1']);
      await sub.cancel();
    });

    test("begona marshrut iste'mol qilinmaydi (Navigator'ga qoladi)", () async {
      final links = DriverDeepLinks();
      expect(links.handle('/driver/home'), isFalse);
      final consumed = await links.didPushRouteInformation(
        RouteInformation(uri: Uri.parse('/driver/home')),
      );
      expect(consumed, isFalse);
      final ours = await links.didPushRouteInformation(
        RouteInformation(uri: Uri.parse('angrengo://wallet/topup/$_uuid')),
      );
      expect(ours, isTrue);
    });
  });
}
