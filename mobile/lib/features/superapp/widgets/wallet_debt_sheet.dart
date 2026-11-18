import 'dart:async';

import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/features/superapp/models/wallet_debt.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

Future<bool?> _defaultOpenCheckout(BuildContext context, PaymentInitiateResult result) =>
    Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(builder: (_) => PaymentWebViewScreen(result: result)),
    );

/// Testlar uchun almashtiriladigan bog'lanishlar.
class WalletDebtSheetDeps {
  static OpenPaymentCheckout openCheckout = _defaultOpenCheckout;
  static Future<bool> Function(Uri uri) dial = launchUrl;

  /// To'lovdan keyin server callback'ini kutish.
  static Duration pollInterval = const Duration(seconds: 2);
  static int pollAttempts = 8;
}

/// Qarz oynasi: qancha, nimadan va nima qilish kerak. Buyurtma qarz sababli
/// rad etilganda ham, hamyon ekranidan ham ochiladi.
Future<void> showWalletDebtSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: agSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
    ),
    builder: (_) => const WalletDebtSheet(),
  );
}

class WalletDebtSheet extends StatefulWidget {
  const WalletDebtSheet({super.key});

  @override
  State<WalletDebtSheet> createState() => _WalletDebtSheetState();
}

class _WalletDebtSheetState extends State<WalletDebtSheet> {
  WalletDebt? _debt;
  bool _loading = true;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final debt = await context.read<SuperappProvider>().loadWalletDebt();
    if (!mounted) return;
    setState(() {
      _debt = debt ?? _debt;
      _loading = false;
    });
  }

  Future<void> _run(Future<void> Function() work) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await work();
    } catch (error) {
      if (mounted) setState(() => _message = ApiError.from(error)?.message ?? context.l10n.saDebtFailed);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _settleFromWallet() => _run(() async {
        final debt = await context.read<SuperappProvider>().settleWalletDebt();
        if (mounted) setState(() => _debt = debt ?? _debt);
      });

  Future<void> _topUp(WalletDebt debt) => _run(() async {
        final superapp = context.read<SuperappProvider>();
        final checkout = await superapp.startDebtTopup(debt.topUpAmount);
        if (!mounted) return;
        await WalletDebtSheetDeps.openCheckout(context, checkout);
        if (!mounted) return;
        // Pul faqat provayder callback'idan keyin tushadi — "to'ladim" emas,
        // server javobi hal qiladi.
        for (var i = 0; i < WalletDebtSheetDeps.pollAttempts; i++) {
          final fresh = await superapp.loadWalletDebt();
          if (!mounted) return;
          if (fresh != null) setState(() => _debt = fresh);
          if (fresh != null && fresh.total < debt.total) return;
          await Future<void>.delayed(WalletDebtSheetDeps.pollInterval);
          if (!mounted) return;
        }
        setState(() => _message = context.l10n.saDebtPaymentPending);
      });

  Future<void> _callSupport(String phone) async {
    final failed = context.l10n.saCallFailedDialManually(phone);
    final messenger = ScaffoldMessenger.maybeOf(context);
    final ok = await WalletDebtSheetDeps.dial(Uri(scheme: 'tel', path: phone));
    if (!ok) messenger?.showSnackBar(SnackBar(content: Text(failed)));
  }

  @override
  Widget build(BuildContext context) {
    final debt = _debt;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(kSpace5, kSpace5, kSpace5, kSpace4),
        child: _loading
            ? const SizedBox(height: 160, child: Center(child: CircularProgressIndicator()))
            : debt == null
                ? _Failed(onRetry: _load)
                : debt.hasDebt
                    ? _body(context, debt)
                    : _Paid(onClose: () => Navigator.of(context).pop()),
      ),
    );
  }

  Widget _body(BuildContext context, WalletDebt debt) {
    final l10n = context.l10n;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.saDebtTitle, style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: agSubtle)),
        const SizedBox(height: kSpace1),
        Text(
          Formatters.formatPrice(debt.total),
          style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText),
        ),
        const SizedBox(height: kSpace2),
        Text(l10n.saDebtExplain, style: const TextStyle(fontSize: kFontBody, color: agSubtle, height: 1.4)),
        const SizedBox(height: kSpace3),
        for (final item in debt.items)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: kSpace1),
            child: Row(
              children: [
                Expanded(child: Text(item.reasonLabel, style: const TextStyle(fontSize: kFontBody, color: agText))),
                const SizedBox(width: kSpace3),
                Text(Formatters.formatPrice(item.amount), style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w700, color: agText)),
              ],
            ),
          ),
        const SizedBox(height: kSpace4),
        if (_message != null) ...[
          Text(_message!, style: const TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w600, color: agSubtle)),
          const SizedBox(height: kSpace3),
        ],
        if (debt.canSettleNow) ...[
          AgPrimaryButton(
            label: l10n.saDebtPayFromWallet,
            isLoading: _busy,
            onPressed: _busy ? null : _settleFromWallet,
          ),
          const SizedBox(height: kSpace2),
        ],
        if (debt.topUpAvailable && debt.topUpNeeded > 0) ...[
          AgPrimaryButton(
            label: l10n.saDebtTopUp(Formatters.formatPrice(debt.topUpAmount)),
            isLoading: _busy,
            onPressed: _busy ? null : () => _topUp(debt),
          ),
          const SizedBox(height: kSpace2),
          Text(l10n.saDebtTopUpHint, textAlign: TextAlign.center, style: const TextStyle(fontSize: kFontCaption, color: agSubtle)),
        ] else if (!debt.canSettleNow) ...[
          Text(l10n.saDebtContactHint, style: const TextStyle(fontSize: kFontBody, color: agText, height: 1.4)),
          const SizedBox(height: kSpace3),
        ],
        if (debt.supportPhone.isNotEmpty)
          TextButton.icon(
            onPressed: () => _callSupport(debt.supportPhone),
            icon: const Icon(Icons.call),
            label: Text(l10n.saDebtCallSupport(debt.supportPhone)),
          ),
      ],
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(context.l10n.saDebtLoadFailed, style: const TextStyle(fontSize: kFontBody, color: agText)),
          const SizedBox(height: kSpace3),
          TextButton(onPressed: onRetry, child: Text(context.l10n.commonRetry)),
        ],
      );
}

class _Paid extends StatelessWidget {
  const _Paid({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(context.l10n.saDebtPaid, style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w700, color: agText)),
          const SizedBox(height: kSpace4),
          AgPrimaryButton(label: context.l10n.saDebtClose, onPressed: onClose),
        ],
      );
}

/// Hamyon ekranidagi ogohlantirish.
class WalletDebtBanner extends StatelessWidget {
  const WalletDebtBanner({super.key, required this.debt, required this.onTap});

  final WalletDebt debt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: kWarningLight,
      borderRadius: BorderRadius.circular(kRadiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(kRadiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(kSpace4),
          child: Row(
            children: [
              const ExcludeSemantics(child: Icon(Icons.warning_amber_rounded, color: kWarningDeep)),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Text(
                  context.l10n.saDebtBanner(Formatters.formatPrice(debt.total)),
                  style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w700, color: agText),
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: agSubtle),
            ],
          ),
        ),
      ),
    );
  }
}
