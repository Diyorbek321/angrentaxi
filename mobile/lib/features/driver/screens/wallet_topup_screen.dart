import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/features/driver/wallet/topup_amount.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/features/driver/widgets/wallet_topup_widgets.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/models/wallet_topup.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

enum _Phase { form, waiting, success, failed }

/// Standart: to'lov sahifasi ilova ichidagi WebView'da
/// (`PaymentWebViewScreen` — yo'lovchi checkout'idagi naqsh).
Future<bool?> _defaultOpenCheckout(
  BuildContext context,
  PaymentInitiateResult result,
) {
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => PaymentWebViewScreen(result: result)),
  );
}

/// HAMYONNI TO'LDIRISH — docs/LEGAL-COMPLIANCE.md §11.
///
/// Oqim: summa + provayder → `POST /payments/wallet/topup` → to'lov sahifasi
/// → tasdiqni KUTISH. Kirim faqat provayder callback'idan keyin tushadi,
/// shuning uchun "to'ladim" tugmasi hech narsani tasdiqlamaydi: ekran
/// `GET /payments/wallet/topup/:id` ni so'raydi va `wallet:updated`
/// hodisasini tinglaydi — qaysi biri birinchi kelsa.
class WalletTopupScreen extends StatefulWidget {
  const WalletTopupScreen({
    super.key,
    this.openCheckout = _defaultOpenCheckout,
    this.pollInterval = const Duration(seconds: 3),
    this.pollTimeout = const Duration(minutes: 3),
    this.topupId,
  });

  /// To'lov sahifasidan qaytish havolasi (`angrengo://wallet/topup/<id>`,
  /// §24): ekran forma o'rniga shu to'ldirish HOLATI bilan ochiladi va
  /// `GET /payments/wallet/topup/<id>` ni so'raydi. Qaytishning o'zi
  /// to'lovni tasdiqlamaydi.
  final String? topupId;

  final OpenPaymentCheckout openCheckout;
  final Duration pollInterval;
  final Duration pollTimeout;

  @override
  State<WalletTopupScreen> createState() => _WalletTopupScreenState();
}

class _WalletTopupScreenState extends State<WalletTopupScreen> {
  final _amountController = TextEditingController();
  WalletTopupProvider _provider = WalletTopupProvider.payme;
  String? _amountError;
  _Phase _phase = _Phase.form;
  WalletTopup? _topup;
  bool _timedOut = false;
  Timer? _pollTimer;
  DateTime? _pollStartedAt;
  StreamSubscription<WalletUpdate>? _walletSub;
  final _historyKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final wallet = context.read<DriverWalletProvider>();
      final driver = context.read<DriverProvider>();
      _walletSub = driver.walletUpdates.listen((update) {
        final topup = _topup;
        if (topup != null &&
            update.reason == 'topup' &&
            update.topupId == topup.id) {
          _onPaid(topup);
        }
      });
      driver.loadWalletBalance();
      wallet.loadTopups();
      final resumeId = widget.topupId;
      if (resumeId != null) unawaited(_resume(resumeId));
      await wallet.loadSettings();
      if (!mounted) return;
      final presets = wallet.settings.walletTopupPresets;
      if (_amountController.text.isEmpty && presets.isNotEmpty) {
        // O'rtadagi tayyor summa — eng ko'p tanlanadigani.
        _amountController.text =
            presets[presets.length ~/ 2].round().toString();
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _walletSub?.cancel();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final wallet = context.read<DriverWalletProvider>();
    final settings = wallet.settings;
    final error = TopupAmount.validate(
      _amountController.text,
      min: settings.walletTopupMin,
      max: settings.walletTopupMax,
    );
    setState(() {
      _amountError = error == null
          ? null
          : TopupAmount.message(
              error,
              min: settings.walletTopupMin,
              max: settings.walletTopupMax,
            );
    });
    if (error != null) return;

    final topup = await wallet.createTopup(
      amount: TopupAmount.parse(_amountController.text)!,
      provider: _provider,
    );
    if (!mounted || topup == null) return;
    setState(() {
      _topup = topup;
      _phase = _Phase.waiting;
      _timedOut = false;
    });
    _startPolling();
    await _openCheckout();
  }

