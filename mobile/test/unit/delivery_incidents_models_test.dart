// Yetkazish hodisalari (docs/INCIDENT-POLICY.md §2) — modellar va yordamchilar:
// Order/CourierTracking/FoodOrder/MarketOrder yangi maydonlari, holat matnlari,
// PublicSettings standartlari, posilka qiymati va cargo details.
import 'package:angren_taxi/features/superapp/screens/cargo_screen.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/parcel_info.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _ride({
  String status = 'in_progress',
  String serviceType = 'food',
  Map<String, dynamic> extra = const {},
}) =>
    {
      'id': 'ride-1',
      'passengerId': 'p-1',
      'pickup': const {'address': 'Restoran', 'lat': 41.0, 'lng': 70.0},
      'dropoff': const {'address': 'Uy', 'lat': 41.1, 'lng': 70.1},
      'status': status,
      'estimatedPrice': 12000,
      'createdAt': '2026-11-03T10:00:00.000Z',
      'serviceType': serviceType,
      ...extra,
    };

Map<String, dynamic> _vendor(String status, {Map<String, dynamic> extra = const {}}) => {
      'id': 'vo-1',
      'restaurantId': 'r-1',
      'storeId': 's-1',
      'status': status,
      'items': const [],
      'deliveryAddress': 'Uy',
      'totalPrice': 57000,
      'createdAt': '2026-11-03T10:00:00.000Z',
      ...extra,
    };

