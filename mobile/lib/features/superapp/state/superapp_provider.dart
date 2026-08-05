import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:flutter/foundation.dart';

/// Holds cross-vertical super-app state: the unified cart, wallet balance and
/// the active bottom-navigation tab. Food/Market order placement itself goes
/// through [FoodProvider]/[MarketProvider] against the real backend; the cart
/// below is client-side until a server-side cart exists, and [walletBalance]
/// is still a placeholder with no wallet endpoint behind it.
class SuperappProvider extends ChangeNotifier {
  static const double _deliveryFee = 7000;

  final List<CartItem> _cart = [];
  double _walletBalance = 124500;
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

  double get walletBalance => _walletBalance;

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

  void topUp(double amount) {
    _walletBalance += amount;
    notifyListeners();
  }
}
