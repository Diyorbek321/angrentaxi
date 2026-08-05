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
    final restaurants = context.watch<FoodProvider>().restaurants;

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
          const SizedBox(height: 20),
          _ServiceGrid(
            onTaxi: () => _openTaxi(context),
            onFood: () => _push(context, const FoodListScreen()),
            onMarket: () => _push(context, const MarketScreen()),
            onCargo: () => _push(context, const CargoScreen()),
          ).animate().fadeIn(delay: 80.ms, duration: 400.ms).slideY(begin: 0.15, curve: Curves.easeOut),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _TaxiCta(onTap: () => _openTaxi(context)),
          ).animate().fadeIn(delay: 160.ms, duration: 400.ms).slideY(begin: 0.15, curve: Curves.easeOut),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: AgSectionTitle(
              'Mashhur restoranlar',
              trailing: 'Barchasi',
              onTrailingTap: () => _push(context, const FoodListScreen()),
            ),
          ),
          const SizedBox(height: 12),
          _RestaurantCarousel(
            restaurants: restaurants,
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
          height: 178 + topPad,
          padding: EdgeInsets.fromLTRB(18, topPad + 14, 18, 0),
          decoration: const BoxDecoration(
            gradient: agHeader,
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
          ),
          child: Row(
            children: [
              const Icon(Icons.location_on_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 7),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Joriy manzil',
                      style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
                  Row(
                    children: [
                      Text('Angren shahri',
                          style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                      Icon(Icons.expand_more_rounded, color: Colors.white, size: 16),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              GestureDetector(
                onTap: onWallet,
                child: Container(
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 17),
                      const SizedBox(width: 7),
                      Text(
                        balance == null ? '—' : Formatters.formatAmount(balance!),
                        style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: onNotifs,
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Icon(Icons.notifications_rounded, color: Colors.white, size: 21),
                      Positioned(
                        top: 9,
                        right: 9,
                        child: Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFFD43B),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        // Floating search bar overlapping the header bottom edge.
        Positioned(
          left: 16,
          right: 16,
          bottom: -27,
          child: GestureDetector(
            onTap: onSearch,
            child: Container(
              height: 54,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: agSurface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: agInk.withValues(alpha: 0.10),
                    blurRadius: 30,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              child: const Row(
                children: [
                  Icon(Icons.search_rounded, color: agGreen, size: 23),
                  SizedBox(width: 10),
                  Text(
                    "Qidiruv: taom, do'kon, manzil…",
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: agMuted),
                  ),
                ],
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
      (Icons.local_taxi_rounded, 'Taksi', agGreen, onTaxi),
      (Icons.restaurant_rounded, 'Ovqat', agOrange, onFood),
      (Icons.storefront_rounded, 'Market', agBlue, onMarket),
      (Icons.local_shipping_rounded, 'Cargo', agPurple, onCargo),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i != 0) const SizedBox(width: 10),
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
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(
              decoration: BoxDecoration(
                color: agSurface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: agInk.withValues(alpha: 0.06),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Icon(icon, color: color, size: 30),
            ),
          ),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: agText)),
        ],
      ),
    );
  }
}

class _TaxiCta extends StatelessWidget {
  const _TaxiCta({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 96,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [agInk, Color(0xFF1D2D34)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned(
              right: -6,
              bottom: -16,
              child: Icon(Icons.local_taxi_rounded,
                  size: 96, color: agBright.withValues(alpha: 0.22)),
            ),
            Row(
              children: [
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Qayoqqa boramiz?',
                          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 3),
                      const Text('Bir tegishda taksi chaqiring',
                          style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500)),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
                        decoration: BoxDecoration(
                          color: agBright,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Buyurtma',
                                style: TextStyle(color: Color(0xFF06231A), fontSize: 12.5, fontWeight: FontWeight.w800)),
                            SizedBox(width: 6),
                            Icon(Icons.arrow_forward_rounded, color: Color(0xFF06231A), size: 15),
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
    );
  }
}

class _RestaurantCarousel extends StatelessWidget {
  const _RestaurantCarousel({required this.restaurants, required this.onOpen});
  final List<FoodRestaurant> restaurants;
  final void Function(FoodRestaurant) onOpen;

  @override
  Widget build(BuildContext context) {
    if (restaurants.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 160,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: restaurants.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 168,
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
                  height: 92,
                  width: double.infinity,
                  color: agOrange,
                  child: const Icon(Icons.restaurant_rounded, size: 40, color: Colors.white70),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: (r.isOpen ? agGreen : agRed).withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(r.isOpen ? 'Ochiq' : 'Yopiq',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 11, 12, 13),
              child: Text(r.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
            ),
          ],
        ),
      ),
    );
  }
}
