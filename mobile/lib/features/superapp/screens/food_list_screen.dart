import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class FoodListScreen extends StatefulWidget {
  const FoodListScreen({super.key});

  @override
  State<FoodListScreen> createState() => _FoodListScreenState();
}

class _FoodListScreenState extends State<FoodListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FoodProvider>().loadRestaurants();
    });
  }

  @override
  Widget build(BuildContext context) {
    final food = context.watch<FoodProvider>();
    final cart = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          _FoodHeader(cartCount: cart.cartCount),
          Expanded(
            child: Stack(
              children: [
                if (food.state == FoodProviderState.loading && food.restaurants.isEmpty)
                  const Center(child: CircularProgressIndicator(color: agGreen))
                else if (food.state == FoodProviderState.error && food.restaurants.isEmpty)
                  Center(
                    child: Text(food.error ?? 'Xatolik yuz berdi', style: const TextStyle(color: agSubtle, fontWeight: FontWeight.w600)),
                  )
                else
                  ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
                    children: [
                      for (final r in food.restaurants) ...[
                        _FoodCard(
                          restaurant: r,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => RestaurantDetailScreen(restaurantId: r.id)),
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],
                    ],
                  ),
                if (cart.cartCount > 0)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: MediaQuery.of(context).padding.bottom + 18,
                    child: AgCartBar(
                      count: cart.cartCount,
                      label: "Savatga o'tish",
                      trailing: Formatters.formatSom(cart.cartSubtotal),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => const CartScreen()),
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
      padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 14),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 6))],
      ),
      child: Row(
        children: [
          AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ovqat yetkazish', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: agText)),
                Text('Angren · 20–40 daqiqa', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: agSubtle)),
              ],
            ),
          ),
          AgIconButton(
            icon: Icons.shopping_bag_outlined,
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
            badge: cartCount > 0 ? '$cartCount' : null,
          ),
        ],
      ),
    );
  }
}

class _FoodCard extends StatelessWidget {
  const _FoodCard({required this.restaurant, required this.onTap});
  final FoodRestaurant restaurant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(color: agSurface, borderRadius: BorderRadius.circular(20), boxShadow: agCardShadow),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  height: 100,
                  width: double.infinity,
                  color: agOrange,
                  child: const Icon(Icons.restaurant_rounded, size: 48, color: Colors.white70),
                ),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: (r.isOpen ? agGreen : agRed).withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(r.isOpen ? 'Ochiq' : 'Yopiq',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                  if (r.address != null) ...[
                    const SizedBox(height: 4),
                    Text(r.address!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w600)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
