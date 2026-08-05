import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/food_restaurant.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
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
                  const AppSkeletonList(itemCount: 4)
                else if (food.state == FoodProviderState.error && food.restaurants.isEmpty)
                  AppErrorState(
                    message: food.error ?? 'Xatolik yuz berdi',
                    onRetry: () => context.read<FoodProvider>().loadRestaurants(),
                  )
                else if (food.restaurants.isEmpty)
                  AppEmptyState(
                    icon: Icons.storefront_outlined,
                    title: 'Restoran topilmadi',
                    message: 'Hozircha ochiq restoran yo\'q. Birozdan keyin qayta urinib ko\'ring.',
                    actionLabel: 'Yangilash',
                    onAction: () => context.read<FoodProvider>().loadRestaurants(),
                  )
                else
                  ListView(
                    padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 110),
                    children: [
                      for (final r in food.restaurants) ...[
                        _FoodCard(
                          restaurant: r,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => RestaurantDetailScreen(restaurantId: r.id)),
                          ),
                        ),
                        const SizedBox(height: kSpace4),
                      ],
                    ],
                  ),
                if (cart.cartCount > 0)
                  Positioned(
                    left: kSpace4,
                    right: kSpace4,
                    bottom: MediaQuery.of(context).padding.bottom + kSpace4,
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
      padding: EdgeInsets.fromLTRB(
          kSpace4, MediaQuery.of(context).padding.top + kSpace3, kSpace4, kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: 'Orqaga'),
          const SizedBox(width: kSpace3),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ovqat yetkazish',
                    style: TextStyle(
                        fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
                Text('Angren · 20–40 daqiqa',
                    style: TextStyle(
                        fontSize: kFontCaption, fontWeight: FontWeight.w600, color: agSubtle)),
              ],
            ),
          ),
          AgIconButton(
            icon: Icons.shopping_bag_outlined,
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
            badge: cartCount > 0 ? '$cartCount' : null,
            semanticsLabel: cartCount > 0 ? 'Savat, $cartCount ta mahsulot' : 'Savat',
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
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusLg),
            boxShadow: agCardShadow,
          ),
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
                    child: ExcludeSemantics(
                      child: Icon(Icons.restaurant_rounded,
                          size: 48, color: agOnPrimary.withValues(alpha: 0.7)),
                    ),
                  ),
                  Positioned(
                    top: kSpace3,
                    left: kSpace3,
                    child: AppStatusBadge(
                      label: r.isOpen ? 'Ochiq' : 'Yopiq',
                      tone: r.isOpen ? AppStatusTone.success : AppStatusTone.danger,
                      dense: true,
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                    if (r.address != null) ...[
                      const SizedBox(height: kSpace1),
                      Text(r.address!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
