// Kartali buyurtma to'lovdan oldin sotuvchiga ketmaydi (docs/INCIDENT-POLICY.md §1):
// karta mavjudligi sozlamasi, checkout bloklanishi va `paymentPending`.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _settings(Map<String, dynamic> data) => Response<dynamic>(
      requestOptions: RequestOptions(path: ApiEndpoints.settingsPublic),
      data: {'success': true, 'data': data},
    );

void main() {
  group('SuperappProvider — karta mavjudligi', () {
    late _MockApiClient api;
    late SuperappProvider provider;

    setUp(() {
      api = _MockApiClient();
      provider = SuperappProvider(apiClient: api);
      provider.setActiveContext('market', 's1');
      provider.addToCart(const CartItem(
        id: 'p1',
        name: 'TV',
        price: 250000,
        qty: 1,
        icon: Icons.tv,
        color: Colors.blue,
      ));
    });

    test("server javob bermaguncha karta YO'Q", () {
      expect(provider.cardPaymentsAvailable, isFalse);
      expect(provider.cardPaymentProviders, isEmpty);
    });

    test("sozlamadan o'qiydi; chegaradan oshgan savat + karta yo'q — bloklangan", () async {
      when(() => api.get(ApiEndpoints.settingsPublic)).thenAnswer(
        (_) async => _settings({'maxCashVendorOrder': 200000, 'cardPaymentsAvailable': false}),
      );
      await provider.loadPlatformSettings();
      expect(provider.cashAllowed, isFalse);
      expect(provider.checkoutBlockedByPayment, isTrue);

      when(() => api.get(ApiEndpoints.settingsPublic)).thenAnswer(
        (_) async => _settings({
          'maxCashVendorOrder': 200000,
          'cardPaymentsAvailable': true,
          'cardPaymentProviders': ['click'],
        }),
      );
      await provider.loadPlatformSettings();
      expect(provider.cardPaymentsAvailable, isTrue);
      expect(provider.cardPaymentProviders, ['click']);
      expect(provider.checkoutBlockedByPayment, isFalse);
    });
  });

  test('preferredOnlineProvider — birinchi tanish provayder, aks holda Payme', () {
    expect(preferredOnlineProvider(const ['click', 'payme']), OnlinePaymentProvider.click);
    expect(preferredOnlineProvider(const ['nimadir', 'uzcard']), OnlinePaymentProvider.uzcard);
    expect(preferredOnlineProvider(const []), OnlinePaymentProvider.payme);
  });

  group('paymentPending', () {
    final base = {
      'id': 'o1',
      'status': 'new',
      'items': <dynamic>[],
      'deliveryAddress': 'Angren',
      'totalPrice': 27000,
      'createdAt': '2026-11-03T10:00:00.000Z',
    };

    test("serverdan o'qiladi; eski server — false", () {
      expect(FoodOrder.fromJson({...base, 'restaurantId': 'r1', 'paymentPending': true}).paymentPending, isTrue);
      expect(FoodOrder.fromJson({...base, 'restaurantId': 'r1'}).paymentPending, isFalse);
      expect(MarketOrder.fromJson({...base, 'storeId': 's1', 'paymentPending': true}).paymentPending, isTrue);
    });

    test('bekor qilingach — false', () {
      final order = FoodOrder.fromJson({...base, 'restaurantId': 'r1', 'paymentPending': true});
      expect(order.copyWith(status: FoodOrderStatus.cancelled).paymentPending, isFalse);
      expect(order.copyWith().paymentPending, isTrue);
    });
  });
}
