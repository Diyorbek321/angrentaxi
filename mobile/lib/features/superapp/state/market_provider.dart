import 'dart:async';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/json_cache.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/vendor_order_actions.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/market_category.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/models/market_store.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:flutter/foundation.dart';

enum MarketProviderState { idle, loading, success, error }

/// Backs the Market vertical (`superapp/screens/market_screen.dart` and
/// friends) with the real `/market` backend. Food is backed the same way by
/// [FoodProvider]; Cargo runs through the taxi `OrderProvider` flow with
/// `serviceType: 'cargo'`.
class MarketProvider extends ChangeNotifier {
  MarketProvider({
    required ApiClient apiClient,
    required SocketService socketService,
    JsonCache? cache,
  })  : _apiClient = apiClient,
        _socketService = socketService,
        _cache = cache;

  final ApiClient _apiClient;
  final SocketService _socketService;

  /// Oxirgi ochilgan do'kon katalogi — ekran skeleton o'rniga shu nusxa
  /// bilan darhol ochiladi (`json_cache.dart`).
  final JsonCache? _cache;
  static const String _storeKey = 'market.store';

  MarketProviderState _state = MarketProviderState.idle;
  String? _error;
  MarketStore? _store;
  List<MarketCategory> _categories = [];
  List<MarketProduct> _products = [];
  MarketOrder? _activeOrder;
  List<MarketOrder> _orderHistory = [];
  List<ActivePromotion> _activePromotions = [];
  List<MarketStore> _stores = [];
  bool _storesLoading = false;
  bool _storesLoaded = false;
  String? _storesError;

  MarketProviderState get state => _state;
  String? get error => _error;
  MarketStore? get store => _store;
  List<MarketCategory> get categories => List.unmodifiable(_categories);
  List<MarketProduct> get products => List.unmodifiable(_products);
  MarketOrder? get activeOrder => _activeOrder;
  List<MarketOrder> get orderHistory => List.unmodifiable(_orderHistory);
  bool get hasActiveOrder => _activeOrder != null && _activeOrder!.status.isActive;

  /// Market sahifasidagi do'konlar ro'yxati. Tanlangan do'kon ([store]) va
  /// uning katalogidan ALOHIDA holat: ro'yxat yuklanishi ochiq turgan
  /// do'kon ekranini "yuklanmoqda" ga o'tkazmasin.
  List<MarketStore> get stores => List.unmodifiable(_stores);
  bool get storesLoading => _storesLoading;

  /// Ro'yxat kamida bir marta muvaffaqiyatli keldi — bo'sh ro'yxat endi
  /// "do'kon yo'q" degani, "hali yuklanmagan" emas.
  bool get storesLoaded => _storesLoaded;
  String? get storesError => _storesError;

  /// Xato bo'lsa avvalgi ro'yxat saqlanadi (ekran bo'shab qolmasin).
  Future<void> loadStores() async {
    _storesLoading = true;
    notifyListeners();
    try {
      final response = await _apiClient.get(ApiEndpoints.marketStores);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      _stores = list.map((e) => MarketStore.fromJson(e as Map<String, dynamic>)).toList();
      _storesError = null;
      _storesLoaded = true;
    } catch (e) {
      debugPrint('[MarketProvider] loadStores error: $e');
      _storesError = extractErrorMessage(e);
    } finally {
      _storesLoading = false;
      notifyListeners();
    }
  }

  /// Market bosh ekranidagi "Chegirmalar" lentasi (spec v5 §4).
  List<ActivePromotion> get activePromotions => _activePromotions;

  AddressDetails? get lastAddressDetails {
    final orders = [..._orderHistory]..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    for (final o in orders) {
      if (o.addressDetails != null) return o.addressDetails;
    }
    return null;
  }

  Future<void> loadActivePromotions() async {
    _activePromotions = await fetchActivePromotions(_apiClient, 'market');
    notifyListeners();
  }

  void _setState(MarketProviderState state) {
    _state = state;
    notifyListeners();
  }

  /// Loads a store with its catalogue.
  ///
  /// [storeId] comes from an ad banner pointing at one particular store.
  /// Without it the first listed store opens (fallback for search and for a
  /// banner whose store is gone); the store picker is `MarketHomeScreen`.
  ///
  /// A banner can outlive its store (deactivated, deleted), so if the
  /// requested store fails to load we fall back to the first one rather
  /// than greeting the user with an error after they tapped an ad.
  Future<void> loadStore({String? storeId}) async {
    final showedCache = _showCachedStore(storeId);
    _setState(showedCache ? MarketProviderState.success : MarketProviderState.loading);
    try {
      if (storeId != null) {
        try {
          await _loadStoreDetail(storeId);
          _setState(MarketProviderState.success);
          return;
        } catch (e) {
          debugPrint('[MarketProvider] store $storeId unavailable, falling back: $e');
        }
      }
      final listRes = await _apiClient.get(ApiEndpoints.marketStores);
      final stores = ((listRes.data as Map<String, dynamic>)['data'] as List<dynamic>);
      if (stores.isEmpty) {
        _error = AppL10n.current.saNoStoreYet;
        _setState(MarketProviderState.error);
        return;
      }
      await _loadStoreDetail((stores.first as Map<String, dynamic>)['id'] as String);
      _setState(MarketProviderState.success);
    } catch (e) {
      debugPrint('[MarketProvider] loadStore error: $e');
      // Keshdagi katalog ko'rinib turibdi — xato ekrani bilan almashtirmaymiz.
      if (showedCache) return;
      _error = extractErrorMessage(e);
      _setState(MarketProviderState.error);
    }
  }

