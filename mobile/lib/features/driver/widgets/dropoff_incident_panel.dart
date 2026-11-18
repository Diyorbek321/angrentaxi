import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/utils/waiting_charge.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/waiting_charge_ticker.dart';
import 'package:flutter/material.dart';

// ============================================================================
// TOPSHIRISH MANZILIDAGI HODISALAR (docs/INCIDENT-POLICY.md §2) — kuryer.
//
// Uch holat, bitta joyda:
//   1. yo'lda          → "Manzilga yetib keldim" (server 500 m ichida qabul qiladi)
//   2. manzilda        → kutish hisoblagichi (SERVER `dropoffArrivedAt` dan) va
//                        bepul kutish tugagach "Yetkazib bo'lmadi"
//   3. qaytarish yo'li → "Tovarni qaytaring" banneri; yakunlash tugmasi yo'q
//
// Hisob `WaitingChargeTicker` orqali — olish nuqtasidagi kutish bilan AYNAN
// bir formula (server `waiting-charge.ts` nusxasi). Bepul oyna esa tarifdan
// emas, `dropoffFreeWaitMinutes` sozlamasidan.
// ============================================================================

/// Kuryer safari panelidagi hodisalar bloki. Posilka/ovqat/market bo'lmagan
/// safarda hech narsa chizmaydi.
class DropoffIncidentPanel extends StatelessWidget {
  const DropoffIncidentPanel({
    super.key,
    required this.order,
    required this.freeWaitMinutes,
    required this.busy,
    required this.onArrived,
    required this.onFailed,
    this.clock,
  });

  final Order order;

  /// Sozlamalardagi `dropoffFreeWaitMinutes`.
  final int freeWaitMinutes;
  final bool busy;
  final VoidCallback onArrived;
  final VoidCallback onFailed;

  /// Testlar uchun soat.
  final DateTime Function()? clock;

  @override
  Widget build(BuildContext context) {
    if (!order.requiresHandoverCode) return const SizedBox.shrink();
    if (order.isReturning) return ReturnTripBanner(order: order);

    final l10n = context.l10n;
    final arrivedAt = order.dropoffArrivedAt;
    if (arrivedAt == null) {
      return AppOutlinedButton(
        key: const ValueKey('dropoff_arrived_button'),
        label: l10n.drvDropoffArrived,
        icon: const Icon(Icons.where_to_vote_rounded),
        height: kControlHeightDriver,
        onPressed: busy ? null : onArrived,
      );
    }

    return WaitingChargeTicker(
      arrivedAt: arrivedAt,
      freeWaitMinutes: freeWaitMinutes,
      waitingPricePerMinute: order.waitingPricePerMinute,
      clock: clock,
      builder: (context, charge) => _WaitBlock(
        order: order,
        charge: charge,
        busy: busy,
        onFailed: onFailed,
      ),
    );
  }
}

class _WaitBlock extends StatelessWidget {
  const _WaitBlock({
    required this.order,
    required this.charge,
    required this.busy,
    required this.onFailed,
  });

  final Order order;
  final WaitingCharge charge;
  final bool busy;
  final VoidCallback onFailed;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // Server ham aynan shu chegarani tekshiradi: bepul oyna to'liq o'tgan.
    final canFail = charge.freeRemaining == Duration.zero;
    final collectCash = order.delivery?.collectCash ?? 0;
    final waitText = charge.isFree
        ? l10n.drvDropoffWaitFree(formatWaitClock(charge.freeRemaining))
        : l10n.drvDropoffWaitPaid(
            charge.billableMinutes,
            Formatters.formatSom(charge.fare.toDouble()),
          );

    return Column(
      key: const ValueKey('dropoff_wait_block'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace3),
          decoration: BoxDecoration(
            color: charge.isFree ? kMintTint : kWarningLight,
            borderRadius: BorderRadius.circular(kRadiusMd),
          ),
          child: Row(
            children: [
              ExcludeSemantics(
                child: Icon(
                  Icons.timer_outlined,
                  color: charge.isFree ? kPrimary : kWarningDeep,
                  size: 22,
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Text(
                  waitText,
                  style: const TextStyle(
                    fontSize: kFontBodyLg,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
          ),
        ),
        // Naqd ovqat/market: kutish haqi eshik oldida olinadigan naqdga
        // qo'shiladi — kuryer jami summani bilishi shart.
        if (collectCash > 0 && charge.fare > 0) ...[
          const SizedBox(height: kSpace2),
          Text(
            l10n.drvDropoffWaitCashNote(
              Formatters.formatSom((collectCash + charge.fare).toDouble()),
            ),
            key: const ValueKey('dropoff_wait_cash_note'),
            style: const TextStyle(
              fontSize: kFontLabel,
              fontWeight: FontWeight.w700,
              color: kWarningDeep,
            ),
          ),
        ],
        const SizedBox(height: kSpace2),
        AppOutlinedButton(
          key: const ValueKey('delivery_failed_button'),
          label: l10n.drvDeliveryFailed,
          icon: const Icon(Icons.assignment_return_rounded),
          borderColor: canFail ? kErrorDeep : null,
          textColor: canFail ? kErrorDeep : null,
          height: kControlHeightDriver,
          onPressed: (canFail && !busy) ? onFailed : null,
        ),
        if (!canFail) ...[
          const SizedBox(height: kSpace1),
          Text(
            l10n.drvDeliveryFailedLocked,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
          ),
        ],
      ],
    );
  }
}

/// Qaytarish yo'li: kuryer tovarni olingan joyga olib boradi, qaytarishni
/// sotuvchi/yuboruvchi tasdiqlaydi (kuryer o'zi emas).
class ReturnTripBanner extends StatelessWidget {
  const ReturnTripBanner({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final reason = deliveryFailureReasonLabel(order.deliveryFailureReason);
    return Container(
      key: const ValueKey('return_trip_banner'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kWarningDeep.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.assignment_return_rounded, color: kWarningDeep, size: 24),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  l10n.drvReturnBannerTitle,
                  style: const TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
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
            l10n.drvReturnBannerHint,
            style: const TextStyle(fontSize: kFontLabel, color: kInkMuted, height: 1.4),
          ),
        ],
      ),
    );
  }
}

/// "Yetkazib bo'lmadi" sababi. Qaytaradi: [kDeliveryFailureReasons] dan
/// biri yoki `null` (bekor qilindi).
Future<String?> showDeliveryFailureReasonSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
    ),
    builder: (sheetContext) {
      final l10n = sheetContext.l10n;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, kSpace6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.drvDeliveryFailedTitle,
                style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: kInk),
              ),
              const SizedBox(height: kSpace1),
              Text(
                l10n.drvDeliveryFailedHint,
                style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
              ),
              const SizedBox(height: kSpace4),
              for (final reason in kDeliveryFailureReasons) ...[
                AppOutlinedButton(
                  key: ValueKey('fail_reason_$reason'),
                  label: deliveryFailureReasonLabel(reason)!,
                  height: kControlHeightDriver,
                  onPressed: () => Navigator.of(sheetContext).pop(reason),
                ),
                const SizedBox(height: kSpace2),
              ],
            ],
          ),
        ),
      );
    },
  );
}
