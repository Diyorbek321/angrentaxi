import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/driver/widgets/delivery_info_card.dart';
import 'package:angren_taxi/features/driver/widgets/parcel_info_card.dart';
import 'package:angren_taxi/features/safety/call_relay.dart';
import 'package:angren_taxi/features/safety/contact_relay_service.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/parcel_info.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _FakeRelay extends ContactRelayService {
  _FakeRelay() : super(_MockApiClient(), apiBaseUrl: 'https://api.test');

  @override
  Future<String> counterpartyPhone(String orderId) async => '+998905550000';

  @override
  Future<String> recipientPhone(String orderId) async => '+998901112233';
}

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

  testWidgets("dropoff with orderId — customer is called via the relay, raw phone ignored (§4)",
      (tester) async {
    final dialled = <String>[];
    final relayDials = <Uri>[];
    CallRelay.service = () => _FakeRelay();
    CallRelay.dial = (uri) async {
      relayDials.add(uri);
      return true;
    };
    addTearDown(() => CallRelay.dial = (uri) async => false);

    await tester.pumpWidget(_wrap(DeliveryInfoCard(
      delivery: const DeliveryInfo(vendorName: 'Lavash', payVendor: 0, collectCash: 0, itemsCount: 1),
      stage: DeliveryCardStage.dropoff,
      orderId: 'ride-1',
      onCall: (phone) async => dialled.add(phone),
    )));
    await tester.tap(find.byIcon(Icons.call));
    await tester.pump();

    expect(dialled, isEmpty);
    expect(relayDials.single.toString(), 'tel:+998905550000');
  });

  testWidgets('parcel: only the mask is shown, the recipient is called via the relay (§4)', (tester) async {
    final relayDials = <Uri>[];
    CallRelay.service = () => _FakeRelay();
    CallRelay.dial = (uri) async {
      relayDials.add(uri);
      return true;
    };
    addTearDown(() => CallRelay.dial = (uri) async => false);

    await tester.pumpWidget(_wrap(const ParcelInfoCard(
      parcel: ParcelInfo(recipientPhone: '+998 90 *** ** 33', itemDescription: 'Kalit', size: kParcelSizeSmall),
      stage: DeliveryCardStage.dropoff,
      orderId: 'ride-1',
    )));
    expect(find.text('+998 90 *** ** 33'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.call));
    await tester.pump();
    expect(relayDials.single.toString(), 'tel:+998901112233');
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
