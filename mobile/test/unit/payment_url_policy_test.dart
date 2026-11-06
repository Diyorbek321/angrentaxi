import 'package:angren_taxi/features/payments/payment_url_policy.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('isTrustedCheckoutUrl — serverdan kelgan boshlang\'ich sahifa', () {
    test('provayder sahifalari ochiladi', () {
      expect(isTrustedCheckoutUrl('https://checkout.paycom.uz/bT0xMjM='), isTrue);
      expect(isTrustedCheckoutUrl('https://my.click.uz/services/pay?x=1'), isTrue);
      expect(isTrustedCheckoutUrl('https://uzcard.uz/pay'), isTrue);
    });

    test("begona xost, http va o'xshash nom — rad", () {
      expect(isTrustedCheckoutUrl('https://evil.example/pay'), isFalse);
      expect(isTrustedCheckoutUrl('http://checkout.paycom.uz/x'), isFalse);
      expect(isTrustedCheckoutUrl('https://paycom.uz.evil.com/x'), isFalse);
      expect(isTrustedCheckoutUrl('https://notclick.uz/x'), isFalse);
      expect(isTrustedCheckoutUrl('not a url'), isFalse);
    });

    test("qo'shimcha domen (dart-define) qo'shilishi mumkin", () {
      expect(isTrustedCheckoutUrl('https://pay.uzps.uz/x'), isFalse);
      expect(
        isTrustedCheckoutUrl('https://pay.uzps.uz/x', extraDomains: {'uzps.uz'}),
        isTrue,
      );
    });
  });

  group('classifyPaymentNavigation — sahifa ichidagi o\'tishlar', () {
    test('ilovaga qaytish havolasi', () {
      expect(
        classifyPaymentNavigation('angrengo://wallet/topup/1'),
        PaymentNavigation.appReturn,
      );
    });

    test('https — 3-D Secure bank sahifasi ham — WebView ichida', () {
      expect(
        classifyPaymentNavigation('https://3ds.kapitalbank.uz/acs'),
        PaymentNavigation.allow,
      );
    });

    test('bank ilovasi sxemalari — tashqariga', () {
      expect(
        classifyPaymentNavigation('intent://pay#Intent;scheme=click;end'),
        PaymentNavigation.external,
      );
      expect(classifyPaymentNavigation('click://pay'), PaymentNavigation.external);
      expect(classifyPaymentNavigation('tel:+998901234567'), PaymentNavigation.external);
    });

    test('xavfli sxemalar — bloklanadi', () {
      for (final url in [
        'http://checkout.paycom.uz',
        'javascript:alert(1)',
        'file:///data/data/x',
        'data:text/html,<b>x</b>',
      ]) {
        expect(classifyPaymentNavigation(url), PaymentNavigation.block, reason: url);
      }
    });
  });
}
