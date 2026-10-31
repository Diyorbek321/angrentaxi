// v4 maydonlari: daromaddagi chaqim (§22) va karta to'lovi qaytarilganda
// ulushni qaytarib olish hodisasi (§23).
import 'package:angren_taxi/features/driver/wallet/driver_push_events.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/shared/models/driver_earnings_breakdown.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DriverEarningsPeriod — tips/netWithTips', () {
    test('server qiymatlari olinadi', () {
      final p = DriverEarningsPeriod.fromJson(const {
        'gross': 20000,
        'commission': 2000,
        'net': 18000,
        'trips': 1,
        'tips': 3000,
        'netWithTips': 21000,
      });
      expect(p.net, 18000);
      expect(p.tips, 3000);
      expect(p.netWithTips, 21000);
    });

    test("eski server: tips = 0, netWithTips = net", () {
      final p = DriverEarningsPeriod.fromJson(const {'net': 18000});
      expect(p.tips, 0);
      expect(p.netWithTips, 18000);
      final partial = DriverEarningsPeriod.fromJson(const {'net': 100, 'tips': 50});
      expect(partial.netWithTips, 150);
    });
  });

  group('payment_refund_clawback', () {
    test('push qoldiqni yangilaydi; matn bo\'lmasa — sabab zaxirasi', () {
      const message = DriverPushMessage(
        data: {'event': 'payment_refund_clawback', 'orderId': 'o1'},
      );
      expect(message.action, DriverPushAction.refreshWallet);
      expect(refundClawbackAwareBody(message), contains('qaytarildi'));
      const withBody = DriverPushMessage(
        data: {'event': 'payment_refund_clawback'},
        body: 'Server matni',
      );
      expect(refundClawbackAwareBody(withBody), 'Server matni');
    });

    test('wallet:updated reason=refund_clawback — aniq sabab matni', () {
      final update = WalletUpdate.tryParse({
        'balance': 5000,
        'delta': -12000,
        'reason': 'refund_clawback',
        'orderId': 'o1',
      })!;
      expect(walletUpdateText(update), startsWith("To'lov mijozga qaytarildi"));
    });
  });
}
