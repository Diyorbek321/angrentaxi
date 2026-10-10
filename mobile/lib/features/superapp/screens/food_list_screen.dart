import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
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
                    message: food.error ?? context.l10n.saErrorOccurred,
                    onRetry: () => context.read<FoodProvider>().loadRestaurants(),
                  )
                else if (food.restaurants.isEmpty)
                  AppEmptyState(
                    icon: Icons.storefront_outlined,
                    title: context.l10n.saFoodNoRestaurantsTitle,
                    message: context.l10n.saFoodNoRestaurantsMessage,
                    actionLabel: context.l10n.saRefresh,
                    onAction: () => context.read<FoodProvider>().loadRestaurants(),
                  )
                else
                  // Dangasa ro'yxat — faqat ko'ringan kartalar quriladi.
                  ListView.builder(
                    padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 110),
                    itemCount: food.restaurants.length,
                    itemBuilder: (context, i) {
                      final r = food.restaurants[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: kSpace4),
                        child: _FoodCard(
                          restaurant: r,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => RestaurantDetailScreen(restaurantId: r.id)),
                          ),
                        ),
                      );
                    },
                  ),
                if (cart.cartCount > 0)
                  Positioned(
                    left: kSpace4,
                    right: kSpace4,
                    bottom: MediaQuery.of(context).padding.bottom + kSpace4,
                    child: AgCartBar(
                      count: cart.cartCount,
                      label: context.l10n.saGoToCart,
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
          AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: context.l10n.saBack),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(context.l10n.saFoodTitle,
                    style: const TextStyle(
                        fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
                Text(context.l10n.saFoodSubtitle,
                    style: const TextStyle(
                        fontSize: kFontCaption, fontWeight: FontWeight.w600, color: agSubtle)),
              ],
            ),
          ),
          AgIconButton(
            icon: Icons.shopping_bag_outlined,
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
            badge: cartCount > 0 ? '$cartCount' : null,
            semanticsLabel: cartCount > 0
                ? context.l10n.saCartWithCount(cartCount)
                : context.l10n.saCart,
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
                      label: r.isOpen ? context.l10n.saOpen : context.l10n.saClosed,
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
