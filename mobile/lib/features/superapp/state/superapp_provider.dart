import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:flutter/foundation.dart';

/// Holds cross-vertical super-app state: the unified cart, wallet balance and
/// the active bottom-navigation tab. Food/Market/Cargo have no backend yet, so
/// this is local state today; swap the bodies for API calls when ready.
class SuperappProvider extends ChangeNotifier {
  static const double _deliveryFee = 7000;

  final List<CartItem> _cart = [];
  double _walletBalance = 124500;
  int _tabIndex = 0;

  List<CartItem> get cart => List.unmodifiable(_cart);
  bool get isCartEmpty => _cart.isEmpty;
  int get cartCount => _cart.fold(0, (sum, c) => sum + c.qty);
  double get cartSubtotal => _cart.fold(0, (sum, c) => sum + c.lineTotal);
  double get deliveryFee => _cart.isEmpty ? 0 : _deliveryFee;
  double get cartTotal => cartSubtotal + deliveryFee;

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
