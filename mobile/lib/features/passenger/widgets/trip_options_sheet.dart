import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/trip_option.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Safar opsiyalarini tanlash (bola o'rindig'i, hayvon, ...).
///
/// ⚠️ Har bir opsiya haydovchilar hovuzini TORAYTIRADI — matching faqat
/// hammasini ta'minlay oladigan haydovchiga taklif yuboradi. Shuning uchun
/// pastda buni ochiq aytamiz: yo'lovchi "nega haydovchi uzoq topilyapti?"
/// savoliga javobni oldindan bilsin.
class TripOptionsSheet extends StatefulWidget {
  const TripOptionsSheet({super.key, required this.initial});

  final List<TripOption> initial;

  /// Tanlovni qaytaradi; sheet yopilsa (`null`) — tanlov o'zgarmaydi.
  static Future<List<TripOption>?> show(
    BuildContext context, {
    required List<TripOption> initial,
  }) {
    return showModalBottomSheet<List<TripOption>>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => TripOptionsSheet(initial: initial),
    );
  }

  @override
  State<TripOptionsSheet> createState() => _TripOptionsSheetState();
}

class _TripOptionsSheetState extends State<TripOptionsSheet> {
  late final Set<TripOption> _selected = {...widget.initial};

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace2),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.l10n.paxTripOptionsTitle,
              style: const TextStyle(fontSize: kFontH3, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: kSpace2),
            for (final option in TripOption.values)
              CheckboxListTile(
                key: ValueKey('trip-option-${option.apiValue}'),
                contentPadding: EdgeInsets.zero,
                value: _selected.contains(option),
                onChanged: (checked) => setState(() {
                  if (checked ?? false) {
                    _selected.add(option);
                  } else {
                    _selected.remove(option);
                  }
                }),
                secondary: Icon(option.icon, color: kInkMuted),
                title: Text(option.label),
              ),
            const SizedBox(height: kSpace2),
            Text(
              context.l10n.paxTripOptionsHint,
              style: const TextStyle(color: kInkMuted, fontSize: kFontLabel, height: 1.35),
            ),
            const SizedBox(height: kSpace4),
            AppButton(
              label: context.l10n.paxDone,
              onPressed: () => Navigator.of(context).pop(
                TripOption.values.where(_selected.contains).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
