import 'package:angren_taxi/features/superapp/models/wallet_transaction.dart';
import 'package:angren_taxi/features/superapp/screens/topup_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  @override
  void initState() {
    super.initState();
    // Always re-read on open: the balance may have moved since the home tab
    // last fetched it (an order was paid, a withdrawal cleared, ...).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final superapp = context.read<SuperappProvider>();
      superapp.loadWalletBalance();
      superapp.loadTransactions();
    });
  }

  @override
  Widget build(BuildContext context) {
    final superapp = context.watch<SuperappProvider>();
    final balance = superapp.walletBalance;
    final walletError = superapp.walletError;
    final transactions = superapp.transactions;
    final loadingTxns = superapp.isTransactionsLoading && transactions.isEmpty;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Hamyon', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                kSpace4,
                kSpace5,
                kSpace4,
                kSpace6,
              ),
              children: [
                _BalanceCard(
                  balance: balance,
                  onTopUp: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const TopUpScreen()),
                  ),
                ),
                if (balance == null && walletError != null) ...[
                  const SizedBox(height: kSpace3),
                  // Matn o'zgarmaydi — faqat umumiy `InlineErrorWidget`
                  // ko'rinishiga (kErrorDeep matn, 6.47:1) o'tkazildi.
                  InlineErrorWidget(
                    message: walletError,
                    onRetry: () => superapp.loadWalletBalance(),
                  ),
                ],
                const SizedBox(height: kSpace6),
                const AgSectionTitle('Kartalar'),
                const SizedBox(height: kSpace3),
                // Saved cards need a Payme/Click merchant agreement before a
                // card can be bound and charged. Until then the screen says so
                // plainly instead of showing two invented cards ("Uzcard 8600
                // •••• 4421") that belonged to nobody and could not be used.
                const _CardsUnavailableNotice(),
                const SizedBox(height: kSpace6),
                const AgSectionTitle('So\'nggi amallar'),
                const SizedBox(height: kSpace3),
                if (loadingTxns)
                  const AppSkeletonList(
                    itemCount: 3,
                    hasTrailing: true,
                    padding: EdgeInsets.zero,
                  )
                else if (superapp.transactionsError != null && transactions.isEmpty)
                  InlineErrorWidget(
                    message: superapp.transactionsError!,
                    onRetry: () => superapp.loadTransactions(),
                  )
                else if (transactions.isEmpty)
                  const _NoTransactions()
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                    decoration: BoxDecoration(
                      color: agSurface,
                      borderRadius: BorderRadius.circular(kRadiusLg),
                      boxShadow: agCardShadow,
                    ),
                    child: Column(
                      children: [
                        for (var i = 0; i < transactions.length; i++)
                          _TxnRow(
                            txn: transactions[i],
                            last: i == transactions.length - 1,
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance, required this.onTopUp});

  /// `null` while loading or after a failed load — shown as a placeholder so
  /// the passenger is never given a fabricated figure.
  final double? balance;
  final VoidCallback onTopUp;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: kGradientInkColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(kRadiusXl),
        boxShadow: agInkShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Angren Go balans',
            style: TextStyle(
              color: agOnPrimary.withValues(alpha: 0.75),
              fontSize: kFontLabel,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: kSpace1 + 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(balance == null ? '—' : Formatters.formatAmount(balance!),
                  style: const TextStyle(color: agOnPrimary, fontSize: kFontDisplay, fontWeight: FontWeight.w800, letterSpacing: -1)),
              const SizedBox(width: kSpace1 + 2),
              Text(
                "so'm",
                style: TextStyle(
                  color: agOnPrimary.withValues(alpha: 0.8),
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace5),
          Row(
            children: [
              Expanded(
                child: Semantics(
                  button: true,
                  label: "To'ldirish",
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: onTopUp,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: kMinTapTarget,
                        minWidth: kMinTapTarget,
                      ),
                      height: kControlHeightSm,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: agBright,
                        borderRadius: BorderRadius.circular(kRadiusSm),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          ExcludeSemantics(
                            child: Icon(Icons.add_rounded, color: agOnMint, size: 19),
                          ),
                          SizedBox(width: kSpace2),
                          Text("To'ldirish", style: TextStyle(color: agOnMint, fontSize: kFontLabel, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: kMinTapTarget,
                    minWidth: kMinTapTarget,
                  ),
                  height: kControlHeightSm,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: agOnPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.north_east_rounded, color: agOnPrimary, size: 19),
                      ),
                      SizedBox(width: kSpace2),
                      Text("O'tkazish", style: TextStyle(color: agOnPrimary, fontSize: kFontLabel, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardsUnavailableNotice extends StatelessWidget {
  const _CardsUnavailableNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: agBg,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: const Icon(
                Icons.credit_card_off_rounded,
                size: 21,
                color: agSubtle,
              ),
            ),
          ),
          const SizedBox(width: kSpace3),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Karta bog\'lash hali mavjud emas',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontBody,
                    color: agText,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Hozircha safarlarni naqd pul yoki hamyon balansi bilan to\'lang.',
                  style: TextStyle(
                    fontSize: kFontCaption,
                    color: agSubtle,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NoTransactions extends StatelessWidget {
  const _NoTransactions();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: kSpace6,
        horizontal: kSpace4,
      ),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: agCardShadow,
      ),
      child: const Column(
        children: [
          ExcludeSemantics(
            child: Icon(Icons.receipt_long_rounded, size: 34, color: agSubtle),
          ),
          SizedBox(height: kSpace2),
          Text(
            'Hozircha amallar yo\'q',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: kFontBody,
              color: agText,
            ),
          ),
          SizedBox(height: 2),
          Text(
            'Birinchi safar yoki to\'ldirishdan keyin bu yerda ko\'rinadi.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: kFontCaption,
              color: agSubtle,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _TxnRow extends StatelessWidget {
  const _TxnRow({required this.txn, this.last = false});

  final WalletTransaction txn;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final icon = txn.isCredit
        ? Icons.add_rounded
        : (txn.orderId != null
              ? Icons.local_taxi_rounded
              : Icons.north_east_rounded);

    // A pending row has not moved the balance yet, so it must not be coloured
    // like settled money.
    final amountColor = txn.isPending
        ? agSubtle
        : (txn.isCredit ? agGreenText : agText);

    final sign = txn.isCredit ? '+' : '−';
    final subtitle = txn.isPending
        ? '${Formatters.formatDateTime(txn.createdAt)} · kutilmoqda'
        : Formatters.formatDateTime(txn.createdAt);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: kSpace3),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: agBg,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Icon(
                icon,
                size: 21,
                color: txn.isCredit && !txn.isPending ? agGreenText : agSubtle,
              ),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  txn.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontBody,
                    color: agText,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: kFontCaption,
                    color: agSubtle,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$sign${Formatters.formatAmount(txn.amount)}',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: kFontBody,
              color: amountColor,
            ),
          ),
        ],
      ),
    );
  }
}
