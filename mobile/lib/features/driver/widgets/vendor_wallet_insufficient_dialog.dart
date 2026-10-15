import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_events_host.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// Kuryer hamyon rejimi: naqd ovqat/market buyurtmasini qabul qilish uchun
/// hamyonda tovar summasi yetmaydi (docs/LEGAL-COMPLIANCE.md §7).
///
/// Server matni + `details` dagi summalar ([amounts], "Kerak: X, balans: Y")
/// + nima uchunligi + "To'ldirish".
Future<void> showVendorWalletInsufficientDialog(
  BuildContext context,
  String serverMessage, {
  String? amounts,
}) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      final l10n = dialogContext.l10n;
      return AlertDialog(
        key: const ValueKey('vendor_wallet_insufficient_dialog'),
        icon: const Icon(
          Icons.account_balance_wallet_outlined,
          color: kWarningDeep,
          size: 36,
        ),
        title: Text(l10n.wltVendorInsufficientTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              serverMessage,
              style: const TextStyle(
                fontSize: kFontBody,
                fontWeight: FontWeight.w700,
                color: kInk,
              ),
            ),
            if (amounts != null) ...[
              const SizedBox(height: kSpace2),
              Text(
                amounts,
                key: const ValueKey('vendor_wallet_amounts'),
                style: const TextStyle(
                  fontSize: kFontBody,
                  fontWeight: FontWeight.w800,
                  color: kWarningDeep,
                ),
              ),
            ],
            const SizedBox(height: kSpace3),
            Text(
              l10n.wltVendorInsufficientBody,
              style: const TextStyle(
                fontSize: kFontLabel,
                color: kInkMuted,
                height: 1.4,
              ),
            ),
          ],
        ),
        actionsOverflowButtonSpacing: kSpace3,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            style: TextButton.styleFrom(
              minimumSize: const Size(64, kMinTapTargetDriver),
            ),
            child: Text(l10n.lglClose),
          ),
          ElevatedButton.icon(
            key: const ValueKey('vendor_wallet_topup_button'),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, kMinTapTargetDriver),
            ),
            onPressed: () {
              Navigator.of(dialogContext).pop();
              Navigator.of(context).pushNamed(kDriverTopupRoute);
            },
            icon: const Icon(Icons.add_card_rounded),
            label: Text(l10n.wltTopUpTitle),
          ),
        ],
      );
    },
  );
}
