import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/withdrawal_request.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// Which rolling window of GET /orders/earnings/breakdown is currently shown
// in the segmented control on the earnings screen.
enum _EarningsPeriod { today, week, month }

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  _EarningsPeriod _selectedPeriod = _EarningsPeriod.today;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<DriverProvider>();
      provider.loadEarnings();
      provider.loadOrderHistory();
      provider.loadProfile();
      provider.loadWithdrawals();
      provider.loadEarningsBreakdown();
      provider.loadBonusProgress();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Daromad')),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          // Uch holat: yuklanmoqda → SKELETON (spinner emas),
          // xato → AppErrorState, bo'sh ro'yxatlar → AppEmptyState.
          if (provider.state == DriverProviderState.loading &&
              provider.orderHistory.isEmpty) {
            return const SingleChildScrollView(
              child: AppSkeletonGroup(
                child: Column(
                  children: [
                    Padding(
                      padding: EdgeInsets.all(kSpace4),
                      child: AppSkeleton(
                        width: double.infinity,
                        height: 180,
                        radius: kRadiusLg,
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
                      child: AppSkeleton(
                        width: double.infinity,
                        height: 140,
                        radius: kRadiusMd,
                      ),
                    ),
                    AppSkeletonTile(hasTrailing: true),
                    SizedBox(height: kSpace3),
                    AppSkeletonTile(hasTrailing: true),
                    SizedBox(height: kSpace3),
                    AppSkeletonTile(hasTrailing: true),
                  ],
                ),
              ),
            );
          }

          if (provider.state == DriverProviderState.error &&
              provider.orderHistory.isEmpty) {
            return AppErrorState(
              message: provider.error ?? 'Xatolik yuz berdi',
              onRetry: () {
                provider.loadEarnings();
                provider.loadOrderHistory();
              },
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              await provider.loadEarnings();
              await provider.loadOrderHistory();
              await provider.loadEarningsBreakdown();
              await provider.loadBonusProgress();
            },
            color: kPrimary,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _buildEarningsSummary(context, provider),
                ),
                SliverToBoxAdapter(
                  child: _buildBreakdownSection(context, provider),
                ),
                if (provider.bonusProgress.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _buildBonusSection(context, provider),
                  ),
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      kSpace4,
                      kSpace4,
                      kSpace4,
                      kSpace2,
                    ),
                    child: Text(
                      "Pul yechish so'rovlari",
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: kFontTitle,
                        color: kInk,
                      ),
                    ),
                  ),
                ),
                if (provider.withdrawals.isEmpty)
                  const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.request_quote_outlined,
                      title: "Hozircha so'rovlar yo'q",
                      compact: true,
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _WithdrawalCard(
                        withdrawal: provider.withdrawals[index],
                      ),
                      childCount: provider.withdrawals.length,
                    ),
                  ),
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      kSpace4,
                      kSpace4,
                      kSpace4,
                      kSpace2,
                    ),
                    child: Text(
                      'Buyurtmalar tarixi',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: kFontTitle,
                        color: kInk,
                      ),
                    ),
                  ),
                ),
                if (provider.orderHistory.isEmpty)
                  // A plain padded box rather than SliverFillRemaining: the
                  // withdrawal-requests section above this one means the
                  // remaining viewport space can be smaller than this
                  // content's intrinsic height, and SliverFillRemaining
                  // forces its child into exactly that (possibly too small)
                  // space, overflowing instead of just taking what it needs.
                  const SliverToBoxAdapter(
                    child: AppEmptyState(
                      icon: Icons.history,
                      title: 'Buyurtmalar tarixi yo\'q',
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _DriverOrderCard(
                        order: provider.orderHistory[index],
                      ),
                      childCount: provider.orderHistory.length,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildEarningsSummary(BuildContext context, DriverProvider provider) {
    return Container(
      margin: const EdgeInsets.all(kSpace4),
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: kGradientInk,
        borderRadius: BorderRadius.circular(kRadiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bugungi daromad',
            style: TextStyle(
              color: kOnPrimary.withValues(alpha: 0.78),
              fontSize: kFontLabel,
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            Formatters.formatPrice(provider.todayEarnings),
            style: const TextStyle(
              // Mint qorong'i yuzada ishlaydi (kInk gradienti ustida).
              color: kMint,
              fontSize: kFontDisplay,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: kSpace5),
          Row(
            children: [
              _EarningsStatChip(
                label: "Jami buyurtmalar",
                value: provider.orderHistory.length.toString(),
              ),
              const SizedBox(width: kSpace3),
              _EarningsStatChip(
                label: 'Yakunlangan',
                value: provider.orderHistory
                    .where((o) => o.status == OrderStatus.completed)
                    .length
                    .toString(),
              ),
            ],
          ),
          if (provider.driver != null) ...[
            const SizedBox(height: kSpace3),
            Row(
              children: [
                _EarningsStatChip(
                  label: 'Balans',
                  value: Formatters.formatPrice(provider.driver!.balance),
                  // Qorong'i yuzada xato rangi — kErrorDark.
                  valueColor:
                      provider.driver!.balance < 0 ? kErrorDark : null,
                ),
              ],
            ),
          ],
          const SizedBox(height: kSpace4),
          SizedBox(
            width: double.infinity,
            height: kControlHeight,
            child: ElevatedButton.icon(
              key: const ValueKey('withdraw_button'),
              onPressed: () => _showWithdrawDialog(context),
              style: ElevatedButton.styleFrom(
                // Tugmaga mint QO'YILMAYDI; qorong'i yuzada interaktiv
                // to'ldirish uchun kPrimaryOnDark + oq matn (4.50:1).
                backgroundColor: kPrimaryOnDark,
                foregroundColor: kOnPrimary,
                padding: const EdgeInsets.symmetric(vertical: kSpace3),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
              ),
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: const Text(
                'Pul yechish',
                style: TextStyle(
                  fontSize: kFontTitle,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Segmented control (Bugun / Hafta / Oy) + gross/commission/net/trips
  // figures for the selected period, from GET /orders/earnings/breakdown.
  Widget _buildBreakdownSection(BuildContext context, DriverProvider provider) {
    final breakdown = provider.earningsBreakdown;
    final period = switch (_selectedPeriod) {
      _EarningsPeriod.today => breakdown.today,
      _EarningsPeriod.week => breakdown.week,
      _EarningsPeriod.month => breakdown.month,
    };

    return Container(
      margin: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
        boxShadow: kShadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Daromad tafsiloti',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: kFontTitle,
              color: kInk,
            ),
          ),
          const SizedBox(height: kSpace3),
          Row(
            children: [
              _PeriodTab(
                key: const ValueKey('earnings_period_today'),
                label: 'Bugun',
                selected: _selectedPeriod == _EarningsPeriod.today,
                onTap: () =>
                    setState(() => _selectedPeriod = _EarningsPeriod.today),
              ),
              const SizedBox(width: kSpace2),
              _PeriodTab(
                key: const ValueKey('earnings_period_week'),
                label: 'Hafta',
                selected: _selectedPeriod == _EarningsPeriod.week,
                onTap: () =>
                    setState(() => _selectedPeriod = _EarningsPeriod.week),
              ),
              const SizedBox(width: kSpace2),
              _PeriodTab(
                key: const ValueKey('earnings_period_month'),
                label: 'Oy',
                selected: _selectedPeriod == _EarningsPeriod.month,
                onTap: () =>
                    setState(() => _selectedPeriod = _EarningsPeriod.month),
              ),
            ],
          ),
          const SizedBox(height: kSpace4),
          _BreakdownRow(
            label: 'Umumiy (gross)',
            value: Formatters.formatPrice(period.gross),
            valueKey: const ValueKey('earnings_gross_value'),
          ),
          _BreakdownRow(
            label: 'Komissiya',
            value: '- ${Formatters.formatPrice(period.commission)}',
            // Xato/kamayish MATNI — kErrorDeep (6.47:1), kError 3.91:1.
            valueColor: kErrorDeep,
            valueKey: const ValueKey('earnings_commission_value'),
          ),
          const Divider(height: kSpace5),
          _BreakdownRow(
            label: 'Sof daromad',
            value: Formatters.formatPrice(period.net),
            bold: true,
            // Oq fonda muvaffaqiyat MATNI — kPrimary (mint 2.12:1).
            valueColor: kPrimary,
            valueKey: const ValueKey('earnings_net_value'),
          ),
          _BreakdownRow(
            label: 'Safarlar soni',
            value: period.trips.toString(),
            valueKey: const ValueKey('earnings_trips_value'),
          ),
        ],
      ),
    );
  }

  // Progress toward each active bonus rule, from
  // GET /driver-bonus-rules/me/progress.
  Widget _buildBonusSection(BuildContext context, DriverProvider provider) {
    return Container(
      margin: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
        boxShadow: kShadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              ExcludeSemantics(
                child: Icon(Icons.emoji_events_outlined,
                    color: kPrimary, size: 20),
              ),
              SizedBox(width: kSpace2),
              Text(
                'Bonus dasturi',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontTitle,
                  color: kInk,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace3),
          for (final bonus in provider.bonusProgress)
            _BonusProgressTile(bonus: bonus),
        ],
      ),
    );
  }

  Future<void> _showWithdrawDialog(BuildContext context) async {
    final provider = context.read<DriverProvider>();
    provider.clearWithdrawalError();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ChangeNotifierProvider<DriverProvider>.value(
        value: provider,
        child: const _WithdrawDialog(),
      ),
    );
  }
}

// Dialog for filing a withdrawal (payout) request: amount + destination
// (card or phone number). Validates the amount against the driver's current
// wallet balance client-side before ever calling the API — the backend also
// enforces this (400 if amount > balance) but surfacing it immediately here
// avoids a pointless round trip for the common mistake of over-requesting.
class _WithdrawDialog extends StatefulWidget {
  const _WithdrawDialog();

  @override
  State<_WithdrawDialog> createState() => _WithdrawDialogState();
}

class _WithdrawDialogState extends State<_WithdrawDialog> {
  final _amountController = TextEditingController();
  final _destinationController = TextEditingController();
  String? _validationError;

  @override
  void dispose() {
    _amountController.dispose();
    _destinationController.dispose();
    super.dispose();
  }

  Future<void> _submit(DriverProvider provider) async {
    final balance = provider.driver?.balance ?? 0;
    final rawAmount = _amountController.text.trim().replaceAll(',', '.');
    final amount = double.tryParse(rawAmount);
    final destination = _destinationController.text.trim();

    if (amount == null || amount <= 0) {
      setState(() => _validationError = "To'g'ri summa kiriting");
      return;
    }
    if (destination.length < 3) {
      setState(
        () => _validationError = "Karta yoki telefon raqamini kiriting",
      );
      return;
    }
    if (amount > balance) {
      setState(
        () => _validationError =
            "Summa balansdan oshib ketdi. Balans: ${Formatters.formatPrice(balance)}",
      );
      return;
    }

    setState(() => _validationError = null);

    final success = await provider.requestWithdrawal(
      amount: amount,
      payoutDestination: destination,
    );

    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DriverProvider>(
      builder: (context, provider, _) {
        final error = _validationError ?? provider.withdrawalError;
        return AlertDialog(
          title: const Text('Pul yechish'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (provider.driver != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: kSpace3),
                    child: Text(
                      'Balans: ${Formatters.formatPrice(provider.driver!.balance)}',
                      style: const TextStyle(
                        color: kInkMuted,
                        fontSize: kFontBody,
                      ),
                    ),
                  ),
                TextField(
                  key: const ValueKey('withdraw_amount_field'),
                  controller: _amountController,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Summa',
                    hintText: 'Masalan: 60000',
                  ),
                ),
                const SizedBox(height: kSpace3),
                TextField(
                  key: const ValueKey('withdraw_destination_field'),
                  controller: _destinationController,
                  decoration: const InputDecoration(
                    labelText: 'Karta yoki telefon raqami',
                    hintText: '+998901234567',
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: kSpace3),
                  Text(
                    error,
                    key: const ValueKey('withdraw_error_text'),
                    // Xato MATNI — kErrorDeep (6.47:1).
                    style: const TextStyle(
                      color: kErrorDeep,
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: provider.isSubmittingWithdrawal
                  ? null
                  : () => Navigator.of(context).pop(),
              child: const Text('Bekor qilish'),
            ),
            ElevatedButton(
              key: const ValueKey('withdraw_submit_button'),
              onPressed: provider.isSubmittingWithdrawal
                  ? null
                  : () => _submit(provider),
              child: provider.isSubmittingWithdrawal
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Yuborish'),
            ),
          ],
        );
      },
    );
  }
}

// Maps a withdrawal request's status to its localized label and color for
// display on the earnings screen's withdrawal-history list.
// `AppStatusTone` ikonka + matn + rang uchtasini birga beradi — holat hech
// qachon faqat rang bilan berilmaydi (WCAG 1.4.1).
(String, AppStatusTone) _withdrawalStatusDisplay(WithdrawalStatus status) {
  switch (status) {
    case WithdrawalStatus.pending:
      return ('Kutilmoqda', AppStatusTone.warning);
    case WithdrawalStatus.approved:
      return ('Tasdiqlandi', AppStatusTone.success);
    case WithdrawalStatus.rejected:
      return ('Rad etildi', AppStatusTone.danger);
    case WithdrawalStatus.paid:
      return ("To'landi", AppStatusTone.success);
  }
}

class _WithdrawalCard extends StatelessWidget {
  const _WithdrawalCard({required this.withdrawal});

  final WithdrawalRequest withdrawal;

  @override
  Widget build(BuildContext context) {
    final (statusLabel, statusTone) =
        _withdrawalStatusDisplay(withdrawal.status);
    return Container(
      key: ValueKey('withdrawal_${withdrawal.id}'),
      margin: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace1 + 2,
      ),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
        boxShadow: kShadowCard,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  Formatters.formatPrice(withdrawal.amount),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontBody,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  withdrawal.payoutDestination,
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontMicro,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  Formatters.formatRelativeDate(withdrawal.requestedAt),
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontMicro,
                  ),
                ),
              ],
            ),
          ),
          AppStatusBadge(label: statusLabel, tone: statusTone),
        ],
      ),
    );
  }
}

