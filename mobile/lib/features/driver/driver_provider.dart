import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/order.dart';

enum DriverProviderState { idle, loading, success, error }

class DriverProvider extends ChangeNotifier {
  DriverProvider({
    required ApiClient apiClient,
    required SocketService socketService,
    required LocationService locationService,
    required LocalStorage localStorage,
  })  : _apiClient = apiClient,
        _socketService = socketService,
        _locationService = locationService,
        _localStorage = localStorage;

  final ApiClient _apiClient;
  final SocketService _socketService;
  final LocationService _locationService;
  final LocalStorage _localStorage;

  DriverProviderState _state = DriverProviderState.idle;
  String? _error;
  Driver? _driver;
  Order? _activeOrder;
  Order? _pendingOffer;
  List<Order> _orderHistory = [];
  double _todayEarnings = 0;
  bool _isOnline = false;
  StreamSubscription<Position>? _locationSubscription;

  DriverProviderState get state => _state;
  String? get error => _error;
  Driver? get driver => _driver;
  Order? get activeOrder => _activeOrder;
  Order? get pendingOffer => _pendingOffer;
  List<Order> get orderHistory => List.unmodifiable(_orderHistory);
  double get todayEarnings => _todayEarnings;
  bool get isOnline => _isOnline;
  bool get hasActiveOrder => _activeOrder != null;

  void _setState(DriverProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> initialize() async {
    _isOnline = _localStorage.getDriverOnlineStatus();
    await loadProfile();
    await checkActiveOrder();
    if (_isOnline) {
      _startLocationUpdates();
    }
    _listenToSocketEvents();
  }

  Future<void> loadProfile() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverProfile);
      final data = response.data as Map<String, dynamic>;
      _driver = Driver.fromJson(data['data'] as Map<String, dynamic>);
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadProfile error: $e');
    }
  }

  Future<void> goOnline() async {
    _setState(DriverProviderState.loading);
    try {
      await _apiClient
          .patch(ApiEndpoints.driverStatus, data: {'isOnline': true});
      _isOnline = true;
      await _localStorage.saveDriverOnlineStatus(true);
      _socketService.emit(SocketEvents.driverOnline, {});
      _startLocationUpdates();
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> goOffline() async {
    _setState(DriverProviderState.loading);
    try {
      await _apiClient
          .patch(ApiEndpoints.driverStatus, data: {'isOnline': false});
      _isOnline = false;
      await _localStorage.saveDriverOnlineStatus(false);
      _socketService.emit(SocketEvents.driverOffline, {});
      _stopLocationUpdates();
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  void _listenToSocketEvents() {
    _socketService.on(SocketEvents.newOrderOffer, (data) {
      if (data is Map<String, dynamic>) {
        _pendingOffer = Order.fromJson(data);
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.orderCancelled, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(status: OrderStatus.cancelled);
        notifyListeners();
      }
      _pendingOffer = null;
      notifyListeners();
    });
  }

  Future<void> acceptOrder(String orderId) async {
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.acceptOrder(orderId),
      );
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      _pendingOffer = null;
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> declineOrder(String orderId) async {
    try {
      await _apiClient.patch(ApiEndpoints.declineOrder(orderId));
      _pendingOffer = null;
      notifyListeners();
    } catch (e) {
      _pendingOffer = null;
      notifyListeners();
    }
  }

  Future<void> arrivedAtPickup() async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.arrivedAtPickup(_activeOrder!.id),
      );
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> startTrip() async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.startTrip(_activeOrder!.id),
      );
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> completeTrip() async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.completeTrip(_activeOrder!.id),
      );
      final data = response.data as Map<String, dynamic>;
      final completedOrder = Order.fromJson(
        data['data'] as Map<String, dynamic>,
      );
      _todayEarnings +=
          completedOrder.actualPrice ?? completedOrder.estimatedPrice;
      _activeOrder = null;
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> cancelOrder({String? reason}) async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      await _apiClient.patch(
        ApiEndpoints.cancelOrder(_activeOrder!.id),
        data: {if (reason != null) 'reason': reason},
      );
      _activeOrder = null;
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  void _startLocationUpdates() {
    _locationSubscription?.cancel();
    _locationSubscription = _locationService
        .getPositionStream(
      distanceFilter: AppConfig.locationUpdateDistanceFilter,
    )
        .listen((position) {
      _emitLocation(position);
    });
  }

  void _stopLocationUpdates() {
    _locationSubscription?.cancel();
    _locationSubscription = null;
  }

  void _emitLocation(Position position) {
    if (_socketService.isConnected) {
      final payload = {
        'lat': position.latitude,
        'lng': position.longitude,
        if (_activeOrder != null) 'orderId': _activeOrder!.id,
      };
      _socketService.emit(SocketEvents.driverLocation, payload);
    }

    // HTTP backup, sent whenever online (not just mid-trip) so the driver's
    // stored location stays fresh for nearby-driver matching.
    _apiClient.post(
      ApiEndpoints.updateLocation,
      data: {'lat': position.latitude, 'lng': position.longitude},
    ).then<void>(
      (_) {},
      onError: (Object e) => debugPrint('[Location] HTTP update failed: $e'),
    );
  }

  // No dedicated "my active order" endpoint exists — a driver has at most one
  // order in flight, and it's always the most recent one, so it's derived
  // from the first page of order history instead.
  Future<void> checkActiveOrder() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverOrderHistory);
      final data = response.data as Map<String, dynamic>;
      final ordersJson =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      final orders = ordersJson
          .map((e) => Order.fromJson(e as Map<String, dynamic>))
          .toList();
      final active = orders.where((o) => o.isActive);
      _activeOrder = active.isEmpty ? null : active.first;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] checkActiveOrder error: $e');
    }
  }

  Future<void> loadOrderHistory() async {
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.driverOrderHistory);
      final data = response.data as Map<String, dynamic>;
      final list =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      _orderHistory =
          list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> loadEarnings() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverEarnings);
      final data = response.data as Map<String, dynamic>;
      _todayEarnings = (data['data']['today'] as num?)?.toDouble() ?? 0;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadEarnings error: $e');
    }
  }

  void clearPendingOffer() {
    _pendingOffer = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    if (_state == DriverProviderState.error) {
      _setState(DriverProviderState.idle);
    }
  }

  @override
  void dispose() {
    _stopLocationUpdates();
    _socketService.off(SocketEvents.newOrderOffer);
    _socketService.off(SocketEvents.orderCancelled);
    super.dispose();
  }
}

DriverProvider buildDriverProvider() => DriverProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
      locationService: sl<LocationService>(),
      localStorage: sl<LocalStorage>(),
    );
