import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/screens/cargo_screen.dart';
import 'package:angren_taxi/features/superapp/screens/food_list_screen.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/features/superapp/screens/notifications_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/search_screen.dart';
import 'package:angren_taxi/features/superapp/screens/wallet_screen.dart';
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
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

/// Angren Go home — green hero header, floating search, 4-service grid, a dark
/// taxi CTA and a popular-restaurants carousel. Pixel-faithful to the prototype.
class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final food = context.read<FoodProvider>();
      if (food.restaurants.isEmpty) food.loadRestaurants();
      final superapp = context.read<SuperappProvider>();
      if (superapp.walletBalance == null) superapp.loadWalletBalance();
    });
  }

  void _openTaxi(BuildContext context) {
    context.read<OrderProvider>().setServiceType('taxi');
    Navigator.of(context).pushNamed('/passenger/home');
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final balance = context.select<SuperappProvider, double?>((p) => p.walletBalance);
    final food = context.watch<FoodProvider>();
    final restaurants = food.restaurants;

    return Container(
      color: agBg,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 100),
        children: [
          _Header(
            balance: balance,
            onWallet: () => _push(context, const WalletScreen()),
            onNotifs: () => _push(context, const NotificationsScreen()),
            onSearch: () => _push(context, const SearchScreen()),
          ),
          const SizedBox(height: kSpace5),
          _ServiceGrid(
            onTaxi: () => _openTaxi(context),
            onFood: () => _push(context, const FoodListScreen()),
            onMarket: () => _push(context, const MarketScreen()),
            onCargo: () => _push(context, const CargoScreen()),
          ).animate().fadeIn(delay: 80.ms, duration: 400.ms).slideY(begin: 0.15, curve: Curves.easeOut),
          const SizedBox(height: kSpace4),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kSpace4),
            child: _TaxiCta(onTap: () => _openTaxi(context)),
          ).animate().fadeIn(delay: 160.ms, duration: 400.ms).slideY(begin: 0.15, curve: Curves.easeOut),
          const SizedBox(height: kSpace6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: kSpace4),
            child: AgSectionTitle(
              'Mashhur restoranlar',
              trailing: 'Barchasi',
              onTrailingTap: () => _push(context, const FoodListScreen()),
            ),
          ),
          const SizedBox(height: kSpace3),
          _RestaurantSection(
            state: food.state,
            error: food.error,
            restaurants: restaurants,
            onRetry: () => context.read<FoodProvider>().loadRestaurants(),
            onOpen: (r) => _push(context, RestaurantDetailScreen(restaurantId: r.id)),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.balance,
    required this.onWallet,
    required this.onNotifs,
    required this.onSearch,
  });

  /// `null` while the wallet balance is still loading or failed to load —
  /// rendered as a neutral placeholder instead of a made-up figure.
  final double? balance;
  final VoidCallback onWallet;
  final VoidCallback onNotifs;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          height: 180 + topPad,
          padding: EdgeInsets.fromLTRB(kSpace4, topPad + kSpace3, kSpace4, 0),
          decoration: const BoxDecoration(
            gradient: agHeader,
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(kRadiusXl)),
          ),
          child: Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.location_on_rounded, color: agOnPrimary, size: 20),
              ),
              const SizedBox(width: kSpace2),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Joriy manzil',
                      style: TextStyle(color: agOnPrimary, fontSize: kFontMicro, fontWeight: FontWeight.w600)),
                  Row(
                    children: [
                      Text('Angren shahri',
                          style: TextStyle(color: agOnPrimary, fontSize: kFontBody, fontWeight: FontWeight.w800)),
                      ExcludeSemantics(
                        child: Icon(Icons.expand_more_rounded, color: agOnPrimary, size: 16),
                      ),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              Semantics(
                button: true,
                label: 'Hamyon',
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: onWallet,
                  behavior: HitTestBehavior.opaque,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: kMinTapTarget),
                    child: Center(
                      child: Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: kSpace3),
                        decoration: BoxDecoration(
                          color: agSurface.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(kRadiusSm),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.account_balance_wallet_rounded,
                                color: agOnPrimary, size: 17),
                            const SizedBox(width: kSpace2),
                            Text(
                              balance == null ? '—' : Formatters.formatAmount(balance!),
                              style: const TextStyle(
                                  color: agOnPrimary,
                                  fontSize: kFontLabel,
                                  fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: kSpace2),
              Semantics(
                button: true,
                label: 'Bildirishnomalar',
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: onNotifs,
                  behavior: HitTestBehavior.opaque,
                  child: SizedBox(
                    width: kMinTapTarget,
                    height: kMinTapTarget,
                    child: Center(
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: agSurface.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(kRadiusSm),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            const Icon(Icons.notifications_rounded,
                                color: agOnPrimary, size: 21),
                            Positioned(
                              top: 9,
                              right: 9,
                              child: Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  color: kWarningDark,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        // Floating search bar overlapping the header bottom edge.
        Positioned(
          left: kSpace4,
          right: kSpace4,
          bottom: -27,
          child: Semantics(
            button: true,
            label: "Qidiruv: taom, do'kon, manzil…",
            excludeSemantics: true,
            child: GestureDetector(
              onTap: onSearch,
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: kControlHeight,
                padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                decoration: BoxDecoration(
                  color: agSurface,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: agSoftShadow,
                ),
                child: const Row(
                  children: [
                    Icon(Icons.search_rounded, color: agGreenText, size: 23),
                    SizedBox(width: kSpace3),
                    Text(
                      "Qidiruv: taom, do'kon, manzil…",
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: kFontBody, color: agSubtle),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ServiceGrid extends StatelessWidget {
  const _ServiceGrid({
    required this.onTaxi,
    required this.onFood,
    required this.onMarket,
    required this.onCargo,
  });

  final VoidCallback onTaxi;
  final VoidCallback onFood;
  final VoidCallback onMarket;
  final VoidCallback onCargo;

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.local_taxi_rounded, 'Taksi', agGreenText, onTaxi),
      (Icons.restaurant_rounded, 'Ovqat', agOrange, onFood),
      (Icons.storefront_rounded, 'Market', agBlue, onMarket),
      (Icons.local_shipping_rounded, 'Cargo', agPurple, onCargo),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace2, kSpace4, 0),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i != 0) const SizedBox(width: kSpace3),
            Expanded(
              child: _ServiceTile(
                icon: items[i].$1,
                label: items[i].$2,
                color: items[i].$3,
                onTap: items[i].$4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTapTarget, minWidth: kMinTapTarget),
          child: Column(
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Container(
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: Icon(icon, color: color, size: 30),
                ),
              ),
              const SizedBox(height: kSpace2),
              Text(label,
                  style: const TextStyle(
                      fontSize: kFontCaption, fontWeight: FontWeight.w700, color: agText)),
            ],
          ),
        ),
      ),
    );
  }
}

class _TaxiCta extends StatelessWidget {
  const _TaxiCta({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Qayoqqa boramiz? Bir tegishda taksi chaqiring',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 96,
          padding: const EdgeInsets.symmetric(horizontal: kSpace5),
          decoration: BoxDecoration(
            gradient: agInkGradient,
            borderRadius: BorderRadius.circular(kRadiusLg),
            boxShadow: agInkShadow,
          ),
          child: Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned(
                right: -6,
                bottom: -16,
                child: ExcludeSemantics(
                  child: Icon(Icons.local_taxi_rounded,
                      size: 96, color: agBright.withValues(alpha: 0.22)),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Qayoqqa boramiz?',
                            style: TextStyle(
                                color: agOnPrimary,
                                fontSize: kFontH3,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: kSpace1),
                        Text('Bir tegishda taksi chaqiring',
                            style: TextStyle(
                                color: agOnPrimary.withValues(alpha: 0.75),
                                fontSize: kFontLabel,
                                fontWeight: FontWeight.w500)),
                        const SizedBox(height: kSpace2),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: kSpace3, vertical: kSpace2),
                          decoration: BoxDecoration(
                            color: agBright,
                            borderRadius: BorderRadius.circular(kRadiusXs),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Buyurtma',
                                  style: TextStyle(
                                      color: agOnMint,
                                      fontSize: kFontCaption,
                                      fontWeight: FontWeight.w800)),
                              SizedBox(width: kSpace1 + 2),
                              Icon(Icons.arrow_forward_rounded, color: agOnMint, size: 15),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Mashhur restoranlar bloki — uchta holat: yuklanmoqda / xato / bo'sh.
class _RestaurantSection extends StatelessWidget {
  const _RestaurantSection({
    required this.state,
    required this.error,
    required this.restaurants,
    required this.onRetry,
    required this.onOpen,
  });

  final FoodProviderState state;
  final String? error;
  final List<FoodRestaurant> restaurants;
  final VoidCallback onRetry;
  final void Function(FoodRestaurant) onOpen;

  @override
  Widget build(BuildContext context) {
    if (restaurants.isEmpty) {
      if (state == FoodProviderState.loading) {
        return const AppSkeletonList(
          itemCount: 2,
          lines: 2,
          padding: EdgeInsets.symmetric(horizontal: kSpace4),
        );
      }
      if (state == FoodProviderState.error) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: kSpace4),
          child: InlineErrorWidget(
            message: error ?? 'Xatolik yuz berdi',
            onRetry: onRetry,
          ),
        );
      }
      return const AppEmptyState(
        icon: Icons.restaurant_rounded,
        title: 'Restoranlar topilmadi',
        compact: true,
      );
    }

    return SizedBox(
      height: 168,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: kSpace4),
        itemCount: restaurants.length,
        separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
        itemBuilder: (context, i) => _RestaurantCard(
          restaurant: restaurants[i],
          onTap: () => onOpen(restaurants[i]),
        ).animate().fadeIn(delay: (200 + i * 70).ms, duration: 380.ms).slideX(begin: 0.2, curve: Curves.easeOut),
      ),
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  const _RestaurantCard({required this.restaurant, required this.onTap});
  final FoodRestaurant restaurant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = restaurant;
    return Semantics(
      button: true,
      label: r.name,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 168,
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
                    height: 92,
                    width: double.infinity,
                    color: agOrange,
                    child: ExcludeSemantics(
                      child: Icon(Icons.restaurant_rounded,
                          size: 40, color: agSurface.withValues(alpha: 0.7)),
                    ),
                  ),
                  Positioned(
                    top: kSpace2,
                    right: kSpace2,
                    child: AppStatusBadge(
                      label: r.isOpen ? 'Ochiq' : 'Yopiq',
                      tone: r.isOpen ? AppStatusTone.success : AppStatusTone.danger,
                      dense: true,
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(kSpace3, kSpace3, kSpace3, kSpace3),
                child: Text(r.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
