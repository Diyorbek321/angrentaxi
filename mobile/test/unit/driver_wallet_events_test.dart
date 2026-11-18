// `wallet:updated` hodisasi va push `data.event` marshrutlash —
// docs/LEGAL-COMPLIANCE.md §17.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/wallet/driver_push_events.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  test('WalletUpdate.tryParse — balans majburiy', () {
    expect(WalletUpdate.tryParse({'delta': 5}), isNull);
    expect(WalletUpdate.tryParse('x'), isNull);
    final u = WalletUpdate.tryParse({
      'balance': 150000,
      'delta': 100000,
      'reason': 'topup',
      'topupId': 't-1',
    })!;
    expect(u.balance, 150000);
    expect(u.topupId, 't-1');
  });

  test('walletUpdateText — sabab bo\'yicha matn', () {
    String text(String reason, double delta) => walletUpdateText(
          WalletUpdate(balance: 0, delta: delta, reason: reason),
        );
    expect(text('topup', 100000),
        'Hamyon to\'ldirildi: +${Formatters.formatPrice(100000)}');
    expect(text('manual_adjustment', -5000),
        'Operator hamyonni tuzatdi: −${Formatters.formatPrice(5000)}');
    expect(text('shift_pass_refund', 12000), startsWith('Smena puli qaytarildi'));
    expect(text('vendor_settlement_reversal', 85000),
        startsWith("Do'konga o'tkazma qaytarildi"));
    expect(text('topup_reversal', -100000), startsWith('To\'ldirish bekor'));
    expect(text('something_new', 1), startsWith('Hamyon yangilandi'));
  });

  test('push hodisalari: qaysi biri nima qiladi', () {
    expect(driverPushAction('courier_wallet_settlement_reminder'),
        DriverPushAction.openTopup);
    for (final e in [
      'wallet_topup_paid',
      'wallet_topup_reversed',
      'wallet_manual_adjustment',
      'shift_pass_cancelled',
    ]) {
      expect(driverPushAction(e), DriverPushAction.refreshWallet, reason: e);
    }
    expect(driverPushAction('order_new'), DriverPushAction.none);
    expect(driverPushAction(null), DriverPushAction.none);
  });

  test('DriverProvider.applyWalletUpdate qoldiqni yangilaydi va oqimga uzatadi',
      () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final provider = DriverProvider(
      apiClient: MockApiClient(),
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: LocalStorage(prefs),
    );
    final events = <WalletUpdate>[];
    final sub = provider.walletUpdates.listen(events.add);
    var notified = 0;
    provider.addListener(() => notified++);

    const update =
        WalletUpdate(balance: -2000, delta: -5000, reason: 'manual_adjustment');
    provider.applyWalletUpdate(update);
    await Future<void>.delayed(Duration.zero);

    expect(provider.walletBalance, -2000);
    expect(provider.hasWalletDebt, isTrue);
    expect(events, [update]);
    expect(notified, greaterThan(0));
    await sub.cancel();
    provider.dispose();
  });
}
