import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/shared/models/dish.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/models/menu_category.dart';
import 'package:flutter/foundation.dart';

enum FoodProviderState { idle, loading, success, error }

/// Backs the Food vertical (`superapp/screens/food_list_screen.dart` and
/// `restaurant_detail_screen.dart`) with the real `/food` backend — mirrors
/// [MarketProvider]'s shape.
class FoodProvider extends ChangeNotifier {
  FoodProvider({
    required ApiClient apiClient,
    required SocketService socketService,
  })  : _apiClient = apiClient,
        _socketService = socketService;

  final ApiClient _apiClient;
  final SocketService _socketService;

  FoodProviderState _state = FoodProviderState.idle;
  String? _error;
  List<FoodRestaurant> _restaurants = [];
  FoodRestaurant? _restaurant;
  List<MenuCategory> _categories = [];
  List<Dish> _dishes = [];
  FoodOrder? _activeOrder;
  List<FoodOrder> _orderHistory = [];

  FoodProviderState get state => _state;
  String? get error => _error;
  List<FoodRestaurant> get restaurants => List.unmodifiable(_restaurants);
  FoodRestaurant? get restaurant => _restaurant;
  List<MenuCategory> get categories => List.unmodifiable(_categories);
  List<Dish> get dishes => List.unmodifiable(_dishes);
  FoodOrder? get activeOrder => _activeOrder;
  List<FoodOrder> get orderHistory => List.unmodifiable(_orderHistory);
  bool get hasActiveOrder => _activeOrder != null && _activeOrder!.status.isActive;

  void _setState(FoodProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> loadRestaurants() async {
    _setState(FoodProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.foodRestaurants);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      _restaurants = list.map((e) => FoodRestaurant.fromJson(e as Map<String, dynamic>)).toList();
      _setState(FoodProviderState.success);
    } catch (e) {
      debugPrint('[FoodProvider] loadRestaurants error: $e');
      _error = extractErrorMessage(e);
      _setState(FoodProviderState.error);
    }
  }

  Future<void> loadRestaurantDetail(String restaurantId) async {
    _setState(FoodProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.foodRestaurant(restaurantId));
      final data = (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
      _restaurant = FoodRestaurant.fromJson(data['restaurant'] as Map<String, dynamic>);
      _categories = ((data['categories'] as List<dynamic>))
          .map((e) => MenuCategory.fromJson(e as Map<String, dynamic>))
          .toList();
      _dishes = ((data['dishes'] as List<dynamic>)).map((e) => Dish.fromJson(e as Map<String, dynamic>)).toList();
      _setState(FoodProviderState.success);
    } catch (e) {
      debugPrint('[FoodProvider] loadRestaurantDetail error: $e');
      _error = extractErrorMessage(e);
      _setState(FoodProviderState.error);
    }
  }

  Future<FoodOrder?> createOrder({
    required List<CartItem> items,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    String paymentMethod = 'cash',
  }) async {
    if (_restaurant == null || items.isEmpty) return null;

    _setState(FoodProviderState.loading);
    try {
      final response = await _apiClient.post(
        ApiEndpoints.foodOrders,
        data: {
          'restaurantId': _restaurant!.id,
          'items': items.map((c) => {'dishId': c.id, 'qty': c.qty}).toList(),
          'deliveryAddress': deliveryAddress,
          'deliveryLat': deliveryLat,
          'deliveryLng': deliveryLng,
          'paymentMethod': paymentMethod,
        },
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
    );
