// ignore_for_file: prefer_const_literals_to_create_immutables
// docs/specs/food-market-ux-v5.md — ilova tomonidagi model qoidalari:
// bekor qilish ko'rinishi, manzil tafsilotlari, promokod/aksiya maydonlari.
// Eski server maydonlarni bermasa ham hammasi ishlashi shart.
import 'package:angren_taxi/features/superapp/state/vendor_order_actions.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/dish.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _food(String status, {bool? canCancel, Object? details}) => {
      'id': 'o1',
      'restaurantId': 'r1',
      'status': status,
      'items': <dynamic>[],
      'deliveryAddress': 'Navoiy 1',
      'totalPrice': 30000,
      'createdAt': '2026-10-16T10:00:00.000Z',
      if (canCancel != null) 'canCancel': canCancel,
      if (details != null) 'addressDetails': details,
    };

void main() {
  group('canCancel (cancel visibility)', () {
    test('eski server (bayroqsiz): faqat `new` holatda', () {
      expect(FoodOrder.fromJson(_food('new')).canCancel, isTrue);
      expect(FoodOrder.fromJson(_food('preparing')).canCancel, isFalse);
      expect(FoodOrder.fromJson(_food('ready')).canCancel, isFalse);
      expect(FoodOrder.fromJson(_food('delivered')).canCancel, isFalse);
    });

    test('server bayrog\'i ustun turadi', () {
      expect(FoodOrder.fromJson(_food('new', canCancel: false)).canCancel, isFalse);
      expect(FoodOrder.fromJson(_food('preparing', canCancel: true)).canCancel, isTrue);
    });

    test('tugagan/bekor qilingan buyurtma hech qachon bekor qilinmaydi', () {
      expect(FoodOrder.fromJson(_food('cancelled', canCancel: true)).canCancel, isFalse);
      expect(FoodOrder.fromJson(_food('delivered', canCancel: true)).canCancel, isFalse);
    });

    test('holat socket orqali o\'zgarsa eski bayroq tashlanadi', () {
      final order = FoodOrder.fromJson(_food('new', canCancel: true));
      expect(order.copyWith(status: FoodOrderStatus.preparing).canCancel, isFalse);
    });

    test('market ham xuddi shu qoida', () {
      final json = {
        'id': 'm1',
        'storeId': 's1',
        'status': 'new',
        'items': <dynamic>[],
        'totalPrice': 1000,
        'createdAt': '2026-10-16T10:00:00.000Z',
      };
      expect(MarketOrder.fromJson(json).canCancel, isTrue);
      expect(MarketOrder.fromJson({...json, 'status': 'packing'}).canCancel, isFalse);
    });
  });

  group('AddressDetails', () {
    test('bo\'sh maydonlar tashlanadi, uzunlar server chegarasiga qisqaradi', () {
      final d = AddressDetails.normalized(
        entrance: ' 2 ',
        floor: '',
        apartment: '45',
        landmark: 'x' * 300,
      );
      expect(d.toJson(), {'entrance': '2', 'apartment': '45', 'landmark': 'x' * 120});
    });

    test('buyurtma JSON\'idan o\'qiladi; null/bo\'sh — null', () {
      expect(FoodOrder.fromJson(_food('new')).addressDetails, isNull);
      expect(FoodOrder.fromJson(_food('new', details: {'floor': ''})).addressDetails, isNull);
      final o = FoodOrder.fromJson(_food('new', details: {'floor': '3', 'intercom': '45K'}));
      expect(o.addressDetails, const AddressDetails(floor: '3', intercom: '45K'));
    });

    test('withOrderExtras bo\'sh qiymatlarni yubormaydi (eski server rad etadi)', () {
      final base = {'restaurantId': 'r1'};
      expect(withOrderExtras(base, promoCode: '  ', addressDetails: const AddressDetails()), base);
      expect(
        withOrderExtras(base, promoCode: 'angren', addressDetails: const AddressDetails(floor: '3')),
        {
          'restaurantId': 'r1',
          'promoCode': 'ANGREN',
          'addressDetails': {'floor': '3'},
        },
      );
    });
  });

  group('aksiyalar', () {
    test('taom: finalPrice va discount; eski serverda oddiy narx', () {
      final plain = Dish.fromJson({'id': 'd', 'name': 'Osh', 'price': 30000});
      expect(plain.effectivePrice, 30000);
      expect(plain.hasDiscount, isFalse);

      final discounted = Dish.fromJson({
        'id': 'd',
        'name': 'Osh',
        'price': 30000,
        'finalPrice': 24000,
        'discount': {'title': 'Kuz', 'discountType': 'percent', 'discountValue': 20},
      });
      expect(discounted.effectivePrice, 24000);
      expect(discounted.hasDiscount, isTrue);
      expect(discounted.discount!.shortLabel, '−20%');
    });

    test('finalPrice asl narxdan katta yoki 0 bo\'lsa e\'tiborsiz', () {
      final d = Dish.fromJson({'id': 'd', 'name': 'O', 'price': 1000, 'finalPrice': 0});
      expect(d.effectivePrice, 1000);
    });

    test('restoran activePromotion va lenta elementlari', () {
      final r = FoodRestaurant.fromJson({
        'id': 'r',
        'name': 'R',
        'activePromotion': {'title': 'T', 'discountType': 'fixed', 'discountValue': 5000},
      });
      expect(r.activePromotion!.discountType, DiscountType.fixed);

      final list = ActivePromotion.parseList([
        {
          'id': 'p1',
          'title': '−30% palov',
          'discountType': 'percent',
          'discountValue': 30,
          'vendorType': 'restaurant',
          'vendorId': 'r1',
          'vendorName': 'Osh Markazi',
          'endsAt': null,
        },
        {'id': 'broken'},
      ]);
      expect(list, hasLength(1));
      expect(list.single.vendorName, 'Osh Markazi');
      expect(ActivePromotion.parseList(null), isEmpty);
    });
  });
}
