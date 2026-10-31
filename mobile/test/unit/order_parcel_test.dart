// Posilka (2-versiya): `details` dan qabul qiluvchi/buyum o'qilishi va
// topshirish PIN kodining modelda yashashi.
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/parcel_info.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _json({String serviceType = 'parcel', Object? details, String? pin}) => {
      'id': 'order-1',
      'passengerId': 'passenger-1',
      'pickup': const {'address': 'A', 'lat': 41.0, 'lng': 70.0},
      'dropoff': const {'address': 'B', 'lat': 41.1, 'lng': 70.1},
      'status': 'in_progress',
      'estimatedPrice': 15000.0,
      'createdAt': '2026-10-05T10:00:00.000Z',
      'serviceType': serviceType,
      if (details != null) 'details': details,
      if (pin != null) 'deliveryPin': pin,
    };

const _details = {
  'recipientPhone': '+998901112233',
  'recipientName': 'Ona',
  'itemDescription': 'Kalitlar',
  'size': 'medium',
};

void main() {
  group('Order — posilka', () {
    test('details posilka ma\'lumotiga aylanadi, PIN saqlanadi', () {
      final order = Order.fromJson(_json(details: _details, pin: '0427'));
      expect(order.isParcel, isTrue);
      expect(order.deliveryPin, '0427');
      expect(
        order.parcel,
        const ParcelInfo(
          recipientPhone: '+998901112233',
          recipientName: 'Ona',
          itemDescription: 'Kalitlar',
          size: kParcelSizeMedium,
        ),
      );
    });

    test('haydovchi javobida PIN bo\'lmaydi — model buni ko\'taradi', () {
      expect(Order.fromJson(_json(details: _details)).deliveryPin, isNull);
    });

    test('boshqa xizmatda details posilka deb o\'qilmaydi', () {
      expect(Order.fromJson(_json(serviceType: 'cargo', details: _details)).parcel, isNull);
    });

    test('buzuq details butun buyurtmani yiqitmaydi', () {
      expect(Order.fromJson(_json(details: const {'size': 'small'})).parcel, isNull);
      expect(Order.fromJson(_json(details: 'not-a-map')).parcel, isNull);
    });

    test("noma'lum o'lcham 'small' ga tushadi", () {
      final d = Map<String, dynamic>.of(_details)..['size'] = 'huge';
      expect(Order.fromJson(_json(details: d)).parcel!.size, kParcelSizeSmall);
    });

    test('copyWith PIN ni yo\'qotmaydi (holat yangilanishlari)', () {
      final order = Order.fromJson(_json(details: _details, pin: '0427'));
      expect(order.copyWith(status: OrderStatus.completed).deliveryPin, '0427');
    });

    test('PIN tenglikda hisobga olinadi (props) — aks holda UI yangilanmasdi', () {
      expect(
        Order.fromJson(_json(details: _details, pin: '0427')) == Order.fromJson(_json(details: _details)),
        isFalse,
      );
    });
  });

  group('ParcelInfo.toDetails', () {
    test('serverga faqat kerakli maydonlar ketadi, bo\'sh ism tashlab yuboriladi', () {
      const parcel = ParcelInfo(
        recipientPhone: '+998901112233',
        recipientName: '',
        itemDescription: 'Hujjat',
        size: kParcelSizeSmall,
      );
      expect(parcel.toDetails(), {
        'recipientPhone': '+998901112233',
        'itemDescription': 'Hujjat',
        'size': 'small',
      });
    });
  });
}
