import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Searches the real `/food` restaurants and `/market` products already
/// exposed by [FoodProvider]/[MarketProvider]. There is no backend search
/// endpoint yet, so this filters the loaded catalogue client-side — every
/// result still carries a real backend id, so tapping through to the detail
/// screen and ordering works end to end.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final food = context.read<FoodProvider>();
      if (food.restaurants.isEmpty) food.loadRestaurants();
      final market = context.read<MarketProvider>();
      if (market.products.isEmpty) market.loadStore();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final food = context.watch<FoodProvider>();
    final market = context.watch<MarketProvider>();

    final q = _query.trim().toLowerCase();
    final restaurants = q.isEmpty
        ? food.restaurants
        : food.restaurants.where((r) => r.name.toLowerCase().contains(q)).toList();
    final products = q.isEmpty
        ? market.products
        : market.products.where((p) => p.name.toLowerCase().contains(q)).toList();

    final loading = food.state == FoodProviderState.loading ||
        market.state == MarketProviderState.loading;
    final empty = restaurants.isEmpty && products.isEmpty;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 14),
            decoration: BoxDecoration(
              color: agSurface,
              boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 6))],
            ),
            child: Row(
              children: [
                AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(13)),
                    child: Row(
                      children: [
                        const Icon(Icons.search_rounded, size: 21, color: agGreen),
                        const SizedBox(width: 9),
                        Expanded(
                          child: TextField(
                            controller: _controller,
                            autofocus: true,
                            onChanged: (value) => setState(() => _query = value),
                            decoration: const InputDecoration(
                              isCollapsed: true,
                              border: InputBorder.none,
                              hintText: 'taom, doʻkon, mahsulot…',
                              hintStyle: TextStyle(color: agMuted, fontWeight: FontWeight.w600, fontSize: 14.5),
                            ),
                            style: const TextStyle(color: agText, fontWeight: FontWeight.w700, fontSize: 14.5),
                          ),
                        ),
                        if (_query.isNotEmpty)
                          GestureDetector(
                            onTap: () {
                              _controller.clear();
                              setState(() => _query = '');
                            },
                            child: const Icon(Icons.close_rounded, size: 19, color: agMuted),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: loading && empty
                ? const Center(child: CircularProgressIndicator(color: agGreen))
                : empty
                    ? const Center(
                        child: Text(
                          'Hech narsa topilmadi',
                          style: TextStyle(color: agSubtle, fontWeight: FontWeight.w600),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                        children: [
                          if (restaurants.isNotEmpty) ...[
                            _sectionLabel('RESTORANLAR'),
                            for (final r in restaurants) ...[
                              _ResultRow(
                                color: agGreen,
                                icon: Icons.restaurant_rounded,
                                title: r.name,
                                sub: r.address ?? (r.isOpen ? 'Ochiq' : 'Yopiq'),
                                trailing: Text(
                                  r.isOpen ? 'Ochiq' : 'Yopiq',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12.5,
                                    color: r.isOpen ? agGreen : agMuted,
                                  ),
                                ),
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => RestaurantDetailScreen(restaurantId: r.id),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 11),
                            ],
                            const SizedBox(height: 12),
                          ],
                          if (products.isNotEmpty) ...[
                            _sectionLabel('MAHSULOTLAR'),
                            for (final p in products) ...[
                              _ResultRow(
                                color: p.color,
                                icon: p.icon,
                                title: p.name,
                                sub: 'Market · ${p.unit}',
                                trailing: Text(
                                  Formatters.formatSom(p.price),
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: agText),
                                ),
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => ProductDetailScreen(marketProduct: p),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 11),
                            ],
                          ],
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 0, 2, 10),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1, color: agMuted)),
      );
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.color, required this.icon, required this.title, required this.sub, required this.trailing, required this.onTap});
  final Color color;
  final IconData icon;
  final String title;
  final String sub;
  final Widget trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: agCardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(13)),
              child: Icon(icon, size: 25, color: Colors.white.withValues(alpha: 0.95)),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: agText)),
                  Text(sub, style: const TextStyle(fontSize: 12, color: agSubtle, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}
