import 'package:angren_taxi/features/superapp/models/catalog_models.dart';
import 'package:flutter/material.dart';

/// Static catalog matching the Angren Go interactive prototype. When the
/// backend gains food/market/cargo modules this becomes a repository fetch;
/// the screens consume it through [SuperappProvider] so they won't change.
class SuperappCatalog {
  SuperappCatalog._();

  static const List<Tariff> tariffs = [
    Tariff(id: 'econom', name: 'Econom', icon: Icons.directions_car_rounded, price: 12000, eta: '4 daq', desc: 'Tejamkor narx'),
    Tariff(id: 'comfort', name: 'Comfort', icon: Icons.local_taxi_rounded, price: 18000, eta: '3 daq', desc: 'Yangi mashinalar'),
    Tariff(id: 'business', name: 'Business', icon: Icons.airline_seat_recline_extra_rounded, price: 32000, eta: '6 daq', desc: 'Premium darajada'),
  ];

  static const List<Restaurant> restaurants = [
    Restaurant(
      id: 'r1', name: 'Milliy Taomlar', tag: "O'zbek · Osh", rating: '4.9', time: '25–35 daq',
      fee: 'Bepul', color: Color(0xFFF59E0B), icon: Icons.rice_bowl_rounded,
      menu: [
        Dish(id: 'r1d1', name: 'Toy oshi', price: 38000, desc: "An'anaviy palov, qazi bilan", icon: Icons.rice_bowl_rounded, color: Color(0xFFF59E0B)),
        Dish(id: 'r1d2', name: 'Somsa (tandir)', price: 9000, desc: "Go'shtli, tandirda", icon: Icons.bakery_dining_rounded, color: Color(0xFFE08A2B)),
        Dish(id: 'r1d3', name: "Lag'mon", price: 28000, desc: "Qo'lda tortilgan, sabzavotli", icon: Icons.ramen_dining_rounded, color: Color(0xFF10A064)),
        Dish(id: 'r1d4', name: 'Shashlik (3 dona)', price: 45000, desc: "Mol go'shti, ko'mirda", icon: Icons.outdoor_grill_rounded, color: Color(0xFFE5484D)),
      ],
    ),
    Restaurant(
      id: 'r2', name: 'Burger Time', tag: 'Fastfud · Burger', rating: '4.7', time: '15–25 daq',
      fee: '5 000', color: Color(0xFFE5484D), icon: Icons.lunch_dining_rounded,
      menu: [
        Dish(id: 'r2d1', name: 'Cheeseburger', price: 32000, desc: "Mol go'shti, chedder, sous", icon: Icons.lunch_dining_rounded, color: Color(0xFFE5484D)),
        Dish(id: 'r2d2', name: 'Double Beef', price: 48000, desc: 'Ikki kotlet, bekon', icon: Icons.lunch_dining_rounded, color: Color(0xFFC2410C)),
        Dish(id: 'r2d3', name: 'Free fri', price: 14000, desc: 'Qarsildoq kartoshka', icon: Icons.fastfood_rounded, color: Color(0xFFF59E0B)),
        Dish(id: 'r2d4', name: 'Lavash', price: 26000, desc: "Tovuq go'shti, sabzavot", icon: Icons.kebab_dining_rounded, color: Color(0xFF10A064)),
      ],
    ),
    Restaurant(
      id: 'r3', name: 'Pizza Napoli', tag: 'Italyan · Pitsa', rating: '4.8', time: '30–40 daq',
      fee: '7 000', color: Color(0xFF10A064), icon: Icons.local_pizza_rounded,
      menu: [
        Dish(id: 'r3d1', name: 'Margarita', price: 42000, desc: 'Pomidor, motsarella, rayhon', icon: Icons.local_pizza_rounded, color: Color(0xFF10A064)),
        Dish(id: 'r3d2', name: 'Pepperoni', price: 54000, desc: 'Achchiq kolbasa, pishloq', icon: Icons.local_pizza_rounded, color: Color(0xFFE5484D)),
        Dish(id: 'r3d3', name: '4 pishloq', price: 58000, desc: "To'rt xil pishloq", icon: Icons.local_pizza_rounded, color: Color(0xFFF59E0B)),
        Dish(id: 'r3d4', name: 'Garlic bread', price: 18000, desc: 'Sarimsoqli non', icon: Icons.bakery_dining_rounded, color: Color(0xFFE08A2B)),
      ],
    ),
    Restaurant(
      id: 'r4', name: 'Choyxona 24', tag: 'Choy · Shirinlik', rating: '4.6', time: '20–30 daq',
      fee: 'Bepul', color: Color(0xFF8B5CF6), icon: Icons.bakery_dining_rounded,
      menu: [
        Dish(id: 'r4d1', name: "Ko'k choy", price: 6000, desc: "An'anaviy, piyola bilan", icon: Icons.emoji_food_beverage_rounded, color: Color(0xFF10A064)),
        Dish(id: 'r4d2', name: 'Chak-chak', price: 22000, desc: 'Asalli shirinlik', icon: Icons.cake_rounded, color: Color(0xFFF59E0B)),
        Dish(id: 'r4d3', name: 'Boursak', price: 15000, desc: 'Yumshoq, issiq', icon: Icons.bakery_dining_rounded, color: Color(0xFFE08A2B)),
        Dish(id: 'r4d4', name: 'Holva', price: 19000, desc: "Yong'oqli holva", icon: Icons.cookie_rounded, color: Color(0xFF8B5CF6)),
      ],
    ),
  ];

  static const List<Product> products = [
    Product(id: 'p1', name: 'Sut 2.5%', price: 12000, unit: '1 L', icon: Icons.water_drop_rounded, color: Color(0xFF3B82F6)),
    Product(id: 'p2', name: 'Non (patir)', price: 4000, unit: '1 dona', icon: Icons.bakery_dining_rounded, color: Color(0xFFE08A2B)),
    Product(id: 'p3', name: 'Tuxum', price: 18000, unit: '10 dona', icon: Icons.egg_rounded, color: Color(0xFFF59E0B)),
    Product(id: 'p4', name: 'Pomidor', price: 9000, unit: '1 kg', icon: Icons.local_florist_rounded, color: Color(0xFFE5484D)),
    Product(id: 'p5', name: 'Olma', price: 14000, unit: '1 kg', icon: Icons.local_florist_rounded, color: Color(0xFF10A064)),
    Product(id: 'p6', name: 'Suv 1.5L', price: 3500, unit: '1 dona', icon: Icons.water_drop_rounded, color: Color(0xFF06B6D4)),
  ];
}
