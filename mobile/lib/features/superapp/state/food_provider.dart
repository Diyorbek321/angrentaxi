import 'dart:async';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/json_cache.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/vendor_order_actions.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/dish.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/models/menu_category.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:flutter/foundation.dart';

enum FoodProviderState { idle, loading, success, error }

/// Backs the Food vertical (`superapp/screens/food_list_screen.dart` and
/// `restaurant_detail_screen.dart`) with the real `/food` backend — mirrors
/// [MarketProvider]'s shape.
class FoodProvider extends ChangeNotifier {
  FoodProvider({
    required ApiClient apiClient,
    required SocketService socketService,
    JsonCache? cache,
  })  : _apiClient = apiClient,
        _socketService = socketService,
        _cache = cache;

  final ApiClient _apiClient;
  final SocketService _socketService;

  /// Restoranlar ro'yxati va menyular uchun — ekran skeleton o'rniga oxirgi
  /// nusxa bilan darhol ochiladi (`json_cache.dart`).
  final JsonCache? _cache;
  static const String _restaurantsKey = 'food.restaurants';
  static String _restaurantKey(String id) => 'food.restaurant.$id';

  FoodProviderState _state = FoodProviderState.idle;
  String? _error;
  List<FoodRestaurant> _restaurants = [];
  FoodRestaurant? _restaurant;
  List<MenuCategory> _categories = [];
  List<Dish> _dishes = [];
  FoodOrder? _activeOrder;
  List<FoodOrder> _orderHistory = [];
  List<PromotionBadge> _restaurantPromotions = [];
  List<ActivePromotion> _activePromotions = [];

  FoodProviderState get state => _state;
  String? get error => _error;
  List<FoodRestaurant> get restaurants => List.unmodifiable(_restaurants);
  FoodRestaurant? get restaurant => _restaurant;
  List<MenuCategory> get categories => List.unmodifiable(_categories);
  List<Dish> get dishes => List.unmodifiable(_dishes);
  FoodOrder? get activeOrder => _activeOrder;
  List<FoodOrder> get orderHistory => List.unmodifiable(_orderHistory);
  bool get hasActiveOrder => _activeOrder != null && _activeOrder!.status.isActive;

  /// Ochilgan restoranning faol aksiyalari (spec v5 §4).
  List<PromotionBadge> get restaurantPromotions => List.unmodifiable(_restaurantPromotions);

  /// Bosh ekrandagi "Chegirmalar" lentasi.
  List<ActivePromotion> get activePromotions => _activePromotions;

  /// Oxirgi buyurtmadagi manzil tafsilotlari — checkout'ni oldindan
  /// to'ldirish uchun.
  AddressDetails? get lastAddressDetails {
    final orders = [..._orderHistory]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    for (final o in orders) {
      if (o.addressDetails != null) return o.addressDetails;
    }
    return null;
  }

  Future<void> loadActivePromotions() async {
    _activePromotions = await fetchActivePromotions(_apiClient, 'food');
    notifyListeners();
  }

