import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:flutter/foundation.dart';

/// Eski buyurtmaning bitta qatori: nima va nechta.
@immutable
class ReorderLine {
  const ReorderLine({required this.id, required this.qty});

  final String id;
  final int qty;
}

/// "Yana buyurtma qilish" natijasi: savatga tushadigan qatorlar va
/// topilmagan (o'chirilgan, tugagan) taomlar soni.
@immutable
class ReorderPlan {
  const ReorderPlan({required this.items, required this.missing});

  final List<CartItem> items;

  /// Menyuda endi yo'q yoki mavjud emas qatorlar soni.
  final int missing;

  /// Qatorlardan kamida biri qisqartirildi yoki tushib qoldi.
  bool get isPartial => missing > 0;
  bool get isEmpty => items.isEmpty;
}

/// Eski buyurtmani HOZIRGI katalog bo'yicha savatga aylantiradi.
///
/// Narx eski buyurtmadan OLINMAYDI — `catalog` dagi joriy narx (aksiya
/// bilan) ishlatiladi, aks holda savat summasi server hisoblaydiganidan
/// farq qilardi. `catalog` faqat buyurtma qilsa bo'ladigan narsalarni
/// saqlaydi. `maxQty` — zaxira chegarasi (market); `null` — cheklanmagan.
ReorderPlan planReorder(
  List<ReorderLine> lines,
  Map<String, CartItem> catalog, {
  int? Function(String id)? maxQty,
}) {
  final items = <CartItem>[];
  var missing = 0;
  for (final line in lines) {
    final template = catalog[line.id];
    final limit = maxQty?.call(line.id);
    final qty = limit == null ? line.qty : (line.qty < limit ? line.qty : limit);
    if (template == null || qty <= 0) {
      missing++;
      continue;
    }
    if (qty < line.qty) missing++;
    items.add(template.copyWith(qty: qty));
  }
  return ReorderPlan(items: List.unmodifiable(items), missing: missing);
}

/// Ovqat buyurtmasini takrorlash rejasi — restoran menyusi yangilanadi.
/// Restoran yopiq bo'lsa yoki menyu yuklanmasa — `null`.
Future<ReorderPlan?> planFoodReorder(FoodProvider food, FoodOrder order) async {
  await food.loadRestaurantDetail(order.restaurantId);
  final restaurant = food.restaurant;
  if (restaurant == null || restaurant.id != order.restaurantId || !restaurant.isOpen) {
    return null;
  }
  final catalog = {
    for (final d in food.dishes.where((d) => d.isAvailable))
      d.id: CartItem(
        id: d.id,
        name: d.name,
        price: d.effectivePrice,
        qty: 1,
        icon: d.icon,
        color: d.color,
        imageUrl: d.imageUrl,
      ),
  };
  return planReorder(
    order.items.map((i) => ReorderLine(id: i.dishId, qty: i.qty)).toList(),
    catalog,
  );
}

/// Market buyurtmasini takrorlash rejasi — zaxiradan oshmaydi.
/// Do'kon topilmasa (server boshqasiga o'tib ketsa ham) — `null`.
Future<ReorderPlan?> planMarketReorder(MarketProvider market, MarketOrder order) async {
  await market.loadStore(storeId: order.storeId);
  final store = market.store;
  if (store == null || store.id != order.storeId) return null;
  final available = market.products.where((p) => p.isAvailable).toList();
  final stock = {for (final p in available) p.id: p.stock};
  final catalog = {
    for (final p in available)
      p.id: CartItem(
        id: p.id,
        name: p.name,
        price: p.effectivePrice,
        qty: 1,
        icon: p.icon,
        color: p.color,
        imageUrl: p.imageUrl,
      ),
  };
  return planReorder(
    order.items.map((i) => ReorderLine(id: i.productId, qty: i.qty)).toList(),
    catalog,
    maxQty: (id) => stock[id],
  );
}
