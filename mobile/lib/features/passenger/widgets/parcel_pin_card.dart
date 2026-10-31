import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Posilka yuboruvchisiga topshirish PIN kodi.
///
/// Kod katta va raqamlari ajratilgan: yuboruvchi uni telefonda qabul
/// qiluvchiga o'qib beradi — "ikki, nol, to'rt, yetti". Haydovchi bu kodni
/// hech qayerda ko'rmaydi; usiz posilkani topshira olmaydi.
class ParcelPinCard extends StatelessWidget {
  const ParcelPinCard({super.key, required this.pin});

  final String pin;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Semantics(
      container: true,
      // Ekran o'quvchi kodni raqamma-raqam o'qisin, "ikki ming qirq yetti" emas.
      label: '${l10n.paxParcelPinTitle}: ${pin.split('').join(' ')}',
      excludeSemantics: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: kMintTint,
          borderRadius: BorderRadius.circular(kRadiusMd),
          border: Border.all(color: kPrimary.withValues(alpha: 0.35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.pin_rounded, color: kPrimary, size: 20),
                const SizedBox(width: kSpace2),
                Text(
                  l10n.paxParcelPinTitle,
                  style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w800, color: kInk),
                ),
                const Spacer(),
                Text(
                  pin.split('').join(' '),
                  style: const TextStyle(
                    fontSize: kFontDisplay,
                    fontWeight: FontWeight.w900,
                    color: kPrimary,
                    letterSpacing: 2,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            const SizedBox(height: kSpace2),
            Text(
              l10n.paxParcelPinHint,
              style: const TextStyle(fontSize: kFontCaption, color: kInkMuted, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