  /// `WALLET_TOPUP_TOO_MANY_PENDING` dan keyin — ochiq to'lovlar ro'yxatiga.
  void _showPendingTopups() {
    final target = _historyKey.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  /// Ochiq to'ldirishni davom ettirish: o'sha summa+provayder qayta
  /// yuboriladi — server yangi yaratmaydi, mavjud `topupId` va to'lov
  /// sahifasini qaytaradi (§25 #13).
  Future<void> _continueTopup(WalletTopup topup) async {
    final provider = WalletTopupProvider.values
        .where((p) => p.wireValue == topup.provider)
        .firstOrNull;
    if (provider == null) return;
    setState(() {
      _amountController.text = topup.amount.round().toString();
      _provider = provider;
      _amountError = null;
    });
    await _submit();
  }

  /// Qaytish havolasi bo'yicha: kutish holatida darhol so'raydi va
  /// (pending bo'lsa) odatdagi so'rov sikliga o'tadi.
  Future<void> _resume(String id) async {
    final wallet = context.read<DriverWalletProvider>();
    final known = wallet.topups.where((t) => t.id == id).firstOrNull;
    setState(() {
      _topup = known ??
          WalletTopup(
            id: id,
            amount: 0,
            provider: '',
            status: WalletTopupStatus.pending,
          );
      _phase = _Phase.waiting;
      _timedOut = false;
    });
    _startPolling();
    final fresh = await wallet.refreshTopup(id);
    if (!mounted || fresh == null || _phase != _Phase.waiting) return;
    // `refreshTopup` ro'yxatdagi yozuvni checkoutUrl'ni saqlagan holda
    // yangilaydi — "to'lov sahifasini qayta ochish" uchun o'shani olamiz.
    setState(() {
      _topup = wallet.topups.where((t) => t.id == id).firstOrNull ?? fresh;
    });
    if (fresh.status == WalletTopupStatus.paid) {
      _onPaid(fresh);
    } else if (fresh.status.isFinal) {
      _pollTimer?.cancel();
      setState(() => _phase = _Phase.failed);
    }
  }

  Future<void> _openCheckout() async {
    final topup = _topup;
    final url = topup?.checkoutUrl;
    if (topup == null || url == null) return;
    await widget.openCheckout(
      context,
      PaymentInitiateResult(url: url, id: topup.id, provider: topup.provider),
    );
    // Qaytgan zahoti bir marta so'raymiz — callback odatda shu paytgacha
    // kelgan bo'ladi.
    if (mounted && _phase == _Phase.waiting) unawaited(_poll());
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollStartedAt = DateTime.now();
    _pollTimer = Timer.periodic(widget.pollInterval, (_) => _poll());
  }

  Future<void> _poll() async {
    final topup = _topup;
    if (topup == null || _phase != _Phase.waiting) return;
    final started = _pollStartedAt;
    if (started != null &&
        DateTime.now().difference(started) > widget.pollTimeout) {
      _pollTimer?.cancel();
      if (mounted) setState(() => _timedOut = true);
      return;
    }
    final fresh =
        await context.read<DriverWalletProvider>().refreshTopup(topup.id);
    if (!mounted || fresh == null || _phase != _Phase.waiting) return;
    if (fresh.status == WalletTopupStatus.paid) {
      _onPaid(fresh);
    } else if (fresh.status.isFinal) {
      _pollTimer?.cancel();
      setState(() => _phase = _Phase.failed);
    }
  }

  void _onPaid(WalletTopup topup) {
    if (_phase == _Phase.success) return;
    _pollTimer?.cancel();
    context.read<DriverWalletProvider>().markTopupPaid(topup.id);
    context.read<DriverProvider>().loadWalletBalance();
    HapticFeedback.mediumImpact();
    setState(() => _phase = _Phase.success);
  }

  void _restart() {
    _pollTimer?.cancel();
    setState(() {
      _phase = _Phase.form;
      _topup = null;
      _timedOut = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final wallet = context.watch<DriverWalletProvider>();
    final balance = context.watch<DriverProvider>().walletBalance;

    return Scaffold(
      backgroundColor: kSurface2,
      appBar: AppBar(title: Text(l10n.wltTopUpTitle)),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(kSpace4),
          children: [
            WalletBalanceTile(balance: balance),
            const SizedBox(height: kSpace4),
            if (!wallet.settingsLoaded)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(kSpace6),
                  child: CircularProgressIndicator(color: kPrimary),
                ),
              )
            else if (!wallet.settings.walletTopupEnabled)
              OperatorTopupCard(phone: wallet.settings.supportPhone)
            else
              _buildPhase(context, wallet, balance),
            const SizedBox(height: kSpace6),
            TopupHistorySection(
              key: _historyKey,
              topups: wallet.topups,
              onContinue: _phase == _Phase.form ? _continueTopup : null,
            ),
            const SizedBox(height: kSpace6),
          ],
        ),
      ),
    );
  }

  Widget _buildPhase(
    BuildContext context,
    DriverWalletProvider wallet,
    double? balance,
  ) {
    final l10n = context.l10n;
    final amount = _topup?.amount ?? 0;
    switch (_phase) {
      case _Phase.form:
        return _buildForm(context, wallet);
      case _Phase.waiting:
        return TopupStatusPanel(
          key: const ValueKey('topup_waiting'),
          tone: TopupPanelTone.waiting,
          title: l10n.wltWaitingTitle,
          body: _timedOut ? l10n.wltStillPending : l10n.wltWaitingBody,
          primaryLabel: l10n.wltOpenCheckoutAgain,
          onPrimary: _openCheckout,
          secondaryLabel: _timedOut ? l10n.wltDone : null,
          onSecondary:
              _timedOut ? () => Navigator.of(context).maybePop() : null,
        );
      case _Phase.success:
        return TopupStatusPanel(
          key: const ValueKey('topup_success'),
          tone: TopupPanelTone.success,
          title: l10n.wltSuccessTitle,
          body: l10n.wltSuccessBody(Formatters.formatPrice(amount)),
          detail: balance == null
              ? null
              : l10n.wltNewBalance(Formatters.formatPrice(balance)),
          primaryLabel: l10n.wltDone,
          onPrimary: () => Navigator.of(context).maybePop(),
        );
      case _Phase.failed:
        return TopupStatusPanel(
          key: const ValueKey('topup_failed'),
          tone: TopupPanelTone.failed,
          title: l10n.wltFailedTitle,
          body: l10n.wltFailedBody,
          primaryLabel: l10n.wltTryAgain,
          onPrimary: _restart,
        );
    }
  }

  Widget _buildForm(BuildContext context, DriverWalletProvider wallet) {
    final l10n = context.l10n;
    final settings = wallet.settings;
    final selected = TopupAmount.parse(_amountController.text);
    final serverError = wallet.topupError;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.wltAmount,
          style: const TextStyle(
            fontSize: kFontTitle,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace3),
        TopupPresetRow(
          presets: settings.walletTopupPresets,
          selected: selected,
          onSelected: (value) => setState(() {
            _amountController.text = value.round().toString();
            _amountError = null;
          }),
        ),
        const SizedBox(height: kSpace3),
        TextField(
          key: const ValueKey('topup_amount_field'),
          controller: _amountController,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: const TextStyle(
            fontSize: kFontH2,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
          onChanged: (_) => setState(() => _amountError = null),
          decoration: InputDecoration(
            hintText: l10n.wltAmountHint,
            suffixText: l10n.saSom,
            helperText: l10n.wltAmountRange(
              Formatters.formatPrice(settings.walletTopupMin),
              Formatters.formatPrice(settings.walletTopupMax),
            ),
            errorText: _amountError,
          ),
        ),
        const SizedBox(height: kSpace5),
        Text(
          l10n.wltProvider,
          style: const TextStyle(
            fontSize: kFontTitle,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace3),
        TopupProviderPicker(
          selected: _provider,
          onSelected: (p) => setState(() => _provider = p),
        ),
        if (serverError != null) ...[
          const SizedBox(height: kSpace3),
          Text(
            serverError,
            key: const ValueKey('topup_server_error'),
            style: const TextStyle(
              color: kErrorDeep,
              fontSize: kFontLabel,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (wallet.tooManyPendingTopups)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                key: const ValueKey('topup_show_pending'),
                onPressed: _showPendingTopups,
                icon: const Icon(Icons.receipt_long_outlined),
                label: Text(l10n.wltShowPending),
              ),
            ),
        ],
        const SizedBox(height: kSpace5),
        AppButton(
          key: const ValueKey('topup_pay_button'),
          label: l10n.wltPay(
            Formatters.formatPrice((selected ?? 0).toDouble()),
          ),
          height: kControlHeightDriver,
          isLoading: wallet.isCreatingTopup,
          onPressed: wallet.isCreatingTopup ? null : _submit,
        ),
      ],
    );
  }
}
