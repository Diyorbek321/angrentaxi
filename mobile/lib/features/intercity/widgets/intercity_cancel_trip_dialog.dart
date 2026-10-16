import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Haydovchi qatnovni bekor qilishi — sabab MAJBURIY.
///
/// Sabab yo'lovchilarga xabarda boradi va dispetcher panelida ko'rinadi;
/// server ham bo'sh sababni rad etadi. So'rov dialog ICHIDA yuboriladi:
/// server xatosi (masalan, qatnov shu orada yo'lga chiqdi) shu yerda
/// ko'rsatiladi va haydovchi kontekstni yo'qotmaydi.
///
/// `true` — bekor qilindi; `null`/`false` — haydovchi fikridan qaytdi.
Future<bool?> showIntercityCancelTripDialog(
  BuildContext context, {
  required Future<void> Function(String reason) onConfirm,
}) =>
    showDialog<bool>(
      context: context,
      builder: (_) => _CancelTripDialog(onConfirm: onConfirm),
    );

class _CancelTripDialog extends StatefulWidget {
  const _CancelTripDialog({required this.onConfirm});

  final Future<void> Function(String reason) onConfirm;

  @override
  State<_CancelTripDialog> createState() => _CancelTripDialogState();
}

class _CancelTripDialogState extends State<_CancelTripDialog> {
  final _reason = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final reason = _reason.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = context.l10n.icDrvCancelReasonRequired);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onConfirm(reason);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = intercityErrorMessage(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      scrollable: true,
      title: Text(l10n.icDrvCancelTrip),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.icDrvCancelTripBody,
            style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
          ),
          const SizedBox(height: kSpace3),
          TextField(
            key: const ValueKey('ic_trip_cancel_reason'),
            controller: _reason,
            enabled: !_busy,
            maxLength: 500,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: l10n.icDrvCancelReasonHint,
              errorText: _error,
              errorMaxLines: 3,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: Text(l10n.icCancelConfirmNo),
        ),
        TextButton(
          key: const ValueKey('ic_trip_cancel_confirm'),
          onPressed: _busy ? null : _submit,
          style: TextButton.styleFrom(foregroundColor: kErrorDeep),
          child: Text(l10n.icDrvCancelTrip),
        ),
      ],
    );
  }
}
