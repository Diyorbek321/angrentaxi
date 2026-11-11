import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Joriy qoldiq — `null` (hali o'qilmagan) bo'lsa raqam chizilmaydi.
class WalletBalanceTile extends StatelessWidget {
  const WalletBalanceTile({super.key, required this.balance});

  final double? balance;

  @override
  Widget build(BuildContext context) {
    final value = balance;
    final debt = (value ?? 0) < 0;
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        gradient: kGradientInk,
        borderRadius: BorderRadius.circular(kRadiusLg),
      ),
      child: Row(
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.account_balance_wallet_rounded,
                color: kMintSoft, size: 28),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Text(
              context.l10n.wltCurrentBalance,
              style: TextStyle(
                color: kOnPrimary.withValues(alpha: 0.78),
                fontSize: kFontLabel,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value == null ? '—' : Formatters.formatPrice(value),
            key: const ValueKey('topup_balance_value'),
            style: TextStyle(
              color: debt ? kWarningDark : kMintSoft,
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// Tayyor summalar — katta, bir barmoqda bosiladigan chiplar.
class TopupPresetRow extends StatelessWidget {
  const TopupPresetRow({
    super.key,
    required this.presets,
    required this.selected,
    required this.onSelected,
  });

  final List<double> presets;
  final int? selected;
  final ValueChanged<double> onSelected;

  @override
  Widget build(BuildContext context) {
    if (presets.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: kSpace2,
      runSpacing: kSpace2,
      children: [
        for (final preset in presets)
          ChoiceChip(
            key: ValueKey('topup_preset_${preset.round()}'),
            label: Text(Formatters.formatPrice(preset)),
            selected: selected == preset.round(),
            showCheckmark: false,
            materialTapTargetSize: MaterialTapTargetSize.padded,
            padding: const EdgeInsets.symmetric(
              horizontal: kSpace3,
              vertical: kSpace3,
            ),
            selectedColor: kMintTint,
            labelStyle: const TextStyle(
              fontSize: kFontBodyLg,
              fontWeight: FontWeight.w700,
              color: kInk,
            ),
            side: BorderSide(
              color: selected == preset.round() ? kPrimary : kLineInteractive,
            ),
            onSelected: (_) => onSelected(preset),
          ),
      ],
    );
  }
}

/// Payme / Click tanlovi — ikkita teng, baland plitka.
class TopupProviderPicker extends StatelessWidget {
  const TopupProviderPicker({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final WalletTopupProvider selected;
  final ValueChanged<WalletTopupProvider> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final p in WalletTopupProvider.values) ...[
          if (p != WalletTopupProvider.values.first)
            const SizedBox(width: kSpace3),
          Expanded(
            child: Semantics(
              button: true,
              selected: p == selected,
              child: InkWell(
                key: ValueKey('topup_provider_${p.wireValue}'),
                onTap: () => onSelected(p),
                borderRadius: BorderRadius.circular(kRadiusMd),
                child: AnimatedContainer(
                  duration: kDurationFast,
                  height: kControlHeightDriver,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: p == selected ? kMintTint : kSurface,
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    border: Border.all(
                      color: p == selected ? kPrimary : kLineInteractive,
                      width: p == selected ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (p == selected)
                        const Padding(
                          padding: EdgeInsets.only(right: kSpace2),
                          child: Icon(Icons.check_circle_rounded,
                              color: kPrimary, size: 20),
                        ),
                      Text(
                        p.displayName,
                        style: const TextStyle(
                          fontSize: kFontTitle,
                          fontWeight: FontWeight.w800,
                          color: kInk,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

enum TopupPanelTone { waiting, success, failed }

/// Kutish / muvaffaqiyat / xato holati — bitta joyda, katta tugma bilan.
class TopupStatusPanel extends StatelessWidget {
  const TopupStatusPanel({
    super.key,
    required this.tone,
    required this.title,
    required this.body,
    required this.primaryLabel,
    required this.onPrimary,
    this.detail,
    this.secondaryLabel,
    this.onSecondary,
  });

  final TopupPanelTone tone;
  final String title;
  final String body;
  final String? detail;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final (statusTone, icon) = switch (tone) {
      TopupPanelTone.waiting => (
          AppStatusTone.info,
          Icons.hourglass_top_rounded
        ),
      TopupPanelTone.success => (
          AppStatusTone.success,
          Icons.check_circle_rounded
        ),
      TopupPanelTone.failed => (AppStatusTone.danger, Icons.error_rounded),
    };
    return AgSurfaceCard(
      padding: const EdgeInsets.all(kSpace5),
      child: Column(
        children: [
          if (tone == TopupPanelTone.waiting)
            const SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(color: kPrimary, strokeWidth: 3),
            )
          else
            Icon(icon, size: 56, color: statusTone.foreground),
          const SizedBox(height: kSpace3),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: kFontH3,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          const SizedBox(height: kSpace2),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: kFontBody,
              color: kInkMuted,
              height: 1.4,
            ),
          ),
          if (detail != null) ...[
            const SizedBox(height: kSpace3),
            Text(
              detail!,
              key: const ValueKey('topup_new_balance'),
              style: const TextStyle(
                fontSize: kFontTitle,
                fontWeight: FontWeight.w800,
                color: kPrimary,
              ),
            ),
          ],
          const SizedBox(height: kSpace4),
          AppButton(
            label: primaryLabel,
            height: kControlHeightDriver,
            onPressed: onPrimary,
          ),
          if (secondaryLabel != null && onSecondary != null) ...[
            const SizedBox(height: kSpace3),
            AppOutlinedButton(
              label: secondaryLabel!,
              height: kMinTapTargetDriver,
              onPressed: onSecondary,
            ),
          ],
        ],
      ),
    );
  }
}

/// Ilovadan to'ldirish o'chiq — operator orqali (qo'lda tuzatish, §12).
class OperatorTopupCard extends StatelessWidget {
  const OperatorTopupCard({super.key, required this.phone});

  final String? phone;

  Future<void> _call(BuildContext context, String number) async {
    final uri = Uri(scheme: 'tel', path: number);
    var ok = false;
    try {
      ok = await launchUrl(uri);
    } catch (_) {
      ok = false;
    }
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.wltCallFailed(number))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final number = phone;
    return AgSurfaceCard(
      key: const ValueKey('topup_operator_card'),
      padding: const EdgeInsets.all(kSpace5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.support_agent_rounded,
                    color: kPrimary, size: 28),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Text(
                  l10n.wltDisabledTitle,
                  style: const TextStyle(
                    fontSize: kFontH3,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace3),
          Text(
            l10n.wltDisabledBody,
            style: const TextStyle(
              fontSize: kFontBody,
              color: kInkMuted,
              height: 1.4,
            ),
          ),
          const SizedBox(height: kSpace4),
          if (number != null)
            AppButton(
              key: const ValueKey('topup_call_operator'),
              label: l10n.wltCallOperator(Formatters.formatPhone(number)),
              height: kControlHeightDriver,
              icon: const Icon(Icons.call_rounded, color: kOnPrimary),
              onPressed: () => _call(context, number),
            )
          else
            Text(
              l10n.wltNoSupportPhone,
              style: const TextStyle(
                fontSize: kFontBody,
                color: kWarningDeep,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }
}

(String, AppStatusTone) topupStatusDisplay(WalletTopupStatus status) {
  final l10n = AppL10n.current;
  return switch (status) {
    WalletTopupStatus.pending || WalletTopupStatus.unknown => (
        l10n.wltStatusPending,
        AppStatusTone.info
      ),
    WalletTopupStatus.paid => (l10n.wltStatusPaid, AppStatusTone.success),
    WalletTopupStatus.failed => (l10n.wltStatusFailed, AppStatusTone.danger),
    WalletTopupStatus.cancelled => (
        l10n.wltStatusCancelled,
        AppStatusTone.neutral
      ),
    WalletTopupStatus.expired => (l10n.wltStatusExpired, AppStatusTone.neutral),
  };
}

/// `GET /payments/wallet/topups` — oxirgi 20 ta.
class TopupHistorySection extends StatelessWidget {
  const TopupHistorySection({super.key, required this.topups, this.onContinue});

  final List<WalletTopup> topups;

  /// Ochiq (`pending`) Payme/Click to'ldirishini davom ettirish — server bir
  /// xil summa+provayder uchun o'sha to'ldirishni qaytaradi (§25 #13).
  /// `null` — tugma ko'rsatilmaydi.
  final ValueChanged<WalletTopup>? onContinue;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.wltHistory,
          style: const TextStyle(
            fontSize: kFontTitle,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace3),
        if (topups.isEmpty)
          AgSurfaceCard(
            padding: EdgeInsets.zero,
            child: AppEmptyState(
              icon: Icons.receipt_long_outlined,
              title: l10n.wltHistoryEmpty,
              compact: true,
            ),
          )
        else
          AgSurfaceCard(
            padding: const EdgeInsets.symmetric(vertical: kSpace1),
            child: Column(
              children: [
                for (final topup in topups)
                  _TopupRow(topup: topup, onContinue: onContinue),
              ],
            ),
          ),
      ],
    );
  }
}

class _TopupRow extends StatelessWidget {
  const _TopupRow({required this.topup, this.onContinue});

  final WalletTopup topup;
  final ValueChanged<WalletTopup>? onContinue;

  bool get _canContinue =>
      onContinue != null &&
      topup.status == WalletTopupStatus.pending &&
      WalletTopupProvider.values.any((p) => p.wireValue == topup.provider);

  @override
  Widget build(BuildContext context) {
    final (label, tone) = topupStatusDisplay(topup.status);
    final when = topup.paidAt ?? topup.createdAt;
    return Padding(
      key: ValueKey('topup_row_${topup.id}'),
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace3,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '+${Formatters.formatPrice(topup.amount)}',
                  style: const TextStyle(
                    fontSize: kFontBodyLg,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    topup.providerLabel,
                    if (when != null) Formatters.formatDateTime(when),
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: kFontCaption,
                    color: kInkMuted,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppStatusBadge(label: label, tone: tone, dense: true),
              if (_canContinue)
                TextButton(
                  key: ValueKey('topup_continue_${topup.id}'),
                  onPressed: () => onContinue!(topup),
                  child: Text(context.l10n.wltContinuePending),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