  Future<void> _loadStoreDetail(String storeId) async {
    final detailRes = await _apiClient.get(ApiEndpoints.marketStore(storeId));
    final detail = (detailRes.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    _applyStoreDetail(detail);
    unawaited(_cache?.write(_storeKey, detail));
  }

  void _applyStoreDetail(Map<String, dynamic> detail) {
    final store = MarketStore.fromJson(detail['store'] as Map<String, dynamic>);
    final categories = ((detail['categories'] as List<dynamic>))
        .map((e) => MarketCategory.fromJson(e as Map<String, dynamic>))
        .toList();
    final products = ((detail['products'] as List<dynamic>))
        .map((e) => MarketProduct.fromJson(e as Map<String, dynamic>))
        .toList();
    _store = store;
    _categories = categories;
    _products = products;
  }

  /// Keshdagi katalogni ko'rsatadi, agar u so'ralgan do'konniki bo'lsa.
  bool _showCachedStore(String? storeId) {
    final cached = _cache?.read(_storeKey);
    if (cached is! Map<String, dynamic>) return false;
    try {
      final cachedId = (cached['store'] as Map<String, dynamic>)['id'];
      if (storeId != null && cachedId != storeId) return false;
      _applyStoreDetail(cached);
      return true;
    } catch (e) {
      debugPrint('[MarketProvider] cached store unreadable: $e');
      return false;
    }
  }

  Future<MarketOrder?> createOrder({
    required List<CartItem> items,
    required String deliveryAddress,
    required double deliveryLat,
    required double deliveryLng,
    String paymentMethod = 'cash',
    String? promoCode,
    AddressDetails? addressDetails,
  }) async {
    if (_store == null || items.isEmpty) return null;

    _setState(MarketProviderState.loading);
    try {
      final response = await _apiClient.post(
        ApiEndpoints.marketOrders,
        data: withOrderExtras(
          {
            'storeId': _store!.id,
            'items': items.map((c) => {'productId': c.id, 'qty': c.qty}).toList(),
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
      _activeOrder = MarketOrder.fromJson(data);
      _listenToOrderEvents();
      _setState(MarketProviderState.success);
      return _activeOrder;
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(MarketProviderState.error);
      return null;
    }
  }

  void _listenToOrderEvents() {
    _socketService.on(SocketEvents.marketOrderStatus, (data) {
      if (data is Map && _activeOrder != null && data['orderId'] == _activeOrder!.id) {
        final status = marketOrderStatusFromString(data['status'] as String? ?? '');
        _activeOrder = _activeOrder!.copyWith(status: status);
        notifyListeners();
        if (!status.isActive) {
          _socketService.off(SocketEvents.marketOrderStatus);
        }
      }
    });
  }

  Future<void> checkActiveOrder() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.marketOrders);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      final orders = list.map((e) => MarketOrder.fromJson(e as Map<String, dynamic>));
      final active = orders.where((o) => o.status.isActive);
      if (active.isNotEmpty) {
        _activeOrder = active.first;
        _listenToOrderEvents();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[MarketProvider] checkActiveOrder error: $e');
    }
  }

  Future<void> loadOrderHistory() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.marketOrders);
      final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
      _orderHistory = list.map((e) => MarketOrder.fromJson(e as Map<String, dynamic>)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[MarketProvider] loadOrderHistory error: $e');
    }
  }

  /// Mijoz buyurtmani bekor qiladi (spec v5 §1).
  Future<VendorCancelResult> cancelOrder(String orderId, {String? reason}) async {
    final result = await postVendorCancel(
      _apiClient,
      ApiEndpoints.marketOrderCancel(orderId),
      reason: reason,
    );
    if (result.isCancelled) {
      MarketOrder? updated;
      try {
        if (result.order != null) updated = MarketOrder.fromJson(result.order!);
      } catch (e) {
        debugPrint('[MarketProvider] cancel response unreadable: $e');
      }
      MarketOrder next(MarketOrder o) => updated ?? o.copyWith(status: MarketOrderStatus.cancelled);
      _orderHistory = [for (final o in _orderHistory) o.id == orderId ? next(o) : o];
      if (_activeOrder?.id == orderId) {
        _activeOrder = next(_activeOrder!);
        if (!_activeOrder!.status.isActive) {
          _socketService.off(SocketEvents.marketOrderStatus);
        }
      }
      notifyListeners();
    } else if (result.outcome == VendorCancelOutcome.notAllowed) {
      await loadOrderHistory();
    }
    return result;
  }

  @visibleForTesting
  void debugSetOrderHistory(List<MarketOrder> orders) {
    _orderHistory = orders;
    notifyListeners();
  }

  void clearActiveOrder() {
    _socketService.off(SocketEvents.marketOrderStatus);
    _activeOrder = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _socketService.off(SocketEvents.marketOrderStatus);
    super.dispose();
  }
}

MarketProvider buildMarketProvider() => MarketProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
      cache: sl<JsonCache>(),
    );
