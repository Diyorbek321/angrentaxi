import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Tasdiqlash varag'i natijasi. `reason == null` — sabab tanlanmagan
/// (sabab ixtiyoriy).
@immutable
class CancelSheetResult {
  const CancelSheetResult(this.reason);
  final String? reason;
}

/// Bekor qilishni tasdiqlash varag'i — taksi, ovqat va market uchun bitta.
///
/// Sabab CHIPLAR bilan (bir bosishda), "Boshqa sabab" tanlansa matn maydoni
/// ochiladi. Varaq klaviatura ostida qolmaydi (`viewInsets`). Yopilsa yoki
/// "Yo'q" bosilsa — `null`.
Future<CancelSheetResult?> showCancelOrderSheet(
  BuildContext context, {
  required String title,
  required List<String> reasons,
  required String otherReason,
  String? prompt,
  String? confirmLabel,
  String? keepLabel,
}) {
  return showModalBottomSheet<CancelSheetResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => CancelOrderSheet(
      title: title,
      reasons: reasons,
      otherReason: otherReason,
      prompt: prompt,
      confirmLabel: confirmLabel,
      keepLabel: keepLabel,
    ),
  );
}

class CancelOrderSheet extends StatefulWidget {
  const CancelOrderSheet({
    super.key,
    required this.title,
    required this.reasons,
    required this.otherReason,
    this.prompt,
    this.confirmLabel,
    this.keepLabel,
  });

  final String title;
  final List<String> reasons;
  final String otherReason;
  final String? prompt;
  final String? confirmLabel;
  final String? keepLabel;

  @override
  State<CancelOrderSheet> createState() => _CancelOrderSheetState();
}

class _CancelOrderSheetState extends State<CancelOrderSheet> {
  String? _selected;
  final TextEditingController _other = TextEditingController();

  @override
  void dispose() {
    _other.dispose();
    super.dispose();
  }

  String? get _reason {
    final selected = _selected;
    if (selected == null) return null;
    if (selected == widget.otherReason) {
      final text = _other.text.trim();
      return text.isEmpty ? null : text;
    }
    return selected;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(kSpace5, 0, kSpace5, kSpace5),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title,
              style: const TextStyle(
                fontSize: kFontH2,
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
            const SizedBox(height: kSpace2),
            Text(
              widget.prompt ?? l10n.saCancelOrderReasonPrompt,
              style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
            ),
            const SizedBox(height: kSpace3),
            Wrap(
              spacing: kSpace2,
              runSpacing: kSpace2,
              children: [
                for (final reason in widget.reasons)
                  ChoiceChip(
                    label: Text(reason),
                    selected: _selected == reason,
                    onSelected: (on) =>
                        setState(() => _selected = on ? reason : null),
                  ),
              ],
            ),
            if (_selected == widget.otherReason) ...[
              const SizedBox(height: kSpace3),
              TextField(
                controller: _other,
                autofocus: true,
                maxLines: 2,
                maxLength: 200,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(hintText: l10n.saCancelReasonHint),
              ),
            ],
            const SizedBox(height: kSpace5),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: kErrorDeep,
                foregroundColor: kOnPrimary,
                minimumSize: const Size.fromHeight(kControlHeightSm),
              ),
              onPressed: () =>
                  Navigator.of(context).pop(CancelSheetResult(_reason)),
              child: Text(widget.confirmLabel ?? l10n.saCancelOrderConfirm),
            ),
            const SizedBox(height: kSpace2),
            TextButton(
              style: TextButton.styleFrom(
                minimumSize: const Size.fromHeight(kMinTapTarget),
              ),
              onPressed: () => Navigator.of(context).pop(),
              child: Text(widget.keepLabel ?? l10n.saCancelOrderKeep),
            ),
          ],
        ),
      ),
    );
  }
}
