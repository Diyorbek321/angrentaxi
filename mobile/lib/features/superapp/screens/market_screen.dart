import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/deals.dart';
import 'package:angren_taxi/features/superapp/widgets/delivery_info.dart';
import 'package:angren_taxi/features/superapp/widgets/market_product_card.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key, this.storeId});

  /// Aniq do'kon (reklama banneridan). `null` — birinchi do'kon.
  final String? storeId;

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final market = context.read<MarketProvider>();
      market.loadActivePromotions();
      await market.loadStore(storeId: widget.storeId);
      if (mounted && market.store != null) {
        context.read<SuperappProvider>().setActiveContext('market', market.store!.id);
      }
    });
  }

  void _add(BuildContext context, MarketProduct p) {
    context.read<SuperappProvider>().addToCart(
          CartItem(id: p.id, name: p.name, price: p.effectivePrice, qty: 1, icon: p.icon, color: p.color, imageUrl: p.imageUrl),
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
                    AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: context.l10n.saBack),
                    const SizedBox(width: kSpace3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(market.store?.name ?? context.l10n.saMarket,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
                          Text(context.l10n.saMarketSubtitle,
                              style: const TextStyle(
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
                          ? context.l10n.saCartWithCount(cart.cartCount)
                          : context.l10n.saCart,
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
                  child: Row(
                    children: [
                      const ExcludeSemantics(
                        child: Icon(Icons.search_rounded, size: 21, color: agSubtle),
                      ),
                      const SizedBox(width: kSpace2),
                      Expanded(
                        child: Text(context.l10n.saMarketSearchHint,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: kFontBody, fontWeight: FontWeight.w600, color: agSubtle)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace2),
                const DeliveryInfoStrip(),
              ],
            ),
          ),
          Expanded(
            child: market.state == MarketProviderState.loading && market.products.isEmpty
                ? const AppSkeletonGrid(itemCount: 6)
                : market.state == MarketProviderState.error && market.products.isEmpty
                    ? AppErrorState(
                        message: market.error ?? context.l10n.saErrorOccurred,
                        onRetry: () => context.read<MarketProvider>().loadStore(storeId: widget.storeId),
                      )
                    : market.products.isEmpty
                    ? AppEmptyState(
                        icon: Icons.shopping_basket_outlined,
                        title: context.l10n.saMarketNoProductsTitle,
                        message: context.l10n.saMarketNoProductsMessage,
                        actionLabel: context.l10n.saRefresh,
                        onAction: () => context.read<MarketProvider>().loadStore(storeId: widget.storeId),
                      )
                    : Stack(
                        children: [
                          CustomScrollView(
                            slivers: [
                              // Chegirmalar — ENG TEPADA (bo'sh bo'lsa ko'rinmaydi).
                              SliverToBoxAdapter(
                                child: DealsCarousel(
                                  deals: market.activePromotions,
                                  onTap: (deal) {
                                    if (deal.vendorId != market.store?.id) {
                                      market.loadStore(storeId: deal.vendorId);
                                    }
                                  },
                                ),
                              ),
                              if (market.categories.isNotEmpty)
                                SliverToBoxAdapter(
                                  child: SizedBox(
                                    // Matn shkalasi bilan o'sadi — 1.3x da nom kesilmaydi.
                                    height: 88 + 18 * MediaQuery.textScalerOf(context).scale(1),
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
                                            SizedBox(
                                              width: 64,
                                              child: Text(c.name,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                textAlign: TextAlign.center,
                                                style: const TextStyle(
                                                    fontSize: kFontMicro,
                                                    fontWeight: FontWeight.w700,
                                                    color: agText)),
                                            ),
                                          ],
                                        );
                                      },
                                    ),
                                  ),
                                ),
                              SliverToBoxAdapter(
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                      kSpace4, kSpace4, kSpace4, kSpace3),
                                  child: Text(context.l10n.saMarketProducts,
                                      style: const TextStyle(
                                          fontSize: kFontTitle,
                                          fontWeight: FontWeight.w800,
                                          color: agText)),
                                ),
                              ),
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, 110),
                                sliver: SliverGrid(
                                  // Planshetda ko'proq ustun; karta balandligi matn
                                  // shkalasiga moslashadi (qat'iy nisbat 1.3x da toshardi).
                                  gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                                    maxCrossAxisExtent: 220,
                                    mainAxisSpacing: kSpace3,
                                    crossAxisSpacing: kSpace3,
                                    mainAxisExtent: 128 + 108 * MediaQuery.textScalerOf(context).scale(1),
                                  ),
                                  delegate: SliverChildBuilderDelegate(
                                    (context, i) => MarketProductCard(
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
                                label: context.l10n.saCart,
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
