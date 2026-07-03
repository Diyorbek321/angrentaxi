import 'package:angren_taxi/features/superapp/data/superapp_catalog.dart';
import 'package:angren_taxi/features/superapp/models/catalog_models.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class FoodListScreen extends StatelessWidget {
  const FoodListScreen({super.key});

  static const _cats = ['Hammasi', 'Osh', 'Fastfud', 'Pitsa', 'Shirinlik'];

  @override
  Widget build(BuildContext context) {
    const restaurants = SuperappCatalog.restaurants;
    final provider = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          _FoodHeader(cartCount: provider.cartCount),
          Expanded(
            child: Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
                  children: [
                    for (final r in restaurants) ...[
                      _FoodCard(
                        restaurant: r,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                              builder: (_) =>
                                  RestaurantDetailScreen(restaurant: r)),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                  ],
                ),
                if (provider.cartCount > 0)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: MediaQuery.of(context).padding.bottom + 18,
                    child: AgCartBar(
                      count: provider.cartCount,
                      label: "Savatga o'tish",
                      trailing: Formatters.formatSom(provider.cartSubtotal),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                            builder: (_) => const CartScreen()),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FoodHeader extends StatelessWidget {
  const _FoodHeader({required this.cartCount});
  final int cartCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, MediaQuery.of(context).padding.top + 12, 16, 14),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: [
          BoxShadow(
              color: agInk.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, 6)),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              AgIconButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => Navigator.of(context).pop()),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ovqat yetkazish',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: agText)),
                    Text('Angren · 20–40 daqiqa',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: agSubtle)),
                  ],
                ),
              ),
              const AgIconButton(icon: Icons.tune_rounded, onTap: _noop),
              const SizedBox(width: 10),
              AgIconButton(
                icon: Icons.shopping_bag_outlined,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                ),
                badge: cartCount > 0 ? '$cartCount' : null,
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 34,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: FoodListScreen._cats.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final active = i == 0;
                return Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  decoration: BoxDecoration(
                    color: active ? agGreen : agBg,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Text(
                    FoodListScreen._cats[i],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: active ? Colors.white : agText,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  static void _noop() {}
}

class _FoodCard extends StatelessWidget {
  const _FoodCard({required this.restaurant, required this.onTap});
  final Restaurant restaurant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: agCardShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  height: 118,
                  width: double.infinity,
                  color: r.color,
                  child: Icon(r.icon,
                      size: 54, color: Colors.white.withValues(alpha: 0.92)),
                ),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: agInk.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text('${r.fee} yetkazish',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(r.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: agText)),
                      ),
                      const Icon(Icons.star_rounded, size: 15, color: agOrange),
                      const SizedBox(width: 3),
                      Text(r.rating,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 12.5,
                              color: agText)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(r.tag,
                      style: const TextStyle(
                          fontSize: 12.5,
                          color: agSubtle,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded,
                          size: 15, color: agSubtle),
                      const SizedBox(width: 5),
                      Text(r.time,
                          style: const TextStyle(
                              fontSize: 12,
                              color: agSubtle,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
