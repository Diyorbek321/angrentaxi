import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart' show PublicSettings;
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// ============================================================================
// OVQAT/MARKET MIJOZI — YETKAZISH HODISALARI (docs/INCIDENT-POLICY.md §2).
//
//   * Topshirish kodi: kuryer kodsiz topshira olmaydi — mijoz uni aytadi.
//   * "Kuryer eshik oldida" — bepul kutish boshlandi.
//   * Qaytarilmoqda / qaytarildi: kim nima to'laydi, kartaga nima qaytadi.
//
// Sozlamalar (`dropoffFreeWaitMinutes`, `returnFeePercent`) SuperappProvider
// orqali; u bo'lmagan muhitda — standart qiymatlar.
// ============================================================================

PublicSettings _settingsOf(BuildContext context) =>
    Provider.of<SuperappProvider?>(context, listen: false)?.publicSettings ??
    PublicSettings.defaults;

/// "Kuryerga ayting: 0 4 2 7" — kuryer yo'lda bo'lganda.
class HandoverCodeCard extends StatelessWidget {
  const HandoverCodeCard({super.key, required this.code, this.courierAtDoor = false});

  final String code;

  /// Kuryer manzilga yetib keldi — eshik oldida kutmoqda.
  final bool courierAtDoor;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final spaced = code.split('').join(' ');
    return Container(
      key: const ValueKey('handover_code_card'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agTint,
        borderRadius: BorderRadius.circular(kRadiusLg),
        border: Border.all(color: agPrimary.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (courierAtDoor) ...[
            Row(
              children: [
                const ExcludeSemantics(
                  child: Icon(Icons.door_front_door_rounded, color: agPrimary, size: 20),
                ),
                const SizedBox(width: kSpace2),
                Expanded(
                  child: Text(
                    l10n.saCourierAtDoor,
                    style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w800, color: agText),
                  ),
                ),
              ],
            ),
            const SizedBox(height: kSpace1),
            Text(
              l10n.saCourierAtDoorHint(_settingsOf(context).dropoffFreeWaitMinutes),
              style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
            ),
            const Divider(color: agBorder, height: kSpace5),
          ],
          Semantics(
            container: true,
            // Ekran o'quvchi raqamma-raqam o'qisin.
            label: '${l10n.saHandoverCodeTitle}: $spaced',
            excludeSemantics: true,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.saHandoverCodeTitle,
                    style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText),
                  ),
                ),
                Text(
                  spaced,
                  style: const TextStyle(
                    fontSize: kFontDisplay,
                    fontWeight: FontWeight.w900,
                    color: agPrimary,
                    letterSpacing: 2,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: kSpace2),
          Text(
            l10n.saHandoverCodeHint,
            style: const TextStyle(fontSize: kFontCaption, color: agSubtle, height: 1.4),
          ),
        ],
      ),
    );
  }
}

/// Qaytarilmoqda / qaytarildi kartasi.
class VendorReturnCard extends StatelessWidget {
  const VendorReturnCard({
    super.key,
    required this.returned,
    this.reasonLabel,
    this.returnCharge,
    this.refundDue,
    this.refundStatus,
  });

  /// `false` — hali qaytarilmoqda.
  final bool returned;
  final String? reasonLabel;

  /// Mijoz to'laydigan: yetkazish + kutish + qaytarish haqi.
  final double? returnCharge;

  /// Kartali buyurtma: qaytariladigan summa.
  final double? refundDue;

  /// `pending` / `done`.
  final String? refundStatus;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final percent = _settingsOf(context).returnFeePercent;
    final charge = returnCharge;
    final refund = refundDue;
    return Container(
      key: const ValueKey('vendor_return_card'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusLg),
        border: Border.all(color: kWarningDeep.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.assignment_return_rounded, color: kWarningDeep, size: 22),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  returned ? l10n.saReturnedTitle : l10n.saReturningTitle,
                  style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText),
                ),
              ),
              if (reasonLabel != null)
                Text(
                  reasonLabel!,
                  style: const TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w700, color: kWarningDeep),
                ),
            ],
          ),
          if (!returned) ...[
            const SizedBox(height: kSpace2),
            Text(
              l10n.saReturningHint,
              style: const TextStyle(fontSize: kFontLabel, color: agSubtle, height: 1.4),
            ),
          ],
          const SizedBox(height: kSpace2),
          if (charge != null && charge > 0)
            Text(
              l10n.saReturnChargeLine(Formatters.formatSom(charge)),
              style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w800, color: agText),
            ),
          Text(
            l10n.saReturnChargeExplain(percent),
            style: const TextStyle(fontSize: kFontCaption, color: agSubtle, height: 1.4),
          ),
          if (refund != null && refund > 0) ...[
            const SizedBox(height: kSpace2),
            Text(
              refundStatus == 'done'
                  ? l10n.saRefundDoneLine(Formatters.formatSom(refund))
                  : l10n.saRefundDueLine(Formatters.formatSom(refund)),
              key: const ValueKey('vendor_refund_line'),
              style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w700, color: agGreenText),
            ),
          ],
        ],
      ),
    );
  }
}
