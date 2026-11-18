import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Haydovchi tanlagan uzilish sababi va izohi.
@immutable
class InterruptChoice {
  const InterruptChoice(this.reason, this.note);

  /// Backend `INTERRUPT_REASONS`: accident | breakdown | other.
  final String reason;
  final String? note;
}

/// "Safar uzildi" (avariya / buzilish, INCIDENT-POLICY §5) — sabab va izoh.
/// Narxni server shu nuqtagacha hisoblaydi. Yopilsa — `null`.
Future<InterruptChoice?> showInterruptTripSheet(BuildContext context) {
  return showModalBottomSheet<InterruptChoice>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => const InterruptTripSheet(),
  );
}

class InterruptTripSheet extends StatefulWidget {
  const InterruptTripSheet({super.key});

  static const Key confirmKey = ValueKey('interrupt_trip_confirm');

  @override
  State<InterruptTripSheet> createState() => _InterruptTripSheetState();
}

class _InterruptTripSheetState extends State<InterruptTripSheet> {
  String _reason = 'breakdown';
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final reasons = <String, String>{
      'accident': l10n.drvInterruptAccident,
      'breakdown': l10n.drvInterruptBreakdown,
      'other': l10n.drvInterruptOther,
    };
    return Padding(
      padding: EdgeInsets.fromLTRB(
        kSpace4,
        0,
        kSpace4,
        kSpace5 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.drvInterruptTitle,
            style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: kInk),
          ),
          const SizedBox(height: kSpace2),
          Text(l10n.drvInterruptBody, style: const TextStyle(color: kInkMuted, fontSize: kFontLabel)),
          const SizedBox(height: kSpace4),
          Wrap(
            spacing: kSpace2,
            runSpacing: kSpace2,
            children: [
              for (final entry in reasons.entries)
                ChoiceChip(
                  key: ValueKey('interrupt_reason_${entry.key}'),
                  label: Text(entry.value),
                  selected: _reason == entry.key,
                  onSelected: (_) => setState(() => _reason = entry.key),
                ),
            ],
          ),
          const SizedBox(height: kSpace4),
          TextField(
            controller: _note,
            maxLength: 300,
            maxLines: 2,
            decoration: InputDecoration(hintText: l10n.drvInterruptNoteHint),
          ),
          const SizedBox(height: kSpace3),
          AppOutlinedButton(
            key: InterruptTripSheet.confirmKey,
            label: l10n.drvInterruptConfirm,
            height: kMinTapTargetDriver,
            // Xavf MATNI kErrorDeep (6.47:1); kError faqat chegara uchun.
            textColor: kErrorDeep,
            borderColor: kError,
            onPressed: () => Navigator.of(context).pop(
              InterruptChoice(_reason, _note.text.trim().isEmpty ? null : _note.text.trim()),
            ),
          ),
        ],
      ),
    );
  }
}
