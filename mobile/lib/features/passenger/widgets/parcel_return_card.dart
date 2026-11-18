import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Posilka qaytarilmoqda (docs/INCIDENT-POLICY.md §2) — yuboruvchi ko'radi.
///
/// Haydovchi qabul qiluvchiga topshira olmadi va posilkani yuboruvchiga
/// qaytarib olib kelmoqda. Safarni haydovchi emas, YUBORUVCHI yopadi —
/// posilka qo'liga tekkach "Posilka qaytib keldi" ni bosadi. To'lov:
/// yetkazish haqi + qaytarish haqi (yetkazish haqining [returnFeePercent]%).
class ParcelReturnCard extends StatelessWidget {
  const ParcelReturnCard({
    super.key,
    required this.order,
    required this.returnFeePercent,
    required this.busy,
    this.onConfirm,
  });

  final Order order;
  final int returnFeePercent;
  final bool busy;

  /// `null` — tugma ko'rsatilmaydi (masalan testda yoki eski ekranda).
  final VoidCallback? onConfirm;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final reason = deliveryFailureReasonLabel(order.deliveryFailureReason);
    return Container(
      key: const ValueKey('parcel_return_card'),
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kWarningDeep.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.assignment_return_rounded, color: kWarningDeep, size: 22),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  l10n.paxParcelReturningTitle,
                  style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w800, color: kInk),
                ),
              ),
              if (reason != null)
                Text(
                  reason,
                  style: const TextStyle(
                    fontSize: kFontCaption,
                    fontWeight: FontWeight.w700,
                    color: kWarningDeep,
                  ),
                ),
            ],
          ),
          const SizedBox(height: kSpace2),
          Text(
            l10n.paxParcelReturningHint,
            style: const TextStyle(fontSize: kFontLabel, color: kInkMuted, height: 1.4),
          ),
          const SizedBox(height: kSpace1),
          Text(
            l10n.paxParcelReturnFeeExplain(returnFeePercent),
            style: const TextStyle(fontSize: kFontCaption, color: kInk, fontWeight: FontWeight.w600),
          ),
          if (onConfirm != null) ...[
            const SizedBox(height: kSpace3),
            AppButton(
              key: const ValueKey('parcel_confirm_returned_button'),
              label: l10n.paxParcelConfirmReturned,
              isLoading: busy,
              onPressed: busy ? null : onConfirm,
            ),
          ],
        ],
      ),
    );
  }
}
