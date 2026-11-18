import 'dart:async';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/product_feed_controller.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Umumiy qidiruv: restoranlar (yuklangan ro'yxatdan) va market mahsulotlari.
///
/// Mahsulotlar 2+ belgida SERVERDAN, BARCHA ochiq do'konlar bo'yicha
/// (`GET /market/products/search`) — ilgari faqat ochiq turgan bitta do'kon
/// ichidan qidirilardi. B reja: server qidiruvi xato bersa, yuklangan
/// do'kon katalogi ichidan qidiriladi (avvalgi xulq).
const Duration _kProductSearchDebounce = Duration(milliseconds: 350);
const int _kProductSearchMinLength = 2;

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.apiClient});

  /// Testlar uchun; berilmasa `sl` dagi (u ham yo'q bo'lsa — faqat lokal).
  final ApiClient? apiClient;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';
  Timer? _debounce;
  ProductFeedController? _productSearch;

  ApiClient? get _api =>
      widget.apiClient ?? (sl.isRegistered<ApiClient>() ? sl<ApiClient>() : null);

  void _onQueryChanged(String value) {
    setState(() => _query = value);
    _debounce?.cancel();
    _debounce = Timer(_kProductSearchDebounce, () => _searchProducts(value.trim()));
  }

  void _searchProducts(String q) {
    if (!mounted) return;
    final api = _api;
    final previous = _productSearch;
    final next = (api != null && q.length >= _kProductSearchMinLength)
        ? ProductFeedController(api, endpoint: ApiEndpoints.marketProductSearch, extraParams: {'q': q})
        : null;
    previous?.removeListener(_onRemoteChanged);
    next?.addListener(_onRemoteChanged);
    setState(() => _productSearch = next);
    previous?.dispose();
    next?.loadMore();
  }

  void _onRemoteChanged() {
    if (mounted) setState(() {});
  }

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
    _debounce?.cancel();
    _productSearch
      ?..removeListener(_onRemoteChanged)
      ..dispose();
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
    final remote = _productSearch;
    final localProducts = q.isEmpty
        ? market.products
        : market.products.where((p) => p.name.toLowerCase().contains(q)).toList();
    // Server natijasi bor bo'lsa — u (barcha do'konlar); xato bo'lsa yoki
    // hali qidirilmagan bo'lsa — yuklangan do'kon ichidan.
    final products = (remote != null && !remote.hasError) ? remote.items : localProducts;

    final loading = food.state == FoodProviderState.loading ||
        market.state == MarketProviderState.loading ||
        (remote?.isLoading ?? false);
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
                AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: context.l10n.saBack),
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
                            onChanged: _onQueryChanged,
                            decoration: InputDecoration(
                              isCollapsed: true,
                              border: InputBorder.none,
                              hintText: context.l10n.saSearchHint,
                              hintStyle: const TextStyle(
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
                            label: context.l10n.saSearchClear,
                            excludeSemantics: true,
                            child: GestureDetector(
                              onTap: () {
                                _controller.clear();
                                _onQueryChanged('');
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
                        message: food.error ?? market.error ?? context.l10n.saErrorOccurred,
                        onRetry: () {
                          context.read<FoodProvider>().loadRestaurants();
                          context.read<MarketProvider>().loadStore();
                        },
                      )
                    : empty
                        ? AppEmptyState(
                            icon: Icons.search_off_rounded,
                            title: context.l10n.saSearchEmptyTitle,
                            message: context.l10n.saSearchEmptyMessage,
                          )
                        // Dangasa ro'yxat: qatorlar QURUVCHI sifatida yig'iladi
                        // (arzon yopilmalar), vidjetlar esa faqat ekranga
                        // chiqqanda quriladi — katalog o'sganda ham qidiruv
                        // har harfda yuzlab qatorni qayta qurmaydi.
                        : Builder(builder: (context) {
                            final rows = <WidgetBuilder>[
                              if (restaurants.isNotEmpty) ...[
                                (_) => _sectionLabel(context.l10n.saSearchSectionRestaurants),
                                for (final r in restaurants)
                                  (context) => Padding(
                                        padding: const EdgeInsets.only(bottom: kSpace3),
                                        child: _ResultRow(
                                          color: agPrimary,
                                          icon: Icons.restaurant_rounded,
                                          imageUrl: r.imageUrl,
                                          title: r.name,
                                          sub: r.address ?? (r.isOpen ? context.l10n.saOpen : context.l10n.saClosed),
                                          trailing: AppStatusBadge(
                                            label: r.isOpen ? context.l10n.saOpen : context.l10n.saClosed,
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
                                      ),
                                (_) => const SizedBox(height: kSpace3),
                              ],
                              if (products.isNotEmpty) ...[
                                (_) => _sectionLabel(context.l10n.saSearchSectionProducts),
                                for (final p in products)
                                  (context) => Padding(
                                        padding: const EdgeInsets.only(bottom: kSpace3),
                                        child: _ResultRow(
                                          color: p.color,
                                          icon: p.icon,
                                          imageUrl: p.imageUrl,
                                          title: p.name,
                                          sub: p.storeName?.isNotEmpty ?? false
                                              ? '${p.storeName} · ${p.unit}'
                                              : context.l10n.saSearchMarketUnit(p.unit),
                                          trailing: Text(
                                            Formatters.formatSom(p.effectivePrice),
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
                                      ),
                              ],
                            ];
                            return ListView.builder(
                              padding: const EdgeInsets.fromLTRB(
                                  kSpace4, kSpace4, kSpace4, kSpace6),
                              itemCount: rows.length,
                              itemBuilder: (context, i) => rows[i](context),
                            );
                          }),
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
  const _ResultRow({
    required this.color,
    required this.icon,
    this.imageUrl,
    required this.title,
    required this.sub,
    required this.trailing,
    required this.onTap,
  });
  final Color color;
  final IconData icon;
  final String? imageUrl;
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
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  child: SizedBox(
                    width: 50,
                    height: 50,
                    child: CatalogImage(
                      imageUrl: imageUrl,
                      placeholder: Container(
                        color: color,
                        child: Icon(icon, size: 25, color: agOnPrimary.withValues(alpha: 0.95)),
                      ),
                    ),
                  ),
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
