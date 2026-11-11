import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/deals.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:flutter/material.dart';

/// Market mahsuloti kartochkasi — do'kon ekrani va bosh sahifa lentasi.
class MarketProductCard extends StatelessWidget {
  const MarketProductCard({
    super.key,
    required this.product,
    required this.onOpen,
    required this.onAdd,
    this.subtitle,
  });
  final MarketProduct product;
  final VoidCallback onOpen;
  final VoidCallback onAdd;

  /// Nom ostidagi qator. Berilmasa — o'lchov birligi (do'kon ekrani);
  /// bosh sahifa lentasi do'kon nomini beradi.
  final String? subtitle;

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
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                    CatalogImage(
                      imageUrl: p.imageUrl,
                      placeholder: Container(
                        alignment: Alignment.center,
                        color: p.color,
                        child: ExcludeSemantics(
                          child: Text(p.emoji, style: const TextStyle(fontSize: 34)),
                        ),
                      ),
                    ),
                    if (p.hasDiscount && p.discount != null)
                      Positioned(
                        left: kSpace1,
                        top: kSpace1,
                        child: DiscountBadge(label: p.discount!.shortLabel, dense: true),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: kSpace2),
              Text(p.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: kFontLabel, color: agText)),
              Text(subtitle ?? p.unit,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w600)),
              const SizedBox(height: kSpace2),
              Row(
                children: [
                  Expanded(
                    child: PriceTag(
                      price: p.effectivePrice,
                      oldPrice: p.hasDiscount ? p.price : null,
                      fontSize: kFontLabel,
                    ),
                  ),
                  Semantics(
                    button: true,
                    enabled: p.isAvailable,
                    label: context.l10n.saAddItemToCartLabel(p.name),
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