void main() {
  group('Order — yetkazish hodisalari', () {
    test('yangi maydonlar o\'qiladi, qaytarish yo\'li aniqlanadi', () {
      final order = Order.fromJson(_ride(extra: {
        'dropoffArrivedAt': '2026-11-03T10:20:00.000Z',
        'deliveryFailedAt': '2026-11-03T10:26:00.000Z',
        'deliveryFailureReason': 'customer_refused',
      }));
      expect(order.dropoffArrivedAt, DateTime.utc(2026, 11, 3, 10, 20).toLocal());
      expect(order.deliveryFailureReason, kFailReasonCustomerRefused);
      expect(order.isReturning, isTrue);
      expect(order.isReturned, isFalse);
    });

    test('yakunlangan qaytarish: deliveryOutcome + fareBreakdown.returnFare', () {
      final order = Order.fromJson(_ride(status: 'completed', extra: {
        'deliveryOutcome': 'returned',
        'returnedAt': '2026-11-03T10:50:00.000Z',
        'fareBreakdown': {'total': 18000, 'returnFare': 6000},
      }));
      expect(order.isReturned, isTrue);
      expect(order.isReturning, isFalse);
      expect(order.returnFare, 6000);
      expect(order.returnedAt, isNotNull);
    });

    test('maydonlar yo\'q yoki buzuq — yiqilmaydi, null', () {
      final order = Order.fromJson(_ride(extra: {
        'dropoffArrivedAt': 'not-a-date',
        'deliveryFailureReason': 42,
        'fareBreakdown': 'x',
      }));
      expect(order.dropoffArrivedAt, isNull);
      expect(order.deliveryFailureReason, isNull);
      expect(order.returnFare, isNull);
      expect(order.isReturning, isFalse);
    });

    test('topshirish kodi: posilka, ovqat, market — ha; cargo, taksi — yo\'q', () {
      for (final t in ['parcel', 'food', 'market']) {
        expect(Order.fromJson(_ride(serviceType: t)).requiresHandoverCode, isTrue, reason: t);
      }
      for (final t in ['cargo', 'taxi']) {
        expect(Order.fromJson(_ride(serviceType: t)).requiresHandoverCode, isFalse, reason: t);
      }
    });

    test('kuryer kodni faqat server so\'raganda kiritadi', () {
      Order ride(Map<String, dynamic> details) =>
          Order.fromJson(_ride(extra: {'details': details}));

      expect(Order.fromJson(_ride(serviceType: 'parcel')).asksHandoverCode, isTrue);
      expect(ride({'foodOrderId': 'f-1'}).requiresHandoverCode, isTrue);
      expect(ride({'foodOrderId': 'f-1'}).asksHandoverCode, isFalse);
      expect(ride({'foodOrderId': 'f-1', 'handoverCode': true}).asksHandoverCode, isTrue);
    });

    test('copyWith yangi maydonlarni saqlaydi va tenglikda hisobga oladi', () {
      final base = Order.fromJson(_ride());
      final arrived = base.copyWith(dropoffArrivedAt: DateTime(2026, 11, 3, 15));
      expect(arrived == base, isFalse);
      expect(arrived.copyWith(status: OrderStatus.inProgress).dropoffArrivedAt, DateTime(2026, 11, 3, 15));
    });

    test('sabab matnlari — har biri bor, noma\'lumi null', () {
      for (final r in kDeliveryFailureReasons) {
        expect(deliveryFailureReasonLabel(r), isNotEmpty);
      }
      expect(deliveryFailureReasonLabel('other'), isNull);
      expect(deliveryFailureReasonLabel(kFailReasonCustomerAbsent), "Mijoz yo'q");
    });
  });

  group('CourierTracking', () {
    test('kod, eshik oldida va qaytarish maydonlari', () {
      final t = CourierTracking.tryParse({
        'orderId': 'ride-1',
        'status': 'in_progress',
        'dropoffArrivedAt': '2026-11-03T10:20:00.000Z',
        'handoverCode': '0427',
      })!;
      expect(t.handoverCode, '0427');
      expect(t.isAtDoor, isTrue);

      final failed = CourierTracking.tryParse({
        'orderId': 'ride-1',
        'status': 'in_progress',
        'dropoffArrivedAt': '2026-11-03T10:20:00.000Z',
        'deliveryFailedAt': '2026-11-03T10:26:00.000Z',
        'deliveryFailureReason': 'unreachable',
      })!;
      expect(failed.isAtDoor, isFalse);
      expect(failed.deliveryFailureReason, 'unreachable');
    });

    test('withDropoffArrived — server vaqti bo\'lsa o\'zgartirmaydi', () {
      final t = CourierTracking.tryParse({'orderId': 'r', 'status': 'in_progress'})!;
      final at = DateTime(2026, 11, 3, 15);
      expect(t.withDropoffArrived(at).dropoffArrivedAt, at);
      expect(t.withDropoffArrived(at).withDropoffArrived(DateTime(2030)).dropoffArrivedAt, at);
    });
  });

  group('FoodOrder / MarketOrder — returning/returned', () {
    test('holatlar o\'qiladi va matnlari bor (exhaustive)', () {
      expect(foodOrderStatusFromString('returning'), FoodOrderStatus.returning);
      expect(foodOrderStatusFromString('returned'), FoodOrderStatus.returned);
      expect(marketOrderStatusFromString('returning'), MarketOrderStatus.returning);
      expect(marketOrderStatusFromString('returned'), MarketOrderStatus.returned);
      for (final s in FoodOrderStatus.values) {
        expect(s.label, isNotEmpty);
      }
      for (final s in MarketOrderStatus.values) {
        expect(s.label, isNotEmpty);
      }
      expect(FoodOrderStatus.returning.label, 'Qaytarilmoqda');
      expect(MarketOrderStatus.returned.label, 'Qaytarildi');
    });

    test('qaytarish faol emas — bekor qilish va kuzatuv yo\'q', () {
      final order = FoodOrder.fromJson(_vendor('returning', extra: {
        'delivery': {'orderId': 'ride-1', 'status': 'in_progress'},
      }));
      expect(order.status.isActive, isFalse);
      expect(order.status.isReturnFlow, isTrue);
      expect(order.canCancel, isFalse);
      expect(order.isTrackable, isFalse);
    });

    test('returnCharge/refundDue — son yoki decimal satr', () {
      final food = FoodOrder.fromJson(_vendor('returned', extra: {
        'returnCharge': '10500.00',
        'refundDue': 46500,
        'refundStatus': 'pending',
        'returnedAt': '2026-11-03T11:00:00.000Z',
      }));
      expect(food.returnCharge, 10500);
      expect(food.refundDue, 46500);
      expect(food.refundStatus, 'pending');
      expect(food.returnedAt, isNotNull);

      final market = MarketOrder.fromJson(_vendor('returned', extra: {'returnCharge': 9000}));
      expect(market.returnCharge, 9000);
      expect(market.refundDue, isNull);
    });

    test('copyWith socket qiymatlarini qo\'shadi, eskisini yo\'qotmaydi', () {
      final order = FoodOrder.fromJson(_vendor('returning', extra: {'refundStatus': 'pending'}));
      final next = order.copyWith(status: FoodOrderStatus.returned, returnCharge: 10500, refundDue: 46500);
      expect(next.status, FoodOrderStatus.returned);
      expect(next.returnCharge, 10500);
      expect(next.refundDue, 46500);
      expect(next.refundStatus, 'pending');
      expect(next.copyWith(status: FoodOrderStatus.returned).returnCharge, 10500);
    });
  });

  group('PublicSettings — hodisa sozlamalari', () {
    test('kelmasa standart 1 000 000 / 5 / 50', () {
      final s = PublicSettings.fromJson(const {});
      expect(s.parcelMaxDeclaredValue, 1000000);
      expect(s.dropoffFreeWaitMinutes, 5);
      expect(s.returnFeePercent, 50);
      expect(PublicSettings.defaults.returnFeePercent, 50);
    });

    test('serverdan o\'qiladi', () {
      final s = PublicSettings.fromJson(const {
        'parcelMaxDeclaredValue': 2000000,
        'dropoffFreeWaitMinutes': 7,
        'returnFeePercent': 30,
      });
      expect(s.parcelMaxDeclaredValue, 2000000);
      expect(s.dropoffFreeWaitMinutes, 7);
      expect(s.returnFeePercent, 30);
    });
  });

  group('Posilka — qiymat va taqiqlangan narsalar', () {
    test('parseDeclaredValue: 1..max butun son', () {
      expect(parseDeclaredValue('150000', 1000000), 150000);
      expect(parseDeclaredValue('1 000 000', 1000000), 1000000);
      expect(parseDeclaredValue('1000001', 1000000), isNull);
      expect(parseDeclaredValue('0', 1000000), isNull);
      expect(parseDeclaredValue('', 1000000), isNull);
      expect(parseDeclaredValue('abc', 1000000), isNull);
    });

    test('toDetails: declaredValue va prohibitedItemsAccepted=true ketadi', () {
      const parcel = ParcelInfo(
        recipientPhone: '+998901112233',
        itemDescription: 'Kitob',
        size: kParcelSizeSmall,
        declaredValue: 150000,
        prohibitedItemsAccepted: true,
      );
      expect(parcel.toDetails(), {
        'recipientPhone': '+998901112233',
        'itemDescription': 'Kitob',
        'size': 'small',
        'declaredValue': 150000,
        'prohibitedItemsAccepted': true,
      });
      expect(
        ParcelInfo.fromDetails('parcel', parcel.toDetails()),
        parcel,
      );
    });

    test('taqiqlangan ro\'yxat — 7 ta', () {
      expect(kParcelProhibitedItems, hasLength(7));
    });
  });

  group('Cargo details', () {
    test('ixtiyoriy maydonlar: bo\'sh — yuborilmaydi', () {
      expect(buildCargoDetails(vehicle: 'Yuk'), {'vehicle': 'Yuk'});
      expect(
        buildCargoDetails(vehicle: 'Yuk', weightKg: 500, loaders: 0),
        {'vehicle': 'Yuk', 'weightKg': 500, 'loaders': 0},
      );
    });

    test('parseOptionalInt chegaralari', () {
      expect(parseOptionalInt('', min: 1, max: kCargoMaxWeightKg), isNull);
      expect(parseOptionalInt('20000', min: 1, max: kCargoMaxWeightKg), 20000);
      expect(parseOptionalInt('20001', min: 1, max: kCargoMaxWeightKg), kCargoInvalidInput);
      expect(parseOptionalInt('0', min: 1, max: kCargoMaxWeightKg), kCargoInvalidInput);
      expect(parseOptionalInt('0', min: 0, max: kCargoMaxLoaders), 0);
      expect(parseOptionalInt('11', min: 0, max: kCargoMaxLoaders), kCargoInvalidInput);
    });
  });
}
