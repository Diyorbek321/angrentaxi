import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
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
    final failed = food.state == FoodProviderState.error &&
        market.state == MarketProviderState.error;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          Container(
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
                Expanded(
                  child: Container(
                    height: kControlHeightSm,
                    padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                    decoration: BoxDecoration(
                      color: agBg,
                      borderRadius: BorderRadius.circular(kRadiusMd),
                    ),
                    child: Row(
                      children: [
                        const ExcludeSemantics(
                          child: Icon(Icons.search_rounded, size: 21, color: agGreenText),
                        ),
                        const SizedBox(width: kSpace2),
                        Expanded(
                          child: TextField(
                            controller: _controller,
                            autofocus: true,
                            onChanged: (value) => setState(() => _query = value),
                            decoration: const InputDecoration(
                              isCollapsed: true,
                              border: InputBorder.none,
                              hintText: 'taom, doʻkon, mahsulot…',
                              hintStyle: TextStyle(
                                  color: agSubtle,
                                  fontWeight: FontWeight.w600,
                                  fontSize: kFontBody),
                            ),
                            style: const TextStyle(
                                color: agText, fontWeight: FontWeight.w700, fontSize: kFontBody),
                          ),
                        ),
                        if (_query.isNotEmpty)
                          Semantics(
                            button: true,
                            label: 'Qidiruvni tozalash',
                            excludeSemantics: true,
                            child: GestureDetector(
                              onTap: () {
                                _controller.clear();
                                setState(() => _query = '');
                              },
                              behavior: HitTestBehavior.opaque,
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(
                                  minWidth: kMinTapTarget,
                                  minHeight: kMinTapTarget,
                                ),
                                child: const Icon(Icons.close_rounded, size: 19, color: agSubtle),
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
          Expanded(
            child: loading && empty
                ? const AppSkeletonList(itemCount: 5, hasTrailing: true)
                : (failed && empty)
                    ? AppErrorState(
                        message: food.error ?? market.error ?? 'Xatolik yuz berdi',
                        onRetry: () {
                          context.read<FoodProvider>().loadRestaurants();
                          context.read<MarketProvider>().loadStore();
                        },
                      )
                    : empty
                        ? const AppEmptyState(
                            icon: Icons.search_off_rounded,
                            title: 'Hech narsa topilmadi',
                            message: 'Boshqa nom bilan qidirib ko\'ring.',
                          )
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(
                                kSpace4, kSpace4, kSpace4, kSpace6),
                            children: [
                              if (restaurants.isNotEmpty) ...[
                                _sectionLabel('RESTORANLAR'),
                                for (final r in restaurants) ...[
                                  _ResultRow(
                                    color: agPrimary,
                                    icon: Icons.restaurant_rounded,
                                    title: r.name,
                                    sub: r.address ?? (r.isOpen ? 'Ochiq' : 'Yopiq'),
                                    trailing: AppStatusBadge(
                                      label: r.isOpen ? 'Ochiq' : 'Yopiq',
                                      tone: r.isOpen
                                          ? AppStatusTone.success
                                          : AppStatusTone.neutral,
                                      dense: true,
                                    ),
                                    onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute<void>(
                                        builder: (_) => RestaurantDetailScreen(restaurantId: r.id),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: kSpace3),
                                ],
                                const SizedBox(height: kSpace3),
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
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: kFontLabel,
                                          color: agText),
                                    ),
                                    onTap: () => Navigator.of(context).push(
                                      MaterialPageRoute<void>(
                                        builder: (_) => ProductDetailScreen(marketProduct: p),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: kSpace3),
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
        padding: const EdgeInsets.fromLTRB(2, 0, 2, kSpace3),
        child: Text(text,
            style: const TextStyle(
                fontSize: kFontCaption,
                fontWeight: FontWeight.w800,
                letterSpacing: 1,
                color: agSubtle)),
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
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.all(kSpace3),
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: agCardShadow,
          ),
          child: Row(
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(icon, size: 25, color: agOnPrimary.withValues(alpha: 0.95)),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                    Text(sub,
                        style: const TextStyle(
                            fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const SizedBox(width: kSpace2),
              trailing,
            ],
          ),
        ),
      ),
    );
  }
}
