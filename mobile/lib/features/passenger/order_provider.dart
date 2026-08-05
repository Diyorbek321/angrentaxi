import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

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
  final List<OrderLocation> _pendingWaypoints = [];
  Tariff? _selectedTariff;
  double? _estimatedPrice;

  /// Max intermediate stops allowed on a multi-stop ride, matching the
  /// backend's `WaypointDto` (`@ArrayMaxSize(5)`).
  static const int maxWaypoints = 5;

  // Active super-app vertical: 'taxi' or 'cargo'. Drives which tariffs load
  // and which serviceType the order is created with.
  String _serviceType = 'taxi';
  Map<String, dynamic>? _cargoDetails;

  // Pending rating after trip completion
  String? pendingRatingOrderId;
  String? pendingRatingDriverName;

  // Set when matching.service.ts's handleNoDriversFound auto-cancels the
  // order — a one-off banner to show, consumed the same way as
  // pendingRatingOrderId above.
  String? noDriversFoundMessage;

  OrderProviderState get state => _state;
  String? get error => _error;
  Order? get activeOrder => _activeOrder;
  List<Order> get orderHistory => List.unmodifiable(_orderHistory);
  List<Tariff> get tariffs => List.unmodifiable(_tariffs);
  LatLng? get driverLocation => _driverLocation;
  OrderLocation? get pendingPickup => _pendingPickup;
  OrderLocation? get pendingDropoff => _pendingDropoff;
  List<OrderLocation> get pendingWaypoints => List.unmodifiable(_pendingWaypoints);
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

  /// Adds an intermediate stop, up to [maxWaypoints]. Silently ignores
  /// additions past the limit — callers (e.g. destination_screen) should
  /// hide/disable the "add stop" action once the limit is reached rather
  /// than rely on this to surface an error.
  void addWaypoint(OrderLocation location) {
    if (_pendingWaypoints.length >= maxWaypoints) return;
    _pendingWaypoints.add(location);
    notifyListeners();
  }

  void removeWaypoint(int index) {
    if (index < 0 || index >= _pendingWaypoints.length) return;
    _pendingWaypoints.removeAt(index);
    notifyListeners();
  }

  void clearWaypoints() {
    _pendingWaypoints.clear();
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

  // Route geometry + distance/duration for the pending pickup/dropoff pair,
  // fetched from OSRM by the tariff-select screen. Kept here (rather than
  // local widget state) so price estimation and the route line share one
  // source of truth.
  List<LatLng> _routePoints = [];
  double? _routeDistanceKm;
  double? _routeDurationMin;

  List<LatLng> get routePoints => List.unmodifiable(_routePoints);
  double? get routeDistanceKm => _routeDistanceKm;
  double? get routeDurationMin => _routeDurationMin;

  void setRoute({
    required List<LatLng> points,
    required double distanceKm,
    required double durationMin,
  }) {
    _routePoints = points;
    _routeDistanceKm = distanceKm;
    _routeDurationMin = durationMin;
    notifyListeners();
  }

  /// Matches backend's POST /orders/calculate-price, which prices a tariff
  /// from a distance/duration pair rather than raw pickup/dropoff coordinates
  /// (the backend has no routing engine of its own).
  Future<void> estimatePrice({
    required double distanceKm,
    required double durationMin,
    required String tariffId,
  }) async {
    try {
      final response = await _apiClient.post(
        ApiEndpoints.estimatePrice,
        data: {
          'tariffId': tariffId,
          'distanceKm': distanceKm,
          'durationMin': durationMin,
        },
      );
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'] as Map<String, dynamic>;
      _estimatedPrice = (payload['price'] as num?)?.toDouble() ?? 0;
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
      // Matches backend's CreateOrderDto (create-order.dto.ts) exactly — it
      // takes flat pickupLat/pickupLng/pickupAddress (and dropoff* likewise),
      // not nested pickup/dropoff objects; sending the nested shape gets
      // rejected with "property pickup should not exist" plus "pickupLat
      // must be a number" (whitelist validation strips the unknown nested
      // key, then fails on the now-missing flat ones).
      final response = await _apiClient.post(
        ApiEndpoints.createOrder,
        data: {
          'tariffId': _selectedTariff!.id,
          'pickupLat': _pendingPickup!.lat,
          'pickupLng': _pendingPickup!.lng,
          'pickupAddress': _pendingPickup!.address,
          'dropoffLat': _pendingDropoff!.lat,
          'dropoffLng': _pendingDropoff!.lng,
          'dropoffAddress': _pendingDropoff!.address,
          'serviceType': _serviceType,
          if (_pendingWaypoints.isNotEmpty)
            'waypoints': _pendingWaypoints
                .map((w) => {'lat': w.lat, 'lng': w.lng, 'address': w.address})
                .toList(),
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
    if (_activeOrder != null) {
      _socketService.emit(SocketEvents.joinOrder, {'orderId': _activeOrder!.id});
    }

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

    // orders.service.ts's 'driver' payload here only carries
    // id/userId/carModel/carNumber/rating (no name/phone — those are only on
    // the flat User entity GET /orders/:id returns), so apply it optimistically
    // for an instant status flip, then refetch to backfill the rest.
    _socketService.on(SocketEvents.orderAccepted, (data) {
      if (data is Map && _activeOrder != null) {
        final driver = data['driver'];
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.driverAssigned,
          driver: driver is Map<String, dynamic>
              ? Driver.fromJson(driver)
              : _activeOrder!.driver,
        );
        notifyListeners();
        _refreshActiveOrder();
      }
    });

    _socketService.on(SocketEvents.orderArrived, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(status: OrderStatus.driverArrived);
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.orderInProgress, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(status: OrderStatus.inProgress);
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.orderCompleted, (data) {
      if (data is Map && _activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.completed,
          actualPrice: (data['finalPrice'] as num?)?.toDouble(),
          distanceKm: (data['actualDistanceKm'] as num?)?.toDouble(),
          durationMin: (data['actualDurationMin'] as num?)?.toInt(),
        );
        // Store info needed for post-trip rating before clearing the order.
        pendingRatingOrderId = _activeOrder!.id;
        pendingRatingDriverName = _activeOrder!.driver?.name ?? 'Haydovchi';
        notifyListeners();
        _cleanupOrderListeners();
        loadOrderHistory();
      }
    });

    _socketService.on(SocketEvents.orderCancelled, (data) {
      if (_activeOrder != null) {
        final reason = data is Map ? data['reason'] as String? : null;
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.cancelled,
          cancelReason: reason,
        );
        notifyListeners();
        _cleanupOrderListeners();
      }
    });

    // matching.service.ts's handleNoDriversFound already cancels the order
    // server-side (status -> cancelled) and emits ONLY this event, never
    // 'order:cancelled' — without this listener the app kept showing
    // "searching..." forever, and tapping cancel afterward 400'd with
    // "Cannot cancel order with status cancelled" since it already was.
    _socketService.on(SocketEvents.noDriversFound, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.cancelled,
          cancelReason: "Yaqin atrofda haydovchi topilmadi",
        );
        noDriversFoundMessage =
            "Yaqin atrofda haydovchi topilmadi. Birozdan so'ng qayta urinib ko'ring.";
        notifyListeners();
        _cleanupOrderListeners();
      }
    });
  }

  // Socket payloads for order:accepted only carry the driver's
  // id/carModel/carNumber/rating; re-fetch the full order so name/phone (only
  // present on GET /orders/:id's flat User-backed driver object) show up too.
  Future<void> _refreshActiveOrder() async {
    if (_activeOrder == null) return;
    try {
      final response =
          await _apiClient.get(ApiEndpoints.orderById(_activeOrder!.id));
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] _refreshActiveOrder error: $e');
    }
  }

  void _cleanupOrderListeners() {
    if (_activeOrder != null) {
      _socketService.emit(SocketEvents.leaveOrder, {'orderId': _activeOrder!.id});
    }
    _socketService.off(SocketEvents.driverLocationUpdate);
    _socketService.off(SocketEvents.orderAccepted);
    _socketService.off(SocketEvents.orderArrived);
    _socketService.off(SocketEvents.orderInProgress);
    _socketService.off(SocketEvents.orderCompleted);
    _socketService.off(SocketEvents.orderCancelled);
    _socketService.off(SocketEvents.noDriversFound);
    _driverLocation = null;
  }

  Future<void> cancelOrder({String? reason}) async {
    if (_activeOrder == null) return;

    _setState(OrderProviderState.loading);
    try {
      await _apiClient.patch(
        ApiEndpoints.cancelOrder(_activeOrder!.id),
        data: reason != null ? {'reason': reason} : null,
      );
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

  void clearNoDriversFoundMessage() {
    noDriversFoundMessage = null;
    notifyListeners();
  }

  void clearPendingOrder() {
    _pendingPickup = null;
    _pendingDropoff = null;
    _selectedTariff = null;
    _estimatedPrice = null;
    _routePoints = [];
    _routeDistanceKm = null;
    _routeDurationMin = null;
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
