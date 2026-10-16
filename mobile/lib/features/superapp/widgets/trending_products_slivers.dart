import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/features/superapp/state/trending_products_controller.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/market_product_card.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';

/// Pastgacha shuncha piksel qolganda keyingi sahifa so'raladi — foydalanuvchi
/// oxiriga yetmasidan mahsulotlar tayyor turadi.
const double kTrendingPrefetchExtent = 800;

/// Bosh sahifadagi "Trenddagi mahsulotlar" bo'limi — `CustomScrollView`
/// ichiga qo'yiladigan sliver'lar: sarlavha, 2 ustunli to'r va pastki holat
/// (yuklanmoqda / xato + qayta urinish).
///
/// Hech narsa yo'q va boshqa sahifa ham yo'q (do'konlarda mahsulot yo'q) —
/// bo'lim butunlay yashiriladi, bo'sh sarlavha osilib turmaydi.
List<Widget> trendingProductSlivers(
  BuildContext context,
  TrendingProductsController trending, {
  required void Function(MarketProduct product) onOpen,
  required void Function(MarketProduct product) onAdd,
}) {
  final items = trending.items;
  if (items.isEmpty && !trending.hasMore && !trending.hasError) return const [];

  final gutter = context.gutter;
  return [
    SliverToBoxAdapter(
      child: Padding(
        padding: EdgeInsets.fromLTRB(gutter, kSpace6, gutter, kSpace3),
        child: AgSectionTitle(context.l10n.saTrendingProducts),
      ),
    ),
    if (items.isEmpty && !trending.hasError)
      SliverToBoxAdapter(
        child: AppSkeletonGrid(padding: EdgeInsets.symmetric(horizontal: gutter)),
      )
    else
      SliverPadding(
        padding: EdgeInsets.symmetric(horizontal: gutter),
        sliver: SliverGrid(
          // Do'kon ekranidagi to'r bilan bir xil: telefonda 2 ustun,
          // planshetda ko'proq; balandlik matn shkalasiga moslashadi.
          gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 220,
            mainAxisSpacing: kSpace3,
            crossAxisSpacing: kSpace3,
            mainAxisExtent: 128 + 108 * MediaQuery.textScalerOf(context).scale(1),
          ),
          delegate: SliverChildBuilderDelegate(
            (context, i) {
              final product = items[i];
              return MarketProductCard(
                product: product,
                subtitle: product.storeName,
                onOpen: () => onOpen(product),
                onAdd: () => onAdd(product),
              );
            },
            childCount: items.length,
          ),
        ),
      ),
    SliverToBoxAdapter(
      child: Padding(
        padding: EdgeInsets.fromLTRB(gutter, kSpace4, gutter, 0),
        child: trending.hasError
            ? InlineErrorWidget(
                message: context.l10n.saTrendingLoadFailed,
                onRetry: trending.loadMore,
              )
            : (trending.isLoading && items.isNotEmpty)
                ? const Center(
                    child: SizedBox.square(
                      dimension: 24,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    ),
                  )
                : const SizedBox.shrink(),
      ),
    ),
  ];
}
