import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/widgets/legal_eligibility_card.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// "Onlayn chiqib bo'lmadi" — huquqiy sabablar RO'YXAT bo'lib, umumiy xato
/// snackbari o'rniga. Pastda bitta harakat: huquqiy profilni ochish.
///
/// [reasons] — `GET /drivers/me/legal` dagi sabablar (ustun) yoki server
/// xato matnidan ajratilganlari (zaxira).
Future<void> showLegalBlockSheet(
  BuildContext context, {
  required List<String> reasons,
  String? fallbackMessage,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      final l10n = sheetContext.l10n;
      return SafeArea(
        child: SingleChildScrollView(
          key: const ValueKey('legal_block_sheet'),
          padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const ExcludeSemantics(
                    child: Icon(Icons.gavel_rounded, color: kErrorDeep),
                  ),
                  const SizedBox(width: kSpace2),
                  Expanded(
                    child: Text(
                      l10n.lglGoOnlineBlockedTitle,
                      style: const TextStyle(
                        fontSize: kFontH3,
                        fontWeight: FontWeight.w800,
                        color: kInk,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: kSpace3),
              if (reasons.isEmpty)
                Text(
                  fallbackMessage ?? '',
                  style: const TextStyle(fontSize: kFontBody, color: kInk),
                )
              else ...[
                Text(
                  l10n.lglGoOnlineBlockedBody,
                  style: const TextStyle(
                    fontSize: kFontBody,
                    fontWeight: FontWeight.w700,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: kSpace2),
                for (final reason in reasons) LegalReasonRow(text: reason),
              ],
              const SizedBox(height: kSpace3),
              Text(
                l10n.lglCourierHint,
                style: const TextStyle(
                  fontSize: kFontLabel,
                  color: kInkMuted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: kSpace5),
              AppButton(
                key: const ValueKey('legal_block_open_profile'),
                label: l10n.lglOpenProfile,
                height: kControlHeightDriver,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  Navigator.of(context).pushNamed('/driver/legal');
                },
              ),
              const SizedBox(height: kSpace3),
              AppOutlinedButton(
                label: l10n.lglClose,
                height: kMinTapTargetDriver,
                onPressed: () => Navigator.of(sheetContext).pop(),
              ),
            ],
          ),
        ),
      );
    },
  );
}
