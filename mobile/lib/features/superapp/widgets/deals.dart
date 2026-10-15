import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/vendor_promotion.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:flutter/material.dart';

// ============================================================================
// CHEGIRMALAR — vendor aksiyalari ko'rinishi (docs/specs/food-market-ux-v5.md §4).
//
// Chegirma rangi — `kErrorDeep` qizil fon ustida oq (6.5:1). Yashil
// (kPrimary) ATAYLAB ishlatilmaydi: u ilovada "harakat/tasdiq" rangi, va
// chegirma belgisi tugma bilan adashtirilmasligi kerak.
// ============================================================================

/// "−20%" belgisi.
class DiscountBadge extends StatelessWidget {
  const DiscountBadge({super.key, required this.label, this.dense = false});

  final String label;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? kSpace2 - 2 : kSpace2,
        vertical: dense ? 2 : kSpace1,
      ),
      decoration: BoxDecoration(
        color: kErrorDeep,
        borderRadius: BorderRadius.circular(kRadiusXs),
      ),
      child: Text(
        label,
        maxLines: 1,
        style: TextStyle(
          color: agOnPrimary,
          fontSize: dense ? kFontMicro : kFontCaption,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

/// Narx: chegirma bo'lsa — yangi narx qizilda, eskisi ustidan chizilgan.
class PriceTag extends StatelessWidget {
  const PriceTag({
    super.key,
    required this.price,
    this.oldPrice,
    this.fontSize = kFontBody,
  });

  final double price;
  final double? oldPrice;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final old = oldPrice;
    final discounted = old != null && old > price;
    final now = Formatters.formatSom(price);
    if (!discounted) {
      return Text(
        now,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontWeight: FontWeight.w800, fontSize: fontSize, color: agText),
      );
    }
    final was = Formatters.formatSom(old);
    return Semantics(
      label: context.l10n.saPriceWithDiscount(now, was),
      excludeSemantics: true,
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.end,
        spacing: kSpace1,
        children: [
          Text(
            now,
            key: const ValueKey('price-final'),
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: fontSize, color: kErrorDeep),
          ),
          Text(
            was,
            key: const ValueKey('price-old'),
            style: TextStyle(
              fontSize: fontSize - 2,
              fontWeight: FontWeight.w600,
              color: agSubtle,
              decoration: TextDecoration.lineThrough,
              decorationColor: agSubtle,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bosh ekran tepasidagi "Chegirmalar" lentasi. Bo'sh bo'lsa — hech narsa
/// chizilmaydi (eski server yoki aksiya yo'q).
class DealsCarousel extends StatelessWidget {
  const DealsCarousel({super.key, required this.deals, required this.onTap});

  final List<ActivePromotion> deals;
  final ValueChanged<ActivePromotion> onTap;

  @override
  Widget build(BuildContext context) {
    if (deals.isEmpty) return const SizedBox.shrink();
    final scale = MediaQuery.textScalerOf(context).scale(1);
    // Karta balandligi matn shkalasiga qarab o'sadi — 1.3x da ham
    // sarlavha va muddat kesilmaydi.
    final height = 112 + 40 * scale;
    final width = (MediaQuery.sizeOf(context).width * 0.72).clamp(240.0, 320.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace2),
          child: Text(
            context.l10n.saDealsTitle,
            style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText),
          ),
        ),
        SizedBox(
          height: height,
          child: ListView.separated(
            key: const ValueKey('deals-carousel'),
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: kSpace4),
            itemCount: deals.length,
            separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
            itemBuilder: (context, i) => SizedBox(
              width: width,
              child: _DealCard(deal: deals[i], onTap: () => onTap(deals[i])),
            ),
          ),
        ),
      ],
    );
  }
}

class _DealCard extends StatelessWidget {
  const _DealCard({required this.deal, required this.onTap});

  final ActivePromotion deal;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ends = deal.endsAt;
    return Semantics(
      button: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusLg),
            boxShadow: agCardShadow,
          ),
          clipBehavior: Clip.antiAlias,
          child: Row(
            children: [
              SizedBox(
                width: 92,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CatalogImage(
                      imageUrl: deal.vendorImageUrl,
                      placeholder: Container(
                        color: deal.isRestaurant ? agOrange : agPurple,
                        child: Icon(
                          deal.isRestaurant ? Icons.restaurant_rounded : Icons.storefront_rounded,
                          color: agOnPrimary.withValues(alpha: 0.85),
                          size: 34,
                        ),
                      ),
                    ),
                    Positioned(
                      left: kSpace2,
                      top: kSpace2,
                      child: DiscountBadge(label: deal.badge.shortLabel),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(kSpace3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (deal.vendorName != null)
                        Text(
                          deal.vendorName!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w700),
                        ),
                      Text(
                        deal.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: kFontBody, color: agText, fontWeight: FontWeight.w800),
                      ),
                      if (deal.description != null && deal.description!.isNotEmpty)
                        Text(
                          deal.description!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
                        ),
                      if (deal.badge.minOrderAmount case final min?)
                        Text(
                          context.l10n.saDealMinOrder(Formatters.formatSom(min)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w700),
                        ),
                      if (ends != null)
                        Text(
                          context.l10n.saDealUntil(Formatters.formatShortDate(ends.toLocal())),
                          maxLines: 1,
                          style: const TextStyle(fontSize: kFontMicro, color: kErrorDeep, fontWeight: FontWeight.w700),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