class _EarningsStatChip extends StatelessWidget {
  const _EarningsStatChip({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace3,
          vertical: kSpace2,
        ),
        decoration: BoxDecoration(
          color: kOnPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(kRadiusSm),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                color: valueColor ?? kOnPrimary,
                fontWeight: FontWeight.w800,
                fontSize: kFontH2,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                color: kOnPrimary.withValues(alpha: 0.78),
                fontSize: kFontMicro,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverOrderCard extends StatelessWidget {
  const _DriverOrderCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace1 + 2,
      ),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
        boxShadow: kShadowCard,
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: order.status == OrderStatus.completed
                    ? kMintTint
                    : kErrorLight,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Icon(
                order.status == OrderStatus.completed
                    ? Icons.check_circle_outline
                    : Icons.cancel_outlined,
                // Tint yuzada ikona kPrimary/kErrorDeep — mint 2.12:1.
                color: order.status == OrderStatus.completed
                    ? kPrimary
                    : kErrorDeep,
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.dropoff.address,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: kFontLabel,
                    color: kInk,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  Formatters.formatRelativeDate(order.createdAt),
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontMicro,
                  ),
                ),
              ],
            ),
          ),
          if (order.status == OrderStatus.completed)
            Text(
              Formatters.formatPrice(order.actualPrice ?? order.estimatedPrice),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: kFontBody,
                color: kPrimary,
              ),
            ),
        ],
      ),
    );
  }
}

