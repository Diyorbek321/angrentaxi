import 'package:flutter/material.dart';

/// Catalog models for the Angren Go super-app verticals (food, market, cargo).
/// These mirror the interactive prototype's data shapes and are intentionally
/// lightweight so they can be backed by a real API later without UI changes.

@immutable
class Dish {
  const Dish({
    required this.id,
    required this.name,
    required this.price,
    required this.desc,
    required this.icon,
    required this.color,
  });

  final String id;
  final String name;
  final double price;
  final String desc;
  final IconData icon;
  final Color color;
}

@immutable
class Restaurant {
  const Restaurant({
    required this.id,
    required this.name,
    required this.tag,
    required this.rating,
    required this.time,
    required this.fee,
    required this.color,
    required this.icon,
    required this.menu,
  });

  final String id;
  final String name;
  final String tag;
  final String rating;
  final String time;
  final String fee; // "Bepul" or "5 000"
  final Color color;
  final IconData icon;
  final List<Dish> menu;

  /// Human label shown in the detail header.
  String get feeLabel => fee == 'Bepul' ? 'Bepul yetkazish' : '$fee so\'m yetkazish';
}

@immutable
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    required this.unit,
    required this.icon,
    required this.color,
  });

  final String id;
  final String name;
  final double price;
  final String unit;
  final IconData icon;
  final Color color;
}

@immutable
class Tariff {
  const Tariff({
    required this.id,
    required this.name,
    required this.icon,
    required this.price,
    required this.eta,
    required this.desc,
  });

  final String id;
  final String name;
  final IconData icon;
  final double price;
  final String eta;
  final String desc;
}
