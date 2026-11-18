import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Posilkani topshirishdan oldin qabul qiluvchi aytgan PIN kodni so'raydi.
///
/// Modal bu yerda o'rinli (safar ekranidagi boshqa amallardan farqli):
/// topshirish paytida mashina to'xtagan, haydovchi qabul qiluvchi bilan yuzma-
/// yuz turibdi. Qaytaradi: 4 xonali kod yoki `null` (bekor qilindi).
///
/// Ovqat/market ham shu oynadan o'tadi (docs/INCIDENT-POLICY.md §2) — faqat
/// [title]/[hint] boshqa: kodni mijozning o'zi aytadi.
Future<String?> showParcelPinDialog(BuildContext context, {String? title, String? hint}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _ParcelPinDialog(title: title, hint: hint),
  );
}

class _ParcelPinDialog extends StatefulWidget {
  const _ParcelPinDialog({this.title, this.hint});

  final String? title;
  final String? hint;

  @override
  State<_ParcelPinDialog> createState() => _ParcelPinDialogState();
}

class _ParcelPinDialogState extends State<_ParcelPinDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _complete => _controller.text.length == 4;

  void _submit() {
    if (_complete) Navigator.of(context).pop(_controller.text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kRadiusLg)),
      title: Text(widget.title ?? l10n.drvParcelPinTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.hint ?? l10n.drvParcelPinHint, style: const TextStyle(color: kInkMuted)),
          const SizedBox(height: kSpace4),
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 4,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _submit(),
            style: const TextStyle(fontSize: kFontDisplay, fontWeight: FontWeight.w900, letterSpacing: 12),
            decoration: const InputDecoration(counterText: '', hintText: '••••'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(l10n.drvCancel)),
        FilledButton(onPressed: _complete ? _submit : null, child: Text(l10n.drvParcelPinSubmit)),
      ],
    );
  }
}
