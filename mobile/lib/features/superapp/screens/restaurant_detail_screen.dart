import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/dish.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class RestaurantDetailScreen extends StatefulWidget {
  const RestaurantDetailScreen({super.key, required this.restaurantId});
  final String restaurantId;

  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final food = context.read<FoodProvider>();
      await food.loadRestaurantDetail(widget.restaurantId);
      if (mounted && food.restaurant != null) {
        context.read<SuperappProvider>().setActiveContext('food', food.restaurant!.id);
      }
    });
  }

  void _add(BuildContext context, Dish d) {
    context.read<SuperappProvider>().addToCart(
          CartItem(id: d.id, name: d.name, price: d.price, qty: 1, icon: d.icon, color: d.color),
        );
  }

  @override
  Widget build(BuildContext context) {
    final food = context.watch<FoodProvider>();
    final provider = context.watch<SuperappProvider>();
    final topPad = MediaQuery.of(context).padding.top;

    if (food.state == FoodProviderState.loading && food.restaurant == null) {
      return const Scaffold(
        backgroundColor: agSurface,
        body: SafeArea(child: AppSkeletonList(itemCount: 5, hasTrailing: true)),
      );
    }
    if (food.restaurant == null) {
      return Scaffold(
        backgroundColor: agSurface,
        body: SafeArea(
          child: AppErrorState(
            message: food.error ?? 'Restoran topilmadi',
            onRetry: () => context.read<FoodProvider>().loadRestaurantDetail(widget.restaurantId),
          ),
        ),
      );
    }

    final r = food.restaurant!;

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
                      color: agOrange,
                      alignment: Alignment.center,
                      child: ExcludeSemantics(
                        child: Icon(Icons.restaurant_rounded,
                            size: 96, color: agOnPrimary.withValues(alpha: 0.7)),
                      ),
                    ),
                    Positioned(
                      top: topPad + kSpace2,
                      left: kSpace4,
                      child: AgIconButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => Navigator.of(context).pop(),
                        semanticsLabel: 'Orqaga',
                        background: agSurface,
                        size: 44,
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -22),
                child: Container(
                  decoration: const BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
                  ),
                  padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppStatusBadge(
                        label: r.isOpen ? 'Ochiq' : 'Yopiq',
                        tone: r.isOpen ? AppStatusTone.success : AppStatusTone.danger,
                      ),
                      const SizedBox(height: kSpace2),
                      Text(r.name,
                          style: const TextStyle(
                              fontSize: kFontH1,
                              fontWeight: FontWeight.w800,
                              color: agText,
                              letterSpacing: -0.4)),
                      if (r.address != null) ...[
                        const SizedBox(height: kSpace2),
                        Row(
                          children: [
                            const ExcludeSemantics(
                              child: Icon(Icons.location_on_rounded, size: 17, color: agSubtle),
                            ),
                            const SizedBox(width: kSpace2),
                            Expanded(
                              child: Text(r.address!,
                                  style: const TextStyle(
                                      fontSize: kFontCaption,
                                      color: agSubtle,
                                      fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: kSpace5),
                      const Text('Menyu',
                          style: TextStyle(
                              fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText)),
                      const SizedBox(height: kSpace3),
                      if (food.dishes.isEmpty)
                        const AppEmptyState(
                          icon: Icons.restaurant_menu_rounded,
                          title: "Menyu bo'sh",
                          message: 'Bu restoran hozircha taom qo\'shmagan.',
                          compact: true,
                        )
                      else
                        for (final d in food.dishes) ...[
                          _DishRow(dish: d, onAdd: d.isAvailable ? () => _add(context, d) : null),
                          const SizedBox(height: kSpace3),
                        ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (provider.cartCount > 0)
            Positioned(
              left: kSpace4,
              right: kSpace4,
              bottom: MediaQuery.of(context).padding.bottom + kSpace4,
              child: AgCartBar(
                count: provider.cartCount,
                label: "Savatga o'tish",
                trailing: Formatters.formatSom(provider.cartSubtotal),
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
              ),
            ),
        ],
      ),
    );
  }
}

class _DishRow extends StatelessWidget {
  const _DishRow({required this.dish, required this.onAdd});
  final Dish dish;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    final d = dish;
    return Opacity(
      opacity: d.isAvailable ? 1 : 0.55,
      child: Container(
        padding: const EdgeInsets.all(kSpace3),
        decoration: BoxDecoration(
          color: agSurface2,
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        child: Row(
          children: [
            ExcludeSemantics(
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: d.color,
                  borderRadius: BorderRadius.circular(kRadiusSm),
                ),
                child: Icon(d.icon, size: 30, color: agOnPrimary.withValues(alpha: 0.95)),
              ),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(d.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                  const SizedBox(height: 2),
                  if (d.description != null)
                    Text(d.description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: kFontCaption,
                            color: agSubtle,
                            fontWeight: FontWeight.w500,
                            height: 1.4)),
                  const SizedBox(height: kSpace2),
                  Text(
                    d.isAvailable ? Formatters.formatSom(d.price) : 'Tugagan',
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: kFontBody,
                        color: d.isAvailable ? agText : agSubtle),
                  ),
                ],
              ),
            ),
            const SizedBox(width: kSpace2),
            if (onAdd != null)
              Semantics(
                button: true,
                label: '${d.name} — savatga qo\'shish',
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: onAdd,
                  behavior: HitTestBehavior.opaque,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minWidth: kMinTapTarget,
                      minHeight: kMinTapTarget,
                    ),
                    child: Center(
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: agPrimary,
                          borderRadius: BorderRadius.circular(kRadiusSm),
                          boxShadow: agCtaShadow,
                        ),
                        child: const Icon(Icons.add_rounded, color: agOnPrimary, size: 24),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
