import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_events_host.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/shift_pass.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// KUNLIK SMENA — docs/LEGAL-COMPLIANCE.md §8.
///
/// `enabled = false` bo'lsa umuman chizilmaydi. Faol smena bo'lsa — qolgan
/// vaqt (har daqiqada yangilanadi); bo'lmasa — narx, taqqoslash va "olish"
/// tugmasi (tasdiqlash oynasi orqali — pul yechiladi).
class ShiftPassCard extends StatefulWidget {
  const ShiftPassCard({super.key, required this.info, this.now});

  final ShiftPassInfo info;

  /// Testlar uchun soat.
  final DateTime Function()? now;

  @override
  State<ShiftPassCard> createState() => _ShiftPassCardState();
}

class _ShiftPassCardState extends State<ShiftPassCard> {
  Timer? _ticker;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    _syncTicker();
  }

  @override
  void didUpdateWidget(covariant ShiftPassCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncTicker();
  }

  /// Taymer faqat faol smena bor paytda ishlaydi.
  void _syncTicker() {
    final active = widget.info.current?.isActiveAt(_now()) ?? false;
    if (active && _ticker == null) {
      _ticker = Timer.periodic(const Duration(minutes: 1), (_) {
        if (mounted) setState(() {});
      });
    } else if (!active) {
      _ticker?.cancel();
      _ticker = null;
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    if (!info.enabled) return const SizedBox.shrink();
    final l10n = context.l10n;
    final current = info.current;
    final active = current != null && current.isActiveAt(_now());

    return AgSurfaceCard(
      key: const ValueKey('shift_pass_card'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.timer_outlined, color: kPrimary, size: 22),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  l10n.shfTitle,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: kFontTitle,
                    color: kInk,
                  ),
                ),
              ),
              if (active)
                AppStatusBadge(
                  label: l10n.shfActive,
                  tone: AppStatusTone.success,
                  dense: true,
                ),
            ],
          ),
          const SizedBox(height: kSpace2),
          if (active) ...[
            Text(
              l10n.shfRemaining(
                  formatShiftRemaining(current.remainingAt(_now()))),
              key: const ValueKey('shift_pass_remaining'),
              style: const TextStyle(
                fontSize: kFontH2,
                fontWeight: FontWeight.w800,
                color: kPrimary,
              ),
            ),
            const SizedBox(height: kSpace1),
            Text(
              Formatters.formatDateTime(current.endsAt),
              style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
            ),
          ] else ...[
            Text(
              l10n.shfSubtitle(info.durationHours),
              style: const TextStyle(fontSize: kFontBody, color: kInkMuted),
            ),
            const SizedBox(height: kSpace3),
            _ComparisonBlock(comparison: info.comparison),
            const SizedBox(height: kSpace4),
            Consumer<DriverWalletProvider>(
              builder: (context, wallet, _) => AppButton(
                key: const ValueKey('shift_pass_buy_button'),
                label: l10n.shfBuy(Formatters.formatPrice(info.price)),
                height: kControlHeightDriver,
                isLoading: wallet.isBuyingShiftPass,
                onPressed: wallet.isBuyingShiftPass
                    ? null
                    : () => confirmAndBuyShiftPass(context, info),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ComparisonBlock extends StatelessWidget {
  const _ComparisonBlock({required this.comparison});

  final ShiftPassComparison comparison;

  @override
  Widget build(BuildContext context) {
    final verdict = shiftPassVerdictText(comparison);
    final favoursPass =
        comparison.cheaperOption == ShiftPassCheaperOption.shiftPass;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            shiftPassComparisonText(comparison),
            key: const ValueKey('shift_pass_comparison'),
            style:
                const TextStyle(fontSize: kFontBody, color: kInk, height: 1.4),
          ),
          if (verdict != null) ...[
            const SizedBox(height: kSpace1),
            Text(
              verdict,
              key: const ValueKey('shift_pass_verdict'),
              style: TextStyle(
                fontSize: kFontBody,
                fontWeight: FontWeight.w800,
                color: favoursPass ? kPrimary : kInkMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Tasdiqlash oynasi → `POST /drivers/me/shift-pass` → natija.
Future<void> confirmAndBuyShiftPass(
  BuildContext context,
  ShiftPassInfo info,
) async {
  final l10n = context.l10n;
  final services = info.serviceTypes.map(serviceTypeLabel).join(', ');
  final confirmed = await showModalBottomSheet<bool>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.shfConfirmTitle,
              style: const TextStyle(
                fontSize: kFontH3,
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
            const SizedBox(height: kSpace3),
            Text(
              l10n.shfConfirmBody(
                Formatters.formatPrice(info.price),
                info.durationHours,
                services,
              ),
              style: const TextStyle(
                fontSize: kFontBody,
                color: kInkMuted,
                height: 1.4,
              ),
            ),
            const SizedBox(height: kSpace5),
            AppButton(
              key: const ValueKey('shift_pass_confirm_button'),
              label: l10n.shfConfirm,
              height: kControlHeightDriver,
              onPressed: () => Navigator.of(sheetContext).pop(true),
            ),
            const SizedBox(height: kSpace3),
            AppOutlinedButton(
              label: l10n.shfCancel,
              height: kMinTapTargetDriver,
              onPressed: () => Navigator.of(sheetContext).pop(false),
            ),
          ],
        ),
      ),
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final wallet = context.read<DriverWalletProvider>();
  final driver = context.read<DriverProvider>();
  final result = await wallet.buyShiftPass();
  if (!context.mounted) return;
  final messenger = ScaffoldMessenger.of(context);

  switch (result.outcome) {
    case ShiftPassBuyOutcome.bought:
      driver.loadWalletBalance();
      driver.loadEarningsBreakdown();
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.shfBought), backgroundColor: kInk),
      );
    case ShiftPassBuyOutcome.alreadyActive:
      messenger.showSnackBar(SnackBar(content: Text(l10n.shfAlreadyActive)));
    case ShiftPassBuyOutcome.rejected:
    case ShiftPassBuyOutcome.failed:
      messenger.showSnackBar(
        SnackBar(
          content: Text(result.message ?? l10n.drvErrorOccurred),
          backgroundColor: kErrorDeep,
          duration: const Duration(seconds: 8),
          action: result.isInsufficientFunds
              ? SnackBarAction(
                  label: l10n.wltTopUpShort,
                  textColor: kOnPrimary,
                  onPressed: () =>
                      Navigator.of(context).pushNamed(kDriverTopupRoute),
                )
              : null,
        ),
      );
  }
}
