import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';

enum OrderProviderState { idle, loading, success, error }

class OrderProvider extends ChangeNotifier {
  OrderProvider({
    required ApiClient apiClient,
    required SocketService socketService,
  })  : _apiClient = apiClient,
        _socketService = socketService;

  final ApiClient _apiClient;
  final SocketService _socketService;

  OrderProviderState _state = OrderProviderState.idle;
  String? _error;
  Order? _activeOrder;
  List<Order> _orderHistory = [];
  List<Tariff> _tariffs = [];
  LatLng? _driverLocation;

  // Pending order creation data
  OrderLocation? _pendingPickup;
  OrderLocation? _pendingDropoff;
  Tariff? _selectedTariff;
  double? _estimatedPrice;

  // Active super-app vertical: 'taxi' or 'cargo'. Drives which tariffs load
  // and which serviceType the order is created with.
  String _serviceType = 'taxi';
  Map<String, dynamic>? _cargoDetails;

  // Pending rating after trip completion
  String? pendingRatingOrderId;
  String? pendingRatingDriverName;

  OrderProviderState get state => _state;
  String? get error => _error;
  Order? get activeOrder => _activeOrder;
  List<Order> get orderHistory => List.unmodifiable(_orderHistory);
  List<Tariff> get tariffs => List.unmodifiable(_tariffs);
  LatLng? get driverLocation => _driverLocation;
  OrderLocation? get pendingPickup => _pendingPickup;
  OrderLocation? get pendingDropoff => _pendingDropoff;
  Tariff? get selectedTariff => _selectedTariff;
  double? get estimatedPrice => _estimatedPrice;
  bool get hasActiveOrder => _activeOrder != null && _activeOrder!.isActive;
  String get serviceType => _serviceType;
  bool get isCargo => _serviceType == 'cargo';

  /// Switch the active vertical (taxi/cargo) and reset any in-progress selection.
  void setServiceType(String type) {
    _serviceType = type;
    _selectedTariff = null;
    _estimatedPrice = null;
    _cargoDetails = null;
    notifyListeners();
  }

  void setCargoDetails(Map<String, dynamic> details) {
    _cargoDetails = details;
    notifyListeners();
  }

  void _setState(OrderProviderState state) {
    _state = state;
    notifyListeners();
  }

  void setPendingPickup(OrderLocation location) {
    _pendingPickup = location;
    notifyListeners();
  }

  void setPendingDropoff(OrderLocation location) {
    _pendingDropoff = location;
    notifyListeners();
  }

  void selectTariff(Tariff tariff) {
    _selectedTariff = tariff;
    notifyListeners();
  }

  Future<void> loadTariffs() async {
    try {
      final response = await _apiClient.get(
        '${ApiEndpoints.tariffs}?serviceType=$_serviceType',
      );
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _tariffs =
          list.map((e) => Tariff.fromJson(e as Map<String, dynamic>)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] loadTariffs error: $e');
    }
  }

