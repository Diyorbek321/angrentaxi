// "Tez foyda" to'plami: yana buyurtma qilish rejasi, bepul yetkazish
// chegarasi va saqlangan manzil tafsilotlari.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/reorder.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

CartItem _item(String id, double price) =>
    CartItem(id: id, name: id, price: price, qty: 1, icon: Icons.fastfood, color: Colors.orange);

CartItem _line(String id, int qty) => _item(id, 0).copyWith(qty: qty);

void main() {
  group('planReorder', () {
    test('joriy narx bilan, eski miqdorda qayta tuzadi', () {
      final plan = planReorder(
        const [ReorderLine(id: 'a', qty: 2), ReorderLine(id: 'b', qty: 1)],
        {'a': _item('a', 15000), 'b': _item('b', 8000)},
      );
      expect(plan.isPartial, isFalse);
      expect(plan.items.map((i) => (i.id, i.qty, i.price)).toList(),
          [('a', 2, 15000.0), ('b', 1, 8000.0)]);
    });

    test('menyuda yo\'q taom tushib qoladi va sanaladi', () {
      final plan = planReorder(
        const [ReorderLine(id: 'a', qty: 1), ReorderLine(id: 'gone', qty: 3)],
        {'a': _item('a', 10000)},
      );
      expect(plan.items.single.id, 'a');
      expect(plan.missing, 1);
      expect(plan.isPartial, isTrue);
    });

    test('zaxiradan oshmaydi, qisqartirilgani ham sanaladi; zaxira 0 — tushadi', () {
      final plan = planReorder(
        const [ReorderLine(id: 'a', qty: 5), ReorderLine(id: 'b', qty: 2)],
        {'a': _item('a', 5000), 'b': _item('b', 3000)},
        maxQty: (id) => id == 'a' ? 3 : 0,
      );
      expect(plan.items.single.qty, 3);
      expect(plan.missing, 2);
    });

    test('hech narsa topilmasa bo\'sh', () {
      final plan = planReorder(const [ReorderLine(id: 'x', qty: 1)], const {});
      expect(plan.isEmpty, isTrue);
    });
  });

  group('SuperappProvider — bepul yetkazish', () {
    late SuperappProvider provider;
    setUp(() => provider = SuperappProvider(apiClient: _MockApiClient()));

    test('chegara yo\'q — oddiy narx, qoldiq null', () {
      provider.debugSetDeliveryPricingForTest(deliveryFee: 7000);
      provider.addToCart(_line('a', 1).copyWith(qty: 1));
      expect(provider.freeDeliveryFrom, isNull);
      expect(provider.freeDeliveryRemaining, isNull);
    });

    test('chegaragacha — narx olinadi, qoldiq ko\'rsatiladi; teng bo\'lsa bepul', () {
      provider.debugSetDeliveryPricingForTest(deliveryFee: 7000, freeDeliveryFrom: 100000);
      provider.addToCart(_item('a', 40000).copyWith(qty: 2));
      expect(provider.deliveryFee, 7000);
      expect(provider.freeDeliveryRemaining, 20000);
      expect(provider.cartTotal, 87000);

      provider.increment('a'); // 120 000 — chegaradan oshdi
      expect(provider.isFreeDelivery, isTrue);
      expect(provider.deliveryFee, 0);
      expect(provider.freeDeliveryRemaining, isNull);
      expect(provider.cartTotal, 120000);
    });

    test('0 chegara — o\'chiq', () {
      provider.debugSetDeliveryPricingForTest(deliveryFee: 7000, freeDeliveryFrom: 0);
      provider.addToCart(_item('a', 500000));
      expect(provider.isFreeDelivery, isFalse);
      expect(provider.deliveryFee, 7000);
    });

    test('loadPlatformSettings chegarani va vaqtni o\'qiydi; noto\'g\'ri vaqt e\'tiborsiz', () async {
      final api = _MockApiClient();
      provider = SuperappProvider(apiClient: api);
      when(() => api.get(ApiEndpoints.settingsPublic)).thenAnswer((_) async => Response<dynamic>(
            requestOptions: RequestOptions(path: ApiEndpoints.settingsPublic),
            data: {
              'success': true,
              'data': {
                'deliveryFee': 8000,
                'freeDeliveryFrom': 150000,
                'deliveryEtaMinMinutes': 25,
                'deliveryEtaMaxMinutes': 40,
              },
            },
          ));
      await provider.loadPlatformSettings();
      expect(provider.baseDeliveryFee, 8000);
      expect(provider.freeDeliveryFrom, 150000);
      expect(provider.deliveryEta, (min: 25, max: 40));

      when(() => api.get(ApiEndpoints.settingsPublic)).thenAnswer((_) async => Response<dynamic>(
            requestOptions: RequestOptions(path: ApiEndpoints.settingsPublic),
            data: {
              'success': true,
              'data': {'deliveryFee': 8000, 'deliveryEtaMinMinutes': 50, 'deliveryEtaMaxMinutes': 20},
            },
          ));
      await provider.loadPlatformSettings();
      expect(provider.deliveryEta, (min: 25, max: 40), reason: 'min > max — eski qiymat qoladi');
    });
  });

  group('FavoriteAddress.addressDetails', () {
    test('o\'qiladi va toJson ga qaytadi; eski server — null', () {
      final f = FavoriteAddress.fromJson(const {
        'id': 'f1',
        'label': 'Uy',
        'address': 'Navoiy 12',
        'lat': 41.0,
        'lng': 70.1,
        'addressDetails': {'entrance': '2', 'floor': '5', 'landmark': ' '},
      });
      expect(f.addressDetails?.entrance, '2');
      expect(f.addressDetails?.landmark, isNull);
      expect(f.toJson()['addressDetails'], {'entrance': '2', 'floor': '5'});

      final old = FavoriteAddress.fromJson(const {'id': 'f2', 'label': 'Ish', 'address': 'x', 'lat': 1, 'lng': 2});
      expect(old.addressDetails, isNull);
      expect(old.toJson().containsKey('addressDetails'), isFalse);
    });
  });
}