// One tab of the Bugun/Hafta/Oy segmented control on the earnings breakdown
// card.
class _PeriodTab extends StatelessWidget {
  const _PeriodTab({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: AnimatedContainer(
            duration: kDurationFast,
            constraints: const BoxConstraints(minHeight: kMinTapTarget),
            padding: const EdgeInsets.symmetric(vertical: kSpace3),
            decoration: BoxDecoration(
              // Faol toggle = kPrimary + OQ matn; mint fon ustidagi
              // matn yorug' fonda ma'no tashiy olmasdi.
              color: selected ? kPrimary : kSurface2,
              borderRadius: BorderRadius.circular(kRadiusSm),
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: kFontLabel,
                color: selected ? kOnPrimary : kInkMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// A "label ......... value" row inside the earnings breakdown card.
class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow({
    required this.label,
    required this.value,
    this.valueColor,
    this.bold = false,
    this.valueKey,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;
  final Key? valueKey;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: kSpace1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
          ),
          Text(
            value,
            key: valueKey,
            style: TextStyle(
              fontSize: bold ? kFontTitle : kFontBody,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w700,
              color: valueColor ?? kInk,
            ),
          ),
        ],
      ),
    );
  }
}

// A single bonus rule's progress bar + reward amount on the earnings
// screen's bonus section.
class _BonusProgressTile extends StatelessWidget {
  const _BonusProgressTile({required this.bonus});

  final DriverBonusProgress bonus;

  @override
  Widget build(BuildContext context) {
    final isComplete = bonus.currentCount >= bonus.tripThreshold;
    return Padding(
      key: ValueKey('bonus_progress_${bonus.ruleId}'),
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  bonus.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: kFontLabel,
                    color: kInk,
                  ),
                ),
              ),
              Text(
                '+${Formatters.formatPrice(bonus.bonusAmount)}',
                style: const TextStyle(
                  // Oq fonda muvaffaqiyat MATNI — kPrimary.
                  color: kPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: kFontLabel,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace1 + 2),
          ClipRRect(
            borderRadius: BorderRadius.circular(kRadiusXs),
            child: LinearProgressIndicator(
              value: bonus.progressFraction,
              minHeight: 8,
              backgroundColor: kSurface2,
              // Progress = interaktiv qatlam; tugallanganda to'qroq.
              valueColor: AlwaysStoppedAnimation<Color>(
                isComplete ? kPrimaryPressed : kPrimary,
              ),
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            '${bonus.currentCount}/${bonus.tripThreshold} safar',
            style: const TextStyle(color: kInkMuted, fontSize: kFontMicro),
          ),
        ],
      ),
    );
  }
}
