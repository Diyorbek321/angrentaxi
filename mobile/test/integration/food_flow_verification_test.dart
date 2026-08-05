// Manual verification script — exercises the real FoodProvider/ApiClient
// code path against a LIVE local backend (not mocked). Run with:
//   flutter test test/integration/food_flow_verification_test.dart \
//     --dart-define=API_BASE_URL=http://localhost:3000/api/v1
import 'dart:io';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = null;
  SharedPreferences.setMockInitialValues({});

  test('customer can browse a restaurant and place a real food order', () async {
    final prefs = await SharedPreferences.getInstance();
    final storage = LocalStorage(prefs);
    final apiClient = ApiClient(storage, GlobalKey<NavigatorState>());
    final socket = SocketService();
    final food = FoodProvider(apiClient: apiClient, socketService: socket);

    // Log in as the seeded passenger (+998901234569 / OTP 123456).
    await apiClient.post('/auth/send-otp', data: {'phone': '+998901234569'});
    final verify = await apiClient.post(
      '/auth/verify-otp',
      data: {'phone': '+998901234569', 'code': '123456'},
    );
    final token = ((verify.data as Map)['data'] as Map)['accessToken'] as String;
    await storage.saveToken(token);

    await food.loadRestaurants();
    expect(food.state, FoodProviderState.success, reason: food.error ?? '');
    expect(food.restaurants, isNotEmpty);

    final restaurantId = food.restaurants.first.id;
    await food.loadRestaurantDetail(restaurantId);
    expect(food.restaurant, isNotNull);
    expect(food.dishes, isNotEmpty);
    expect(food.categories, isNotEmpty);

    final dish = food.dishes.firstWhere((d) => d.isAvailable);

    final order = await food.createOrder(
      items: [
        CartItem(id: dish.id, name: dish.name, price: dish.price, qty: 1, icon: dish.icon, color: dish.color),
      ],
      deliveryAddress: 'Test manzil, Angren',
      deliveryLat: 40.0956,
      deliveryLng: 70.9432,
      paymentMethod: 'cash',
    );

    expect(order, isNotNull, reason: food.error ?? '');
    expect(order!.itemsCount, 1);
    expect(order.totalPrice, dish.price);

    await food.loadOrderHistory();
    expect(food.orderHistory.any((o) => o.id == order.id), isTrue);
  });
}
