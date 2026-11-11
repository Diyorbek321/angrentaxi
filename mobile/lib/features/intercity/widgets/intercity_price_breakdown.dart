import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

/// Qat'iy narx + "shahar ichiga davom" qatorlari. Davom yo'q bo'lsa hech
/// narsa chizmaydi — oddiy bandda ortiqcha qator kerak emas.
class IntercityPriceBreakdown extends StatelessWidget {
  const IntercityPriceBreakdown({
    super.key,
    required this.basePrice,
    required this.extensions,
  });

  final double basePrice;
  final List<IntercityExtensionCharge> extensions;

  @override
  Widget build(BuildContext context) {
    if (extensions.isEmpty) return const SizedBox.shrink();
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Line(label: l10n.icBasePrice, amount: basePrice),
        for (final charge in extensions)
          _Line(
            label: intercityExtensionLine(l10n, charge),
            caption: charge.estimated ? l10n.icExtensionEstimated : null,
            amount: charge.fare,
          ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.amount, this.caption});

  final String label;
  final String? caption;
  final double amount;

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontSize: kFontCaption, color: agSubtle);
    return Padding(
      padding: const EdgeInsets.only(bottom: kSpace1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: style),
                if (caption != null)
                  Text(caption!, style: style.copyWith(fontStyle: FontStyle.italic)),
              ],
            ),
          ),
          const SizedBox(width: kSpace2),
          Text(Formatters.formatPrice(amount), style: style),
        ],
      ),
    );
  }
}
