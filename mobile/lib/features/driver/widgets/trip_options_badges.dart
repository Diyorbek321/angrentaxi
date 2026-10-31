import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/trip_option.dart';
import 'package:flutter/material.dart';

/// Yo'lovchi so'ragan opsiyalar — taklif va safar ekranlarida.
///
/// Haydovchi bu buyurtmani aynan shular tufayli olgan, va bola o'rindig'ini
/// o'rnatishni unutsa safar boshlanmaydi — shuning uchun ko'zga tashlanadigan
/// chiplar, izoh matni ichida emas.
class TripOptionsBadges extends StatelessWidget {
  const TripOptionsBadges({super.key, required this.options});

  final List<TripOption> options;

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) return const SizedBox.shrink();
    return Semantics(
      label: context.l10n.drvPassengerRequested(
        options.map((o) => o.label).join(', '),
      ),
      excludeSemantics: true,
      child: Wrap(
        spacing: kSpace2,
        runSpacing: kSpace2,
        children: [
          for (final option in options)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: kSpace3, vertical: kSpace1 + 2),
              decoration: BoxDecoration(
                color: kInfoLight,
                borderRadius: BorderRadius.circular(kRadiusFull),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(option.icon, size: 16, color: kInfoDeep),
                  const SizedBox(width: kSpace1),
                  Text(
                    option.label,
                    style: const TextStyle(
                      color: kInfoDeep,
                      fontWeight: FontWeight.w700,
                      fontSize: kFontLabel,
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
