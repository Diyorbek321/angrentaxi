import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/features/superapp/screens/support_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/vendor_order_actions.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/cancel_order_sheet.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Ovqat/market buyurtmasini bekor qilish oqimi: tasdiq varag'i → so'rov →
/// natija xabari. `true` — buyurtma bekor qilindi.
Future<bool> runVendorCancelFlow(
  BuildContext context, {
  required String kind,
  required String orderId,
}) async {
  final l10n = context.l10n;
  final reasons = [
    l10n.saCancelReasonChangedMind,
    l10n.saCancelReasonWrongItems,
    l10n.saCancelReasonWrongAddress,
    l10n.saCancelReasonTooLong,
    l10n.saCancelReasonOther,
  ];
  final food = kind == 'food' ? context.read<FoodProvider>() : null;
  final market = kind == 'food' ? null : context.read<MarketProvider>();
  final messenger = ScaffoldMessenger.of(context);

  final choice = await showCancelOrderSheet(
    context,
    title: l10n.saCancelOrderTitle,
    reasons: reasons,
    otherReason: l10n.saCancelReasonOther,
  );
  if (choice == null) return false;

  final result = food != null
      ? await food.cancelOrder(orderId, reason: choice.reason)
      : await market!.cancelOrder(orderId, reason: choice.reason);

  switch (result.outcome) {
    case VendorCancelOutcome.cancelled:
      AppHaptics.success();
      messenger.showSnackBar(SnackBar(content: Text(l10n.saOrderCancelledToast)));
      return true;
    case VendorCancelOutcome.notAllowed:
      messenger.showSnackBar(SnackBar(
        content: Text(result.message ??
            (kind == 'food' ? l10n.saCancelNotAllowedHint : l10n.saCancelNotAllowedMarketHint)),
      ));
      return false;
    case VendorCancelOutcome.failed:
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.saCancelFailed(result.message ?? l10n.saErrorOccurred)),
      ));
      return false;
  }
}

/// Buyurtma ekranlaridagi ikkilamchi "Buyurtmani bekor qilish" amali.
///
/// Mumkin bo'lmasa tugma YO'QOLMAYDI — o'chiq holda turadi va pastida
/// sababi hamda qo'llab-quvvatlashga havola ko'rinadi: foydalanuvchi
/// "bekor qilish qayerda?" deb qidirib qolmaydi.
class VendorCancelAction extends StatelessWidget {
  const VendorCancelAction({
    super.key,
    required this.kind,
    required this.canCancel,
    required this.onCancel,
  });

  final String kind;
  final bool canCancel;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton.icon(
          key: const ValueKey('vendor-cancel-button'),
          style: OutlinedButton.styleFrom(
            foregroundColor: kErrorDeep,
            side: BorderSide(color: canCancel ? kErrorBorder : agBorder),
            minimumSize: const Size.fromHeight(kControlHeightSm),
          ),
          onPressed: canCancel ? onCancel : null,
          icon: const Icon(Icons.close_rounded, size: 20),
          label: Text(l10n.saCancelOrderAction),
        ),
        if (!canCancel) ...[
          const SizedBox(height: kSpace2),
          Text(
            kind == 'food' ? l10n.saCancelNotAllowedHint : l10n.saCancelNotAllowedMarketHint,
            key: const ValueKey('vendor-cancel-hint'),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: kFontCaption, color: agSubtle, height: 1.4),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const SupportScreen()),
            ),
            child: Text(l10n.saContactSupport),
          ),
        ],
      ],
    );
  }
}
