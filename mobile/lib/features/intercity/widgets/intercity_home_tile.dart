import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/service_catalog.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

/// Bosh sahifadagi "Shaharlararo" plitkasi — TO'LIQ KENGLIKDA.
///
/// ⚠️ Nega ikkilamchi xizmatlar qatorida emas: u qator to'rtta teng
/// plitkaga mo'ljallangan, beshinchisi tor ekranda yorliqni kesardi.
/// Shaharlararo boshqa turdagi xizmat ham (jadval bo'yicha, qat'iy narx),
/// shuning uchun bir qatorlik izoh bilan alohida turadi.
class IntercityHomeTile extends StatelessWidget {
  const IntercityHomeTile({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppPressable(
      key: const ValueKey('intercity_home_tile'),
      onTap: onTap,
      semanticsLabel: l10n.icTileTitle,
      child: Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(agRadiusMd),
          boxShadow: agCardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: agTint,
                borderRadius: BorderRadius.circular(agRadiusSm),
              ),
              child: Icon(ServiceCatalogEntry.intercity.icon,
                  color: agGreenText),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.icTileTitle,
                    style: const TextStyle(
                      fontSize: kFontTitle,
                      fontWeight: FontWeight.w800,
                      color: agText,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.icTileSubtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontCaption,
                      color: agSubtle,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: agMuted),
          ],
        ),
      ),
    );
  }
}
