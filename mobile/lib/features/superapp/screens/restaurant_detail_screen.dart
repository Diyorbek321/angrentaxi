import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/models/catalog_models.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class RestaurantDetailScreen extends StatelessWidget {
  const RestaurantDetailScreen({super.key, required this.restaurant});
  final Restaurant restaurant;

  void _add(BuildContext context, Dish d) {
    context.read<SuperappProvider>().addToCart(
          CartItem(id: d.id, name: d.name, price: d.price, qty: 1, icon: d.icon, color: d.color),
        );
  }

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    final provider = context.watch<SuperappProvider>();
    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: agSurface,
      body: Stack(
        children: [
          ListView(
            padding: EdgeInsets.zero,
            children: [
              SizedBox(
                height: 230,
                child: Stack(
                  children: [
                    Container(
                      height: 230,
                      width: double.infinity,
                      color: r.color,
                      alignment: Alignment.center,
                      child: Icon(r.icon, size: 96, color: Colors.white.withValues(alpha: 0.92)),
                    ),
                    Positioned(
                      top: topPad + 8,
                      left: 16,
                      child: _RoundBtn(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => Navigator.of(context).pop(),
                      ),
                    ),
                    Positioned(
                      top: topPad + 8,
                      right: 16,
                      child: const _RoundBtn(icon: Icons.favorite_rounded, color: agRed),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -22),
                child: Container(
                  decoration: const BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  padding: const EdgeInsets.fromLTRB(18, 20, 18, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, size: 15, color: agOrange),
                          const SizedBox(width: 3),
                          Text(r.rating,
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: agText)),
                          const SizedBox(width: 4),
                          Text('· ${r.tag} · ${r.time}',
                              style: const TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(r.name,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.4)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.pedal_bike_rounded, size: 17, color: agGreen),
                          const SizedBox(width: 6),
                          Text(r.feeLabel,
                              style: const TextStyle(fontSize: 12.5, color: agGreen, fontWeight: FontWeight.w700)),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const Text('Menyu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: agText)),
                      const SizedBox(height: 12),
                      for (final d in r.menu) ...[
                        _DishRow(dish: d, onAdd: () => _add(context, d)),
                        const SizedBox(height: 12),
                      ],
                    ],
                  ),
                ),
              ),
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
                  MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RoundBtn extends StatelessWidget {
  const _RoundBtn({required this.icon, this.color = agText, this.onTap});
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(icon, color: color, size: 23),
      ),
    );
  }
}

class _DishRow extends StatelessWidget {
  const _DishRow({required this.dish, required this.onAdd});
  final Dish dish;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final d = dish;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFB),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(color: d.color, borderRadius: BorderRadius.circular(15)),
            child: Icon(d.icon, size: 30, color: Colors.white.withValues(alpha: 0.95)),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(d.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: agText)),
                const SizedBox(height: 2),
                Text(d.desc,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: agSubtle, fontWeight: FontWeight.w500, height: 1.4)),
                const SizedBox(height: 6),
                Text(Formatters.formatSom(d.price),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onAdd,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: agGreen,
                borderRadius: BorderRadius.circular(13),
                boxShadow: [
                  BoxShadow(color: agGreen.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 8)),
                ],
              ),
              child: const Icon(Icons.add_rounded, color: Colors.white, size: 24),
            ),
          ),
        ],
      ),
    );
  }
}
