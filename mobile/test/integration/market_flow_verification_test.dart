// Manual verification script — exercises the real MarketProvider/ApiClient
// code path against a LIVE local backend (not mocked). Run with:
//   flutter test test/integration/market_flow_verification_test.dart \
//     --dart-define=API_BASE_URL=http://localhost:3000/api/v1
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // flutter_test fakes HttpClient to always 400 by default (network-call
  // safety net) — disable that so this test hits the real local backend.
  HttpOverrides.global = null;
  SharedPreferences.setMockInitialValues({});

  test('customer can browse the store and place a real market order', () async {
    final prefs = await SharedPreferences.getInstance();
    final storage = LocalStorage(prefs);
    final apiClient = ApiClient(storage, GlobalKey<NavigatorState>());
    final socket = SocketService();
    final market = MarketProvider(apiClient: apiClient, socketService: socket);

    // Log in as the seeded passenger (+998901234569 / OTP 123456).
    await apiClient.post('/auth/send-otp', data: {'phone': '+998901234569'});
    final verify = await apiClient.post(
      '/auth/verify-otp',
      data: {'phone': '+998901234569', 'code': '123456'},
    );
    final token = ((verify.data as Map)['data'] as Map)['accessToken'] as String;
    await storage.saveToken(token);

    await market.loadStore();
    expect(market.state, MarketProviderState.success, reason: market.error ?? '');
    expect(market.store, isNotNull);
    expect(market.products, isNotEmpty);
    expect(market.categories, isNotEmpty);

    final product = market.products.firstWhere((p) => p.isAvailable);
    final stockBefore = product.stock;

    final order = await market.createOrder(
      items: [
        CartItem(
          id: product.id,
          name: product.name,
          price: product.price,
          qty: 1,
          icon: product.icon,
          color: product.color,
        ),
      ],
      deliveryAddress: "Test manzil, Angren",
      deliveryLat: 40.1050,
      deliveryLng: 70.9500,
    );

    expect(order, isNotNull, reason: market.error ?? '');
    expect(order!.itemsCount, 1);
    expect(order.totalPrice, product.price);

    // Confirm it actually landed server-side, decremented stock, and shows
    // up in this customer's order history.
    await market.loadStore();
    final productAfter = market.products.firstWhere((p) => p.id == product.id);
    expect(productAfter.stock, stockBefore - 1);

    await market.loadOrderHistory();
    expect(market.orderHistory.any((o) => o.id == order.id), isTrue);
  });
}