  void _setState(FoodProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> loadRestaurants() async {
    final cached = _restaurants.isEmpty ? _cache?.read(_restaurantsKey) : null;
    final showedCache = cached is List && _applyRestaurants(cached);
    if (showedCache) {
      _setState(FoodProviderState.success);
    } else {
      _setState(FoodProviderState.loading);
    }
    try {
      final response = await _apiClient.get(ApiEndpoints.foodRestaurants);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      _restaurants = list.map((e) => FoodRestaurant.fromJson(e as Map<String, dynamic>)).toList();
      _setState(FoodProviderState.success);
      unawaited(_cache?.write(_restaurantsKey, list));
    } catch (e) {
      debugPrint('[FoodProvider] loadRestaurants error: $e');
      // Keshdagi ro'yxat ko'rinib turibdi — xato ekrani bilan almashtirmaymiz.
      if (showedCache) return;
      _error = extractErrorMessage(e);
      _setState(FoodProviderState.error);
    }
  }

  bool _applyRestaurants(List<dynamic> list) {
    try {
      _restaurants = list.map((e) => FoodRestaurant.fromJson(e as Map<String, dynamic>)).toList();
      return true;
    } catch (e) {
      debugPrint('[FoodProvider] cached restaurants unreadable: $e');
      return false;
    }
  }

  Future<void> loadRestaurantDetail(String restaurantId) async {
    final cached = _cache?.read(_restaurantKey(restaurantId));
    final showedCache = cached is Map<String, dynamic> && _applyRestaurantDetail(cached);
    if (showedCache) {
      _setState(FoodProviderState.success);
    } else {
      _setState(FoodProviderState.loading);
    }
    try {
      final response = await _apiClient.get(ApiEndpoints.foodRestaurant(restaurantId));
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      _applyRestaurantDetail(data, rethrowErrors: true);
      _setState(FoodProviderState.success);
      unawaited(_cache?.write(_restaurantKey(restaurantId), data));
    } catch (e) {
      debugPrint('[FoodProvider] loadRestaurantDetail error: $e');
      if (showedCache) return;
      _error = extractErrorMessage(e);
      _setState(FoodProviderState.error);
    }
  }

  bool _applyRestaurantDetail(Map<String, dynamic> data, {bool rethrowErrors = false}) {
    try {
      final restaurant = FoodRestaurant.fromJson(data['restaurant'] as Map<String, dynamic>);
      final categories = ((data['categories'] as List<dynamic>))
          .map((e) => MenuCategory.fromJson(e as Map<String, dynamic>))
          .toList();
      final dishes = ((data['dishes'] as List<dynamic>))
          .map((e) => Dish.fromJson(e as Map<String, dynamic>))
          .toList();
      // Kategoriyalar `sortOrder` bo'yicha; bo'sh kategoriya ko'rsatilmaydi
      // (yangi server ularni o'zi tushirib qoldiradi, eskisi — yo'q).
      final usedIds = dishes.map((d) => d.categoryId).toSet();
      final sortedCategories = categories.where((c) => usedIds.contains(c.id)).toList()
        ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      final rawPromotions = data['promotions'] ??
          (data['restaurant'] as Map<String, dynamic>)['promotions'];
      _restaurant = restaurant;
      _categories = sortedCategories;
      _dishes = dishes;
      _restaurantPromotions = rawPromotions is List
          ? rawPromotions.map(PromotionBadge.tryParse).whereType<PromotionBadge>().toList()
          : const [];
      return true;
    } catch (e) {
      if (rethrowErrors) rethrow;
      debugPrint('[FoodProvider] cached menu unreadable: $e');
      return false;
    }
  }

  Future<FoodOrder?> createOrder({
    required List<CartItem> items,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    String paymentMethod = 'cash',
    String? promoCode,
    AddressDetails? addressDetails,
  }) async {
    if (_restaurant == null || items.isEmpty) return null;

    _setState(FoodProviderState.loading);
    try {
      final response = await _apiClient.post(
        ApiEndpoints.foodOrders,
        data: withOrderExtras(
          {
            'restaurantId': _restaurant!.id,
            'items': items.map((c) => {'dishId': c.id, 'qty': c.qty}).toList(),
            'deliveryAddress': deliveryAddress,
            'deliveryLat': deliveryLat,
            'deliveryLng': deliveryLng,
            'paymentMethod': paymentMethod,
          },
          promoCode: promoCode,
          addressDetails: addressDetails,
        ),
      );
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      _activeOrder = FoodOrder.fromJson(data);
      _listenToOrderEvents();
      _setState(FoodProviderState.success);
      return _activeOrder;
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(FoodProviderState.error);
      return null;
    }
  }

  void _listenToOrderEvents() {
    _socketService.on(SocketEvents.foodOrderStatus, (data) {
      if (data is Map && _activeOrder != null && data['orderId'] == _activeOrder!.id) {
        final status = foodOrderStatusFromString(data['status'] as String? ?? '');
        _activeOrder = _activeOrder!.copyWith(status: status);
        notifyListeners();
        if (!status.isActive) {
          _socketService.off(SocketEvents.foodOrderStatus);
        }
      }
    });
  }

  Future<void> checkActiveOrder() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.foodOrders);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      final orders = list.map((e) => FoodOrder.fromJson(e as Map<String, dynamic>));
      final active = orders.where((o) => o.status.isActive);
      if (active.isNotEmpty) {
        _activeOrder = active.first;
        _listenToOrderEvents();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[FoodProvider] checkActiveOrder error: $e');
    }
  }

  Future<void> loadOrderHistory() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.foodOrders);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      _orderHistory = list.map((e) => FoodOrder.fromJson(e as Map<String, dynamic>)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[FoodProvider] loadOrderHistory error: $e');
    }
  }

  /// Mijoz buyurtmani bekor qiladi (spec v5 §1). Muvaffaqiyatda faol
  /// buyurtma va tarix darhol yangilanadi.
  Future<VendorCancelResult> cancelOrder(String orderId, {String? reason}) async {
    final result = await postVendorCancel(
      _apiClient,
      ApiEndpoints.foodOrderCancel(orderId),
      reason: reason,
    );
    if (result.isCancelled) {
      FoodOrder? updated;
      try {
        if (result.order != null) updated = FoodOrder.fromJson(result.order!);
      } catch (e) {
        debugPrint('[FoodProvider] cancel response unreadable: $e');
      }
      _replaceOrder(orderId, updated, FoodOrderStatus.cancelled);
    } else if (result.outcome == VendorCancelOutcome.notAllowed) {
      // Restoran allaqachon qabul qilgan — eski bayroqni o'chiramiz va
      // haqiqiy holatni serverdan olamiz.
      await loadOrderHistory();
    }
    return result;
  }

  void _replaceOrder(String id, FoodOrder? updated, FoodOrderStatus fallbackStatus) {
    FoodOrder next(FoodOrder o) => updated ?? o.copyWith(status: fallbackStatus);
    _orderHistory = [for (final o in _orderHistory) o.id == id ? next(o) : o];
    if (_activeOrder?.id == id) {
      _activeOrder = next(_activeOrder!);
      if (!_activeOrder!.status.isActive) {
        _socketService.off(SocketEvents.foodOrderStatus);
      }
    }
    notifyListeners();
  }

  @visibleForTesting
  void debugSetOrderHistory(List<FoodOrder> orders) {
    _orderHistory = orders;
    notifyListeners();
  }

  void clearActiveOrder() {
    _socketService.off(SocketEvents.foodOrderStatus);
    _activeOrder = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _socketService.off(SocketEvents.foodOrderStatus);
    super.dispose();
  }
}

FoodProvider buildFoodProvider() => FoodProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
      cache: sl<JsonCache>(),
    );
