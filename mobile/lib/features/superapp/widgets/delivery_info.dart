import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Restoran/do'kon sahifasidagi qator: "🚚 7 000 so'm · ⏱ 30–50 daq ·
/// 100 000 so'm dan bepul". Mijoz buyurtmagacha narx va vaqtni biladi.
/// Server vaqt bermasa — vaqt qismi ko'rinmaydi.
class DeliveryInfoStrip extends StatelessWidget {
  const DeliveryInfoStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final superapp = context.watch<SuperappProvider>();
    final l10n = context.l10n;
    final eta = superapp.deliveryEta;
    final freeFrom = superapp.freeDeliveryFrom;
    return Wrap(
      key: const ValueKey('delivery-info-strip'),
      spacing: kSpace3,
      runSpacing: kSpace1,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _item(Icons.delivery_dining_rounded, Formatters.formatSom(superapp.baseDeliveryFee)),
        if (eta != null) _item(Icons.schedule_rounded, l10n.saDeliveryEta(eta.min, eta.max)),
        if (freeFrom != null)
          _item(Icons.local_offer_rounded, l10n.saFreeDeliveryFrom(Formatters.formatSom(freeFrom)),
              color: agGreenText),
      ],
    );
  }

  static Widget _item(IconData icon, String text, {Color color = kInkMuted}) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: kSpace1),
          Flexible(
            child: Text(
              text,
              style: TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      );
}

/// Savatdagi "Bepul yetkazishgacha yana 23 000 so'm" va progress chizig'i.
/// Chegara yo'q bo'lsa — hech narsa chizilmaydi.
class FreeDeliveryProgress extends StatelessWidget {
  const FreeDeliveryProgress({super.key});

  @override
  Widget build(BuildContext context) {
    final superapp = context.watch<SuperappProvider>();
    final from = superapp.freeDeliveryFrom;
    if (from == null || superapp.isCartEmpty) return const SizedBox.shrink();
    final remaining = superapp.freeDeliveryRemaining;
    final reached = remaining == null;
    final progress = (superapp.cartSubtotal / from).clamp(0.0, 1.0);
    final l10n = context.l10n;
    return AgSurfaceCard(
      key: const ValueKey('free-delivery-progress'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                reached ? Icons.check_circle_rounded : Icons.delivery_dining_rounded,
                size: 20,
                color: agGreenText,
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  reached
                      ? l10n.saFreeDeliveryReached
                      : l10n.saFreeDeliveryRemaining(Formatters.formatSom(remaining)),
                  style: const TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w700,
                    color: agText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace2),
          ClipRRect(
            borderRadius: BorderRadius.circular(kRadiusSm),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: agBorder,
              valueColor: const AlwaysStoppedAnimation(agGreenText),
            ),
          ),
        ],
      ),
    );
  }
}
