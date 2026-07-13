import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/withdrawal_request.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<DriverProvider>();
      provider.loadEarnings();
      provider.loadOrderHistory();
      provider.loadProfile();
      provider.loadWithdrawals();
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
            },
            color: kPrimaryYellow,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _buildEarningsSummary(context, provider),
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
