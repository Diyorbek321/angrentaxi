import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/models/wallet_transaction.dart';
import 'package:flutter/foundation.dart';

/// Holds cross-vertical super-app state: the unified cart, wallet balance and
/// the active bottom-navigation tab. Food/Market order placement itself goes
/// through [FoodProvider]/[MarketProvider] against the real backend; the cart
/// below is client-side until a server-side cart exists.
///
/// [walletBalance] is read from the live `GET /payments/wallet` endpoint. It is
/// nullable on purpose: `null` means "not loaded yet / failed to load", and the
/// UI must render a neutral placeholder in that case rather than invent a
/// number the passenger might act on.
class SuperappProvider extends ChangeNotifier {
  SuperappProvider({required ApiClient apiClient}) : _apiClient = apiClient;

  /// Fallback used only until [loadPlatformSettings] answers — the server
  /// is the source of truth. This was previously a hardcoded constant that
  /// the checkout total was built from, so the passenger saw a figure the
  /// order row never contained.
  static const double _deliveryFeeFallback = 7000;

  double _deliveryFee = _deliveryFeeFallback;

  final ApiClient _apiClient;

  final List<CartItem> _cart = [];
  double? _walletBalance;
  bool _walletLoading = false;
  String? _walletError;
  List<WalletTransaction> _transactions = const [];
  bool _txnsLoading = false;
  String? _txnsError;
  int _tabIndex = 0;

  // Which real-backend vertical the current cart belongs to ('food' or
  // 'market') and which store/restaurant id, so checkout knows which
  // provider's createOrder to call. Switching context clears the cart —
  // items from two different stores can't be combined into one order.
  String? _activeKind;
  String? _activeEntityId;

  List<CartItem> get cart => List.unmodifiable(_cart);
  bool get isCartEmpty => _cart.isEmpty;
  int get cartCount => _cart.fold(0, (sum, c) => sum + c.qty);
  double get cartSubtotal => _cart.fold(0, (sum, c) => sum + c.lineTotal);
  double get deliveryFee => _cart.isEmpty ? 0 : _deliveryFee;
  double get cartTotal => cartSubtotal + deliveryFee;
  String? get activeKind => _activeKind;
  String? get activeEntityId => _activeEntityId;

  void setActiveContext(String kind, String entityId) {
    if (_activeKind != kind || _activeEntityId != entityId) {
      if (_cart.isNotEmpty) _cart.clear();
      _activeKind = kind;
      _activeEntityId = entityId;
      notifyListeners();
    }
  }

  /// `null` until [loadWalletBalance] succeeds — never a placeholder figure.
  double? get walletBalance => _walletBalance;
  bool get isWalletLoading => _walletLoading;
  String? get walletError => _walletError;

  List<WalletTransaction> get transactions => _transactions;
  bool get isTransactionsLoading => _txnsLoading;
  String? get transactionsError => _txnsError;

  /// Fetches the signed-in user's wallet balance from `GET /payments/wallet`.
  ///
  /// Backend shape (ResponseInterceptor envelope):
  /// `{ "success": true, "data": { "userId": "...", "balance": 12500 } }`.
  ///
  /// A failure leaves [walletBalance] untouched (so a transient error does not
  /// blank out an already-loaded balance) and records [walletError].
  Future<void> loadWalletBalance() async {
    if (_walletLoading) return;
    _walletLoading = true;
    _walletError = null;
    notifyListeners();
    try {
      final response = await _apiClient.get(ApiEndpoints.paymentsWallet);
      final envelope = response.data as Map<String, dynamic>;
      final payload = envelope['data'] as Map<String, dynamic>;
      final balance = (payload['balance'] as num?)?.toDouble();
      if (balance == null) {
        throw const FormatException('wallet response has no numeric balance');
      }
      _walletBalance = balance;
    } catch (e) {
      debugPrint('[SuperappProvider] loadWalletBalance error: $e');
      _walletError = extractErrorMessage(e);
    } finally {
      _walletLoading = false;
      notifyListeners();
    }
  }

  /// Reads the platform delivery fee so the cart total matches what the
  /// server will record for the order.
  Future<void> loadPlatformSettings() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.settingsPublic);
      final envelope = response.data as Map<String, dynamic>;
      final payload = envelope['data'] as Map<String, dynamic>;
      final fee = (payload['deliveryFee'] as num?)?.toDouble();
      if (fee != null) {
        _deliveryFee = fee;
        notifyListeners();
      }
    } catch (e) {
      // Keep the last known fee. A settings blip must not block checkout;
      // the server recomputes the authoritative total on order creation.
      debugPrint('[SuperappProvider] loadPlatformSettings error: $e');
    }
  }

  /// Real ledger history from `GET /payments/transactions`.
  ///
  /// Envelope: `{ success, data: { transactions: [...], total, page, limit } }`.
  Future<void> loadTransactions() async {
    if (_txnsLoading) return;
    _txnsLoading = true;
    _txnsError = null;
    notifyListeners();
    try {
      final response = await _apiClient.get(
        ApiEndpoints.paymentsTransactions,
        params: {'page': 1, 'limit': 20},
      );
      final envelope = response.data as Map<String, dynamic>;
      final payload = envelope['data'] as Map<String, dynamic>;
      final rows = (payload['transactions'] as List<dynamic>? ?? []);
      _transactions = rows
          .map((r) => WalletTransaction.fromJson(r as Map<String, dynamic>))
          .toList(growable: false);
    } catch (e) {
      debugPrint('[SuperappProvider] loadTransactions error: $e');
      _txnsError = extractErrorMessage(e);
    } finally {
      _txnsLoading = false;
      notifyListeners();
    }
  }

  int get tabIndex => _tabIndex;
  set tabIndex(int value) {
    if (value == _tabIndex) return;
    _tabIndex = value;
    notifyListeners();
  }

  void addToCart(CartItem item) {
    final index = _cart.indexWhere((c) => c.id == item.id);
    if (index >= 0) {
      _cart[index] = _cart[index].copyWith(qty: _cart[index].qty + item.qty);
    } else {
      _cart.add(item);
    }
    notifyListeners();
  }

  void increment(String id) {
    final index = _cart.indexWhere((c) => c.id == id);
    if (index < 0) return;
    _cart[index] = _cart[index].copyWith(qty: _cart[index].qty + 1);
    notifyListeners();
  }

  void decrement(String id) {
    final index = _cart.indexWhere((c) => c.id == id);
    if (index < 0) return;
    final next = _cart[index].qty - 1;
    if (next <= 0) {
      _cart.removeAt(index);
    } else {
      _cart[index] = _cart[index].copyWith(qty: next);
    }
    notifyListeners();
  }

  void clearCart() {
    _cart.clear();
    notifyListeners();
  }

}

SuperappProvider buildSuperappProvider() =>
    SuperappProvider(apiClient: sl<ApiClient>());
