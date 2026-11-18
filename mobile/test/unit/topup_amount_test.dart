// Hamyonni to'ldirish summasi tekshiruvi — docs/LEGAL-COMPLIANCE.md §11.
import 'package:angren_taxi/features/driver/wallet/topup_amount.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const min = 10000.0;
  const max = 2000000.0;

  group('TopupAmount.parse', () {
    test('ajratgichlar va valyuta so\'zi tashlanadi', () {
      expect(TopupAmount.parse('100000'), 100000);
      expect(TopupAmount.parse('100 000'), 100000);
      expect(TopupAmount.parse('100,000'), 100000);
      expect(TopupAmount.parse("50 000 so'm"), 50000);
      expect(TopupAmount.parse('50 000 сум'), 50000);
    });

    test('raqam bo\'lmasa null', () {
      expect(TopupAmount.parse(''), isNull);
      expect(TopupAmount.parse('abc'), isNull);
      expect(TopupAmount.parse('12a'), isNull);
    });
  });

  group('TopupAmount.validate', () {
    test('bo\'sh / noto\'g\'ri / chegaradan tashqari', () {
      expect(TopupAmount.validate('', min: min, max: max), TopupAmountError.empty);
      expect(TopupAmount.validate('  ', min: min, max: max), TopupAmountError.empty);
      expect(TopupAmount.validate('abc', min: min, max: max), TopupAmountError.invalid);
      expect(TopupAmount.validate('0', min: min, max: max), TopupAmountError.invalid);
      expect(TopupAmount.validate('9999', min: min, max: max), TopupAmountError.belowMin);
      expect(TopupAmount.validate('2000001', min: min, max: max), TopupAmountError.aboveMax);
    });

    test('chegaralar o\'zi qabul qilinadi', () {
      expect(TopupAmount.validate('10000', min: min, max: max), isNull);
      expect(TopupAmount.validate('2 000 000', min: min, max: max), isNull);
      expect(TopupAmount.validate('100000', min: min, max: max), isNull);
    });

    test('xabar matni summani o\'z ichiga oladi', () {
      final msg = TopupAmount.message(TopupAmountError.belowMin, min: min, max: max);
      expect(msg, startsWith('Eng kam summa'));
      expect(msg, contains('10'));
    });
  });

  group('PublicSettings / WalletTopup', () {
    test('sozlamalar va standartlar', () {
      final s = PublicSettings.fromJson(const {
        'supportPhone': '+998712000000',
        'walletTopupEnabled': true,
        'walletTopupMin': 5000,
        'walletTopupMax': 500000,
        'walletTopupPresets': [20000, 50000],
        'vendorSettlementMode': 'wallet',
      });
      expect(s.walletTopupEnabled, isTrue);
      expect(s.walletTopupPresets, [20000, 50000]);
      expect(s.isVendorWalletMode, isTrue);
      expect(PublicSettings.fromJson(const {}).walletTopupEnabled, isFalse);
    });

    test('yaratish javobi: topupId + checkoutUrl', () {
      final t = WalletTopup.fromJson(const {
        'id': 't-1',
        'topupId': 't-1',
        'checkoutUrl': 'https://checkout.paycom.uz/abc',
        'amount': 50000,
        'provider': 'payme',
        'status': 'pending',
        'createdAt': '2026-10-15T10:00:00.000Z',
      });
      expect(t.id, 't-1');
      expect(t.checkoutUrl, isNotNull);
      expect(t.status, WalletTopupStatus.pending);
      expect(t.status.isFinal, isFalse);
      expect(WalletTopupStatus.paid.isFinal, isTrue);
    });
  });
}
