import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _orderJson({Object? details, String serviceType = 'food'}) => {
      'id': 'ride-1',
      'passengerId': 'customer-1',
      'pickup': {'address': 'Osh Markazi', 'lat': 41.02, 'lng': 70.14},
      'dropoff': {'address': 'Navoiy 5', 'lat': 41.03, 'lng': 70.15},
      'status': 'searching',
      'estimatedPrice': 12000,
      'createdAt': '2026-09-27T10:00:00.000Z',
      'serviceType': serviceType,
      'details': details,
    };

void main() {
  test('parses courier details from a food ride', () {
    final order = Order.fromJson(_orderJson(details: {
      'foodOrderId': 'food-1',
      'vendorName': 'Osh Markazi',
      'vendorPhone': '+998901112233',
      'customerPhone': '+998907778899',
      'itemsCount': 3,
      'collectCash': 75000,
    }));

    expect(order.isDelivery, isTrue);
    expect(order.delivery, const DeliveryInfo(
      vendorName: 'Osh Markazi',
      vendorPhone: '+998901112233',
      customerPhone: '+998907778899',
      itemsCount: 3,
      collectCash: 75000,
    ));
    expect(order.delivery!.mustCollectCash, isTrue);
  });

  test('card-paid delivery has nothing to collect', () {
    final order = Order.fromJson(_orderJson(details: {
      'marketOrderId': 'm-1',
      'vendorName': "Do'kon",
      'collectCash': 0,
    }));
    expect(order.delivery!.mustCollectCash, isFalse);
  });

  test('taxi rides carry no delivery info', () {
    final order = Order.fromJson(_orderJson(details: null, serviceType: 'taxi'));
    expect(order.delivery, isNull);
    expect(order.isDelivery, isFalse);
  });

  test('a food ride without details is still recognised as a delivery', () {
    final order = Order.fromJson(_orderJson(details: null));
    expect(order.delivery, isNull);
    expect(order.isDelivery, isTrue);
  });

  test('malformed details do not break parsing', () {
    final order = Order.fromJson(_orderJson(details: {
      'foodOrderId': 'food-1',
      'itemsCount': 'many',
      'collectCash': null,
    }));
    expect(order.delivery!.itemsCount, 0);
    expect(order.delivery!.collectCash, 0);
  });
}
