import 'dart:async';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/product_feed_controller.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/deals.dart';
import 'package:angren_taxi/features/superapp/widgets/market_cart_flow.dart';
import 'package:angren_taxi/features/superapp/widgets/market_store_card.dart';
import 'package:angren_taxi/features/superapp/widgets/product_feed_slivers.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Qidiruv so'rovi shuncha jim turgandan keyin yuboriladi.
const Duration _kSearchDebounce = Duration(milliseconds: 350);

/// Server ham 2 belgidan qisqa so'rovni qidirmaydi.
const int _kSearchMinLength = 2;

// ============================================================================
// MARKET SAHIFASI — DO'KONLAR + BARCHA DO'KONLAR BO'YICHA QIDIRUV.
//
// Ilgari "Market" ro'yxatdagi BIRINCHI do'konni ochardi: qolgan do'konlar
// faqat reklama banneri orqali ko'rinardi, qidiruv ham bitta do'kon ichida
// edi. Endi ikki yo'l:
//   · mahsulot kerak → yuqoridagi qidiruv BARCHA ochiq do'konlardan izlaydi
//     (natijada do'kon nomi; savat oqimi to'g'ri do'konga bog'laydi);
//   · do'kon tanlayman → pastdagi ro'yxat, bosilsa do'kon katalogi.
//
// B reja: ochiq do'kon BITTA bo'lsa ro'yxat ortiqcha qadam — darhol shu
// do'kon ochiladi (avvalgi xulq).
// ============================================================================
class MarketHomeScreen extends StatefulWidget {
  const MarketHomeScreen({super.key, this.apiClient});

  /// Testlar uchun; berilmasa `sl` dagi.
  final ApiClient? apiClient;

  @override
  State<MarketHomeScreen> createState() => _MarketHomeScreenState();
}

class _MarketHomeScreenState extends State<MarketHomeScreen> {
  final _queryController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  ProductFeedController? _search;

  ApiClient get _api => widget.apiClient ?? sl<ApiClient>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final market = context.read<MarketProvider>();
      market.loadActivePromotions();
      await market.loadStores();
      if (!mounted) return;
      // B reja: bitta do'kon — ro'yxatsiz, to'g'ridan-to'g'ri.
      if (market.storesError == null && market.stores.length == 1) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(builder: (_) => MarketScreen(storeId: market.stores.single.id)),
        );
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search?.dispose();
    _queryController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    setState(() => _query = value);
    _debounce?.cancel();
    _debounce = Timer(_kSearchDebounce, () => _runSearch(value.trim()));
  }

  void _runSearch(String q) {
    if (!mounted) return;
    final previous = _search;
    final next = q.length >= _kSearchMinLength
        ? ProductFeedController(
            _api,
            endpoint: ApiEndpoints.marketProductSearch,
            extraParams: {'q': q},
          )
        : null;
    setState(() => _search = next);
    previous?.dispose();
    next?.loadMore();
  }

  void _clearQuery() {
    _queryController.clear();
    _onQueryChanged('');
  }

  void _openStore(String storeId) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => MarketScreen(storeId: storeId)),
    );
  }

  void _openProduct(MarketProduct product) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(marketProduct: product)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<SuperappProvider>();
    final search = _search;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          _MarketHeader(
            controller: _queryController,
            query: _query,
            cartCount: cart.cartCount,
            onChanged: _onQueryChanged,
            onClear: _clearQuery,
          ),
          Expanded(
            child: Stack(
              children: [
                if (search != null)
                  ListenableBuilder(
                    listenable: search,
                    builder: (context, _) => _SearchResults(
                      feed: search,
                      onOpen: _openProduct,
                      onAdd: (p) => addMarketProductToCart(context, p),
                    ),
                  )
                else
                  _StoreList(onOpenStore: _openStore),
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

class _StoreList extends StatelessWidget {
  const _StoreList({required this.onOpenStore});

  final ValueChanged<String> onOpenStore;

  @override
  Widget build(BuildContext context) {
    final market = context.watch<MarketProvider>();
    final stores = market.stores;

    if (stores.isEmpty) {
      if (market.storesLoading || (market.storesError == null && !market.storesLoaded)) {
        return const AppSkeletonList(itemCount: 3);
      }
      if (market.storesError != null) {
        return AppErrorState(
          message: market.storesError!,
          onRetry: () => context.read<MarketProvider>().loadStores(),
        );
      }
      return AppEmptyState(
        icon: Icons.storefront_outlined,
        title: context.l10n.saNoStoreYet,
        actionLabel: context.l10n.saRefresh,
        onAction: () => context.read<MarketProvider>().loadStores(),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 110),
      // 0 — aksiyalar lentasi (bo'sh bo'lsa o'zi hech narsa chizmaydi),
      // 1 — "Do'konlar" sarlavhasi, keyin do'konlar.
      itemCount: stores.length + 2,
      itemBuilder: (context, index) {
        if (index == 0) {
          return DealsCarousel(
            deals: market.activePromotions,
            onTap: (deal) => onOpenStore(deal.vendorId),
          );
        }
        if (index == 1) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace3),
            child: AgSectionTitle(context.l10n.saMarketStores),
          );
        }
        final store = stores[index - 2];
        return Padding(
          padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
          child: MarketStoreCard(store: store, onTap: () => onOpenStore(store.id)),
        );
      },
    );
  }
}

