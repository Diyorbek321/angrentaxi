import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/withdrawal_request.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';
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
          if (provider.state == DriverProviderState.loading &&
              provider.orderHistory.isEmpty) {
            return const LoadingWidget(message: 'Yuklanmoqda...');
          }

          if (provider.state == DriverProviderState.error &&
              provider.orderHistory.isEmpty) {
            return AppErrorWidget(
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
            color: kPrimaryYellow,
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
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Text(
                      "Pul yechish so'rovlari",
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ),
                ),
                if (provider.withdrawals.isEmpty)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        "Hozircha so'rovlar yo'q",
                        style: TextStyle(color: kTextSecondary, fontSize: 13),
                      ),
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
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Text(
                      'Buyurtmalar tarixi',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.grey.shade800,
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
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.history,
                              size: 64,
                              color: kTextSecondary,
                            ),
                            SizedBox(height: 12),
                            Text(
                              'Buyurtmalar tarixi yo\'q',
                              style: TextStyle(color: kTextSecondary),
                            ),
                          ],
                        ),
                      ),
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
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [kSecondaryBlack, Color(0xFF2D2D2D)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bugungi daromad',
            style: TextStyle(color: Colors.white60, fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            Formatters.formatPrice(provider.todayEarnings),
            style: const TextStyle(
              color: kPrimaryYellow,
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _EarningsStatChip(
                label: "Jami buyurtmalar",
                value: provider.orderHistory.length.toString(),
              ),
              const SizedBox(width: 12),
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
            const SizedBox(height: 12),
            Row(
              children: [
                _EarningsStatChip(
                  label: 'Balans',
                  value: Formatters.formatPrice(provider.driver!.balance),
                  valueColor: provider.driver!.balance < 0 ? kError : null,
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              key: const ValueKey('withdraw_button'),
              onPressed: () => _showWithdrawDialog(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: kPrimaryYellow,
                foregroundColor: kSecondaryBlack,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: const Text(
                'Pul yechish',
                style: TextStyle(fontWeight: FontWeight.bold),
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
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Daromad tafsiloti',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: Colors.grey.shade800,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _PeriodTab(
                key: const ValueKey('earnings_period_today'),
                label: 'Bugun',
                selected: _selectedPeriod == _EarningsPeriod.today,
                onTap: () =>
                    setState(() => _selectedPeriod = _EarningsPeriod.today),
              ),
              const SizedBox(width: 8),
              _PeriodTab(
                key: const ValueKey('earnings_period_week'),
                label: 'Hafta',
                selected: _selectedPeriod == _EarningsPeriod.week,
                onTap: () =>
                    setState(() => _selectedPeriod = _EarningsPeriod.week),
              ),
              const SizedBox(width: 8),
              _PeriodTab(
                key: const ValueKey('earnings_period_month'),
                label: 'Oy',
                selected: _selectedPeriod == _EarningsPeriod.month,
                onTap: () =>
                    setState(() => _selectedPeriod = _EarningsPeriod.month),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _BreakdownRow(
            label: 'Umumiy (gross)',
            value: Formatters.formatPrice(period.gross),
            valueKey: const ValueKey('earnings_gross_value'),
          ),
          _BreakdownRow(
            label: 'Komissiya',
            value: '- ${Formatters.formatPrice(period.commission)}',
            valueColor: kError,
            valueKey: const ValueKey('earnings_commission_value'),
          ),
          const Divider(height: 20),
          _BreakdownRow(
            label: 'Sof daromad',
            value: Formatters.formatPrice(period.net),
            bold: true,
            valueColor: kSuccess,
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
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.emoji_events_outlined,
                  color: kPrimaryYellow, size: 20),
              const SizedBox(width: 8),
              Text(
                'Bonus dasturi',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Colors.grey.shade800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
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
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      'Balans: ${Formatters.formatPrice(provider.driver!.balance)}',
                      style: const TextStyle(color: kTextSecondary),
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
                const SizedBox(height: 12),
                TextField(
                  key: const ValueKey('withdraw_destination_field'),
                  controller: _destinationController,
                  decoration: const InputDecoration(
                    labelText: 'Karta yoki telefon raqami',
                    hintText: '+998901234567',
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    error,
                    key: const ValueKey('withdraw_error_text'),
                    style: const TextStyle(color: kError, fontSize: 13),
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
(String, Color) _withdrawalStatusDisplay(WithdrawalStatus status) {
  switch (status) {
    case WithdrawalStatus.pending:
      return ('Kutilmoqda', kWarning);
    case WithdrawalStatus.approved:
      return ('Tasdiqlandi', kSuccess);
    case WithdrawalStatus.rejected:
      return ('Rad etildi', kError);
    case WithdrawalStatus.paid:
      return ("To'landi", kSuccess);
  }
}

class _WithdrawalCard extends StatelessWidget {
  const _WithdrawalCard({required this.withdrawal});

  final WithdrawalRequest withdrawal;

  @override
  Widget build(BuildContext context) {
    final (statusLabel, statusColor) =
        _withdrawalStatusDisplay(withdrawal.status);
    return Container(
      key: ValueKey('withdrawal_${withdrawal.id}'),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
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
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  withdrawal.payoutDestination,
                  style: const TextStyle(color: kTextSecondary, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  Formatters.formatRelativeDate(withdrawal.requestedAt),
                  style: const TextStyle(color: kTextSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withAlpha(20),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              statusLabel,
              style: TextStyle(
                color: statusColor,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(20),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                color: valueColor ?? Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            Text(
              label,
              style: const TextStyle(color: Colors.white60, fontSize: 11),
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
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: order.status == OrderStatus.completed
                  ? kSuccess.withAlpha(20)
                  : kError.withAlpha(20),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              order.status == OrderStatus.completed
                  ? Icons.check_circle_outline
                  : Icons.cancel_outlined,
              color: order.status == OrderStatus.completed ? kSuccess : kError,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.dropoff.address,
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  Formatters.formatRelativeDate(order.createdAt),
                  style: const TextStyle(color: kTextSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          if (order.status == OrderStatus.completed)
            Text(
              Formatters.formatPrice(order.actualPrice ?? order.estimatedPrice),
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: kSuccess,
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
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? kPrimaryYellow : kSurfaceGrey,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 13,
              color: selected ? kSecondaryBlack : kTextSecondary,
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
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(color: kTextSecondary, fontSize: 13),
          ),
          Text(
            value,
            key: valueKey,
            style: TextStyle(
              fontSize: bold ? 16 : 14,
              fontWeight: bold ? FontWeight.bold : FontWeight.w600,
              color: valueColor ?? kTextPrimary,
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
      padding: const EdgeInsets.symmetric(vertical: 8),
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
                    fontSize: 13,
                  ),
                ),
              ),
              Text(
                '+${Formatters.formatPrice(bonus.bonusAmount)}',
                style: const TextStyle(
                  color: kSuccess,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: bonus.progressFraction,
              minHeight: 8,
              backgroundColor: kSurfaceGrey,
              valueColor: AlwaysStoppedAnimation<Color>(
                isComplete ? kSuccess : kPrimaryYellow,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${bonus.currentCount}/${bonus.tripThreshold} safar',
            style: const TextStyle(color: kTextSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
