import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
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
            padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 14),
            decoration: BoxDecoration(
              color: agSurface,
              boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 6))],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(market.store?.name ?? 'Market',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: agText)),
                          const Text("15–25 daqiqa · Yaqin do'kon",
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: agSubtle)),
                        ],
                      ),
                    ),
                    AgIconButton(
                      icon: Icons.shopping_bag_outlined,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                      ),
                      badge: cart.cartCount > 0 ? '${cart.cartCount}' : null,
                    ),
                  ],
                ),
                const SizedBox(height: 13),
                Container(
                  height: 46,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(13)),
                  child: const Row(
                    children: [
                      Icon(Icons.search_rounded, size: 21, color: agMuted),
                      SizedBox(width: 9),
                      Text('Mahsulot qidirish…',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: agMuted)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: market.state == MarketProviderState.loading && market.products.isEmpty
                ? const Center(child: CircularProgressIndicator(color: agGreen))
                : market.state == MarketProviderState.error && market.products.isEmpty
                    ? Center(
                        child: Text(market.error ?? 'Xatolik yuz berdi',
                            style: const TextStyle(color: agSubtle, fontWeight: FontWeight.w600)),
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
                                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                                      itemCount: market.categories.length,
                                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                                      itemBuilder: (context, i) {
                                        final c = market.categories[i];
                                        return Column(
                                          children: [
                                            Container(
                                              width: 54,
                                              height: 54,
                                              alignment: Alignment.center,
                                              decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(16)),
                                              child: Text(c.emoji, style: const TextStyle(fontSize: 24)),
                                            ),
                                            const SizedBox(height: 6),
                                            Text(c.name,
                                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: agText)),
                                          ],
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              const SliverToBoxAdapter(
                                child: Padding(
                                  padding: EdgeInsets.fromLTRB(16, 16, 16, 12),
                                  child: Text('Mahsulotlar',
                                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: agText)),
                                ),
                              ),
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                                sliver: SliverGrid(
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    mainAxisSpacing: 12,
                                    crossAxisSpacing: 12,
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
                              left: 16,
                              right: 16,
                              bottom: MediaQuery.of(context).padding.bottom + 18,
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
    return GestureDetector(
      onTap: onOpen,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: agSurface, borderRadius: BorderRadius.circular(18), boxShadow: agCardShadow),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: p.color, borderRadius: BorderRadius.circular(13)),
                child: Text(p.emoji, style: const TextStyle(fontSize: 34)),
              ),
            ),
            const SizedBox(height: 10),
            Text(p.name,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: agText)),
            const SizedBox(height: 1),
            Text(p.unit, style: const TextStyle(fontSize: 11.5, color: agMuted, fontWeight: FontWeight.w600)),
            const SizedBox(height: 9),
            Row(
              children: [
                Expanded(
                  child: Text(Formatters.formatSom(p.price),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: agText)),
                ),
                GestureDetector(
                  onTap: p.isAvailable ? onAdd : null,
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: p.isAvailable ? agGreen : agMuted,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(Icons.add_rounded, color: Colors.white, size: 21),
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