  Future<void> estimatePrice({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required String tariffId,
  }) async {
    try {
      final response = await _apiClient.post(
        ApiEndpoints.estimatePrice,
        data: {
          'pickupLat': pickupLat,
          'pickupLng': pickupLng,
          'dropoffLat': dropoffLat,
          'dropoffLng': dropoffLng,
          'tariffId': tariffId,
        },
      );
      final data = response.data as Map<String, dynamic>;
      _estimatedPrice =
          (data['data']['estimatedPrice'] as num?)?.toDouble() ?? 0;
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] estimatePrice error: $e');
    }
  }

  Future<bool> createOrder() async {
    if (_pendingPickup == null ||
        _pendingDropoff == null ||
        _selectedTariff == null) {
      _error = 'Manzil va tarif tanlanmagan';
      _setState(OrderProviderState.error);
      return false;
    }

    _error = null;
    _setState(OrderProviderState.loading);

    try {
      final response = await _apiClient.post(
        ApiEndpoints.createOrder,
        data: {
          'pickup': _pendingPickup!.toJson(),
          'dropoff': _pendingDropoff!.toJson(),
          'tariffId': _selectedTariff!.id,
          'serviceType': _serviceType,
          if (_cargoDetails != null) 'details': _cargoDetails,
        },
      );

      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(
        data['data'] as Map<String, dynamic>,
      );

      _listenToOrderEvents();
      _setState(OrderProviderState.success);
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(OrderProviderState.error);
      return false;
    }
  }

  void _listenToOrderEvents() {
    _socketService.on(SocketEvents.driverLocationUpdate, (data) {
      if (data is Map) {
        final lat = (data['lat'] as num?)?.toDouble();
        final lng = (data['lng'] as num?)?.toDouble();
        if (lat != null && lng != null) {
          _driverLocation = LatLng(lat, lng);
          notifyListeners();
        }
      }
    });

    _socketService.on(SocketEvents.orderStatusUpdate, (data) {
      if (data is Map && _activeOrder != null) {
        final status = orderStatusFromString(data['status'] as String? ?? '');
        _activeOrder = _activeOrder!.copyWith(status: status);
        notifyListeners();

        if (status == OrderStatus.completed ||
            status == OrderStatus.cancelled) {
          _cleanupOrderListeners();
          if (status == OrderStatus.completed) {
            // Store info needed for post-trip rating before clearing the order.
            pendingRatingOrderId = _activeOrder!.id;
            pendingRatingDriverName = _activeOrder!.driver?.name ?? 'Haydovchi';
            loadOrderHistory();
          }
        }
      }
    });

    _socketService.on(SocketEvents.driverAssigned, (data) {
      if (data is Map && _activeOrder != null) {
        final driver = data['driver'];
        if (driver is Map<String, dynamic>) {
          _activeOrder = _activeOrder!.copyWith(
            driver: Driver.fromJson(driver),
            status: OrderStatus.driverAssigned,
          );
          notifyListeners();
        }
      }
    });
  }

  void _cleanupOrderListeners() {
    _socketService.off(SocketEvents.driverLocationUpdate);
    _socketService.off(SocketEvents.orderStatusUpdate);
    _socketService.off(SocketEvents.driverAssigned);
    _driverLocation = null;
  }

  Future<void> cancelOrder() async {
    if (_activeOrder == null) return;

    _setState(OrderProviderState.loading);
    try {
      await _apiClient.patch(ApiEndpoints.cancelOrder(_activeOrder!.id));
      _cleanupOrderListeners();
      _activeOrder = null;
      _setState(OrderProviderState.idle);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(OrderProviderState.error);
    }
  }

  // GET /orders/history has no status filter server-side and returns
  // {orders, total, page, limit} — the active order (if any) is derived from
  // the first page rather than requested directly.
  Future<void> checkActiveOrder() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.orderHistory);
      final data = response.data as Map<String, dynamic>;
      final list =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      final orders = list.map((e) => Order.fromJson(e as Map<String, dynamic>));
      final active = orders.where((o) => o.isActive);
      if (active.isNotEmpty) {
        _activeOrder = active.first;
        _listenToOrderEvents();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[OrderProvider] checkActiveOrder error: $e');
    }
  }

  Future<void> loadOrderHistory() async {
    _setState(OrderProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.orderHistory);
      final data = response.data as Map<String, dynamic>;
      final list =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      _orderHistory =
          list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      _setState(OrderProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(OrderProviderState.error);
    }
  }

  void clearPendingRating() {
    pendingRatingOrderId = null;
    pendingRatingDriverName = null;
    notifyListeners();
  }

  void clearPendingOrder() {
    _pendingPickup = null;
    _pendingDropoff = null;
    _selectedTariff = null;
    _estimatedPrice = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    if (_state == OrderProviderState.error) {
      _setState(OrderProviderState.idle);
    }
  }

  @override
  void dispose() {
    _cleanupOrderListeners();
    super.dispose();
  }
}

OrderProvider buildOrderProvider() => OrderProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
    );
