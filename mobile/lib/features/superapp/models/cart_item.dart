import 'package:flutter/material.dart';

/// A line item in the unified Angren Go cart (food + market).
@immutable
class CartItem {
  const CartItem({
    required this.id,
    required this.name,
    required this.price,
    required this.qty,
    required this.icon,
    required this.color,
    this.imageUrl,
  });

  final String id;
  final String name;
  final double price;
  final int qty;
  final IconData icon;
  final Color color;
  final String? imageUrl;

  double get lineTotal => price * qty;

  CartItem copyWith({int? qty}) => CartItem(
        id: id,
        name: name,
        price: price,
        qty: qty ?? this.qty,
        icon: icon,
        color: color,
        imageUrl: imageUrl,
      );
}
