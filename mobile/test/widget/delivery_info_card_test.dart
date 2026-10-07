import 'package:angren_taxi/features/driver/widgets/delivery_info_card.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

const _cash = DeliveryInfo(
  vendorName: 'Osh Markazi',
  vendorPhone: '+998901112233',
  customerPhone: '+998907778899',
  itemsCount: 3,
  collectCash: 75000,
  payVendor: 65000,
);

void main() {
  testWidgets('shows the cash to collect and the item count', (tester) async {
    await tester.pumpWidget(_wrap(
      const DeliveryInfoCard(delivery: _cash, stage: DeliveryCardStage.offer),
    ));

    expect(find.text('Mijozdan naqd oling'), findsOneWidget);
    expect(find.textContaining('75'), findsOneWidget);
    expect(find.text('Osh Markazi'), findsOneWidget);
    expect(find.text('3 ta mahsulot'), findsOneWidget);
    // On the offer there is nobody to call yet.
    expect(find.byIcon(Icons.call), findsNothing);
  });

  testWidgets('says there is nothing to collect on a card-paid order',
      (tester) async {
    await tester.pumpWidget(_wrap(const DeliveryInfoCard(
      delivery: DeliveryInfo(vendorName: "Do'kon", itemsCount: 1, collectCash: 0),
      stage: DeliveryCardStage.offer,
    )));

    expect(find.text("Onlayn to'langan — pul olmaysiz"), findsOneWidget);
    expect(find.text('Mijozdan naqd oling'), findsNothing);
  });

  testWidgets('calls the vendor at pickup and the customer at dropoff',
      (tester) async {
    final dialled = <String>[];
    Future<void> dial(String phone) async => dialled.add(phone);

    await tester.pumpWidget(_wrap(DeliveryInfoCard(
      delivery: _cash,
      stage: DeliveryCardStage.pickup,
      onCall: dial,
    )));
    await tester.tap(find.byIcon(Icons.call));

    await tester.pumpWidget(_wrap(DeliveryInfoCard(
      delivery: _cash,
      stage: DeliveryCardStage.dropoff,
      onCall: dial,
    )));
    await tester.tap(find.byIcon(Icons.call));

    expect(dialled, ['+998901112233', '+998907778899']);
  });

  testWidgets('before pickup the courier sees what to pay the vendor', (tester) async {
    await tester.pumpWidget(_wrap(
      const DeliveryInfoCard(delivery: _cash, stage: DeliveryCardStage.offer),
    ));
    expect(find.text("Do'konga o'zingiz to'laysiz"), findsOneWidget);
    expect(find.textContaining('65'), findsOneWidget);
  });

  testWidgets('after pickup the vendor line is gone — only the customer cash', (tester) async {
    await tester.pumpWidget(_wrap(
      const DeliveryInfoCard(delivery: _cash, stage: DeliveryCardStage.dropoff),
    ));
    expect(find.text("Do'konga o'zingiz to'laysiz"), findsNothing);
    expect(find.text('Mijozdan naqd oling'), findsOneWidget);
  });

  test('payVendor is read from the ride details', () {
    final info = DeliveryInfo.fromDetails({
      'foodOrderId': 'fo-1',
      'vendorName': 'Osh Markazi',
      'collectCash': 75000,
      'payVendor': 65000,
    });
    expect(info?.payVendor, 65000);
    expect(info?.mustPayVendor, isTrue);
    expect(DeliveryInfo.fromDetails({'foodOrderId': 'fo-1'})?.mustPayVendor, isFalse);
  });
}