class _SearchResults extends StatelessWidget {
  const _SearchResults({required this.feed, required this.onOpen, required this.onAdd});

  final ProductFeedController feed;
  final ValueChanged<MarketProduct> onOpen;
  final ValueChanged<MarketProduct> onAdd;

  @override
  Widget build(BuildContext context) {
    if (feed.items.isEmpty && !feed.hasMore && !feed.isLoading && !feed.hasError) {
      return AppEmptyState(
        icon: Icons.search_off_rounded,
        title: context.l10n.saSearchEmptyTitle,
        message: context.l10n.saSearchEmptyMessage,
      );
    }
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (!feed.hasError && n.metrics.extentAfter < kTrendingPrefetchExtent) feed.loadMore();
        return false;
      },
      child: CustomScrollView(
        slivers: [
          ...productFeedSlivers(context, feed, title: null, onOpen: onOpen, onAdd: onAdd),
          const SliverToBoxAdapter(child: SizedBox(height: 110)),
        ],
      ),
    );
  }
}

class _MarketHeader extends StatelessWidget {
  const _MarketHeader({
    required this.controller,
    required this.query,
    required this.cartCount,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final String query;
  final int cartCount;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          kSpace4, MediaQuery.of(context).padding.top + kSpace3, kSpace4, kSpace4),
      decoration: BoxDecoration(color: agSurface, boxShadow: agCardShadow),
      child: Column(
        children: [
          Row(
            children: [
              AgIconButton(
                icon: Icons.arrow_back_rounded,
                onTap: () => Navigator.of(context).pop(),
                semanticsLabel: context.l10n.saBack,
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(context.l10n.saMarket,
                        style: const TextStyle(
                            fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
                    Text(context.l10n.saMarketSubtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: kFontCaption, fontWeight: FontWeight.w600, color: agSubtle)),
                  ],
                ),
              ),
              AgIconButton(
                icon: Icons.shopping_bag_outlined,
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
                badge: cartCount > 0 ? '$cartCount' : null,
                semanticsLabel:
                    cartCount > 0 ? context.l10n.saCartWithCount(cartCount) : context.l10n.saCart,
              ),
            ],
          ),
          const SizedBox(height: kSpace3),
          Container(
            height: kControlHeightSm,
            padding: const EdgeInsets.only(left: kSpace4),
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
                    controller: controller,
                    onChanged: onChanged,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: context.l10n.saMarketSearchAllHint,
                      hintStyle: const TextStyle(
                          color: agSubtle, fontWeight: FontWeight.w600, fontSize: kFontBody),
                    ),
                    style: const TextStyle(
                        color: agText, fontWeight: FontWeight.w700, fontSize: kFontBody),
                  ),
                ),
                if (query.isNotEmpty)
                  Semantics(
                    button: true,
                    label: context.l10n.saSearchClear,
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: onClear,
                      behavior: HitTestBehavior.opaque,
                      child: const SizedBox(
                        width: kMinTapTarget,
                        height: kMinTapTarget,
                        child: Icon(Icons.close_rounded, size: 19, color: agSubtle),
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
