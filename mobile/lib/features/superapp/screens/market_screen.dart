import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final market = context.read<MarketProvider>();
      await market.loadStore();
      if (mounted && market.store != null) {
        context.read<SuperappProvider>().setActiveContext('market', market.store!.id);
      }
    });
  }

  void _add(BuildContext context, MarketProduct p) {
    context.read<SuperappProvider>().addToCart(
          CartItem(id: p.id, name: p.name, price: p.price, qty: 1, icon: p.icon, color: p.color),
        );
  }

  @override
  Widget build(BuildContext context) {
    final market = context.watch<MarketProvider>();
    final cart = context.watch<SuperappProvider>();

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
            child: Column(
              children: [
                Row(
                  children: [
                    AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: 'Orqaga'),
                    const SizedBox(width: kSpace3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(market.store?.name ?? 'Market',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
                          const Text("15–25 daqiqa · Yaqin do'kon",
                              style: TextStyle(
                                  fontSize: kFontCaption,
                                  fontWeight: FontWeight.w600,
                                  color: agSubtle)),
                        ],
                      ),
                    ),
                    AgIconButton(
                      icon: Icons.shopping_bag_outlined,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                      ),
                      badge: cart.cartCount > 0 ? '${cart.cartCount}' : null,
                      semanticsLabel: cart.cartCount > 0
                          ? 'Savat, ${cart.cartCount} ta mahsulot'
                          : 'Savat',
                    ),
                  ],
                ),
                const SizedBox(height: kSpace3),
                Container(
                  height: kControlHeightSm,
                  padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                  decoration: BoxDecoration(
                    color: agBg,
                    borderRadius: BorderRadius.circular(kRadiusMd),
                  ),
                  child: const Row(
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.search_rounded, size: 21, color: agSubtle),
                      ),
                      SizedBox(width: kSpace2),
                      Text('Mahsulot qidirish…',
                          style: TextStyle(
                              fontSize: kFontBody, fontWeight: FontWeight.w600, color: agSubtle)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: market.state == MarketProviderState.loading && market.products.isEmpty
                ? const AppSkeletonGrid(itemCount: 6)
                : market.state == MarketProviderState.error && market.products.isEmpty
                    ? AppErrorState(
                        message: market.error ?? 'Xatolik yuz berdi',
                        onRetry: () => context.read<MarketProvider>().loadStore(),
                      )
                    : market.products.isEmpty
                    ? AppEmptyState(
                        icon: Icons.shopping_basket_outlined,
                        title: 'Mahsulot topilmadi',
                        message: 'Bu do\'konda hozircha mahsulot yo\'q.',
                        actionLabel: 'Yangilash',
                        onAction: () => context.read<MarketProvider>().loadStore(),
                      )
                    : Stack(
                        children: [
                          CustomScrollView(
                            slivers: [
                              if (market.categories.isNotEmpty)
                                SliverToBoxAdapter(
                                  child: SizedBox(
                                    height: 92,
                                    child: ListView.separated(
                                      scrollDirection: Axis.horizontal,
                                      padding: const EdgeInsets.fromLTRB(
                                          kSpace4, kSpace4, kSpace4, kSpace1),
                                      itemCount: market.categories.length,
                                      separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
                                      itemBuilder: (context, i) {
                                        final c = market.categories[i];
                                        return Column(
                                          children: [
                                            Container(
                                              width: 54,
                                              height: 54,
                                              alignment: Alignment.center,
                                              decoration: BoxDecoration(
                                                color: agTint,
                                                borderRadius: BorderRadius.circular(kRadiusMd),
                                              ),
                                              child: Text(c.emoji,
                                                  style: const TextStyle(fontSize: 24)),
                                            ),
                                            const SizedBox(height: kSpace2),
                                            Text(c.name,
                                                style: const TextStyle(
                                                    fontSize: kFontMicro,
                                                    fontWeight: FontWeight.w700,
                                                    color: agText)),
                                          ],
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              const SliverToBoxAdapter(
                                child: Padding(
                                  padding: EdgeInsets.fromLTRB(
                                      kSpace4, kSpace4, kSpace4, kSpace3),
                                  child: Text('Mahsulotlar',
                                      style: TextStyle(
                                          fontSize: kFontTitle,
                                          fontWeight: FontWeight.w800,
                                          color: agText)),
                                ),
                              ),
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, 110),
                                sliver: SliverGrid(
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    mainAxisSpacing: kSpace3,
                                    crossAxisSpacing: kSpace3,
                                    childAspectRatio: 0.78,
                                  ),
                                  delegate: SliverChildBuilderDelegate(
                                    (context, i) => _ProductCard(
                                      product: market.products[i],
                                      onOpen: () => Navigator.of(context).push(
                                        MaterialPageRoute<void>(
                                          builder: (_) => ProductDetailScreen(marketProduct: market.products[i]),
                                        ),
                                      ),
                                      onAdd: () => _add(context, market.products[i]),
                                    ),
                                    childCount: market.products.length,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (cart.cartCount > 0)
                            Positioned(
                              left: kSpace4,
                              right: kSpace4,
                              bottom: MediaQuery.of(context).padding.bottom + kSpace4,
                              child: AgCartBar(
                                count: cart.cartCount,
                                label: 'Savat',
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

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onOpen, required this.onAdd});
  final MarketProduct product;
  final VoidCallback onOpen;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onOpen,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(kSpace3),
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: agCardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: p.color,
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: ExcludeSemantics(
                    child: Text(p.emoji, style: const TextStyle(fontSize: 34)),
                  ),
                ),
              ),
              const SizedBox(height: kSpace2),
              Text(p.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: kFontLabel, color: agText)),
              Text(p.unit,
                  style: const TextStyle(
                      fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w600)),
              const SizedBox(height: kSpace2),
              Row(
                children: [
                  Expanded(
                    child: Text(Formatters.formatSom(p.price),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: kFontLabel, color: agText)),
                  ),
                  Semantics(
                    button: true,
                    enabled: p.isAvailable,
                    label: '${p.name} — savatga qo\'shish',
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: p.isAvailable ? onAdd : null,
                      behavior: HitTestBehavior.opaque,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minWidth: kMinTapTarget,
                          minHeight: kMinTapTarget,
                        ),
                        child: Center(
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: p.isAvailable ? agPrimary : agSubtle,
                              borderRadius: BorderRadius.circular(kRadiusSm),
                            ),
                            child: const Icon(Icons.add_rounded, color: agOnPrimary, size: 21),
                          ),
                        ),
                      ),
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
