import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/deals.dart';
import 'package:angren_taxi/shared/models/market_store.dart';
import 'package:angren_taxi/shared/widgets/catalog_image.dart';
import 'package:flutter/material.dart';

/// Market sahifasidagi do'kon kartochkasi — restoran kartochkasi bilan bir
/// xil til: rasm, aksiya belgisi, nom, aksiya matni, manzil va ish vaqti.
class MarketStoreCard extends StatelessWidget {
  const MarketStoreCard({super.key, required this.store, required this.onTap});

  final MarketStore store;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = store;
    final details = [
      if (s.address case final address? when address.isNotEmpty) address,
      '${s.workingHoursStart}–${s.workingHoursEnd}',
    ].join(' · ');

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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  SizedBox(
                    height: 116,
                    width: double.infinity,
                    child: CatalogImage(
                      imageUrl: s.imageUrl,
                      placeholder: Container(
                        color: agPrimary,
                        child: ExcludeSemantics(
                          child: Icon(Icons.storefront_rounded,
                              size: 48, color: agOnPrimary.withValues(alpha: 0.7)),
                        ),
                      ),
                    ),
                  ),
                  if (s.activePromotion != null)
                    Positioned(
                      top: kSpace3,
                      right: kSpace3,
                      child: DiscountBadge(label: s.activePromotion!.shortLabel),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                    if (s.activePromotion case final promo? when promo.title.isNotEmpty) ...[
                      const SizedBox(height: kSpace1),
                      Text(promo.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: kFontCaption, color: kErrorDeep, fontWeight: FontWeight.w700)),
                    ],
                    const SizedBox(height: kSpace1),
                    Text(details,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
