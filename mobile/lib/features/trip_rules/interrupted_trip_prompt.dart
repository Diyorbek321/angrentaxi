import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Safar uzildi (avariya/buzilish, INCIDENT-POLICY §5): yo'lovchiga shu
/// joydan darhol yangi taksi taklif qilinadi. `true` — yangi qidiruv.
Future<bool> showInterruptedTripPrompt(BuildContext context) async {
  final l10n = context.l10n;
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l10n.paxInterruptedTitle),
      content: Text(l10n.paxInterruptedBody),
      actionsPadding: const EdgeInsets.fromLTRB(kSpace4, kSpace2, kSpace4, kSpace4),
      actions: [
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppButton(
              key: const ValueKey('interrupted_new_search'),
              label: l10n.paxInterruptedNewSearch,
              onPressed: () => Navigator.of(ctx).pop(true),
            ),
            const SizedBox(height: kSpace3),
            AppOutlinedButton(
              label: l10n.paxInterruptedClose,
              onPressed: () => Navigator.of(ctx).pop(false),
            ),
          ],
        ),
      ],
    ),
  );
  return result ?? false;
}
