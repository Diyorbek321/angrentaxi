import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// "To'lov kutilmoqda" bloki — kartali ovqat/market buyurtmasining to'lovi
/// hali tushmagan (docs/INCIDENT-POLICY.md §1). Oddiy buyurtmaga
/// o'xshamasligi uchun ogohlantirish rangida, "Karta bilan to'lash" tugmasi
/// bilan: to'lov sahifasini qayta ochadi, muvaffaqiyatli bo'lsa buyurtmalar
/// ro'yxati yangilanadi (server `paymentPending: false` qaytaradi).
class CardPaymentPendingCard extends StatefulWidget {
  const CardPaymentPendingCard({
    super.key,
    required this.kind,
    required this.orderId,
    this.paymentService,
    this.openPaymentCheckout,
    this.onPaid,
  });

  /// `food` / `market`.
  final String kind;
  final String orderId;

  /// Testlar uchun — standart: service locator'dagi [ApiClient].
  final PaymentService? paymentService;

  /// Testlar uchun — standart: [PaymentWebViewScreen].
  final OpenPaymentCheckout? openPaymentCheckout;

  /// To'lov muvaffaqiyatli tugaganda.
  final VoidCallback? onPaid;

  @override
  State<CardPaymentPendingCard> createState() => _CardPaymentPendingCardState();
}

class _CardPaymentPendingCardState extends State<CardPaymentPendingCard> {
  bool _busy = false;

  Future<void> _pay() async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = context.l10n;
    final providers = context.read<SuperappProvider>().cardPaymentProviders;
    final service = widget.paymentService ?? PaymentService(apiClient: sl<ApiClient>());
    final open = widget.openPaymentCheckout ??
        (ctx, result) => Navigator.of(ctx).push<bool>(
              MaterialPageRoute<bool>(builder: (_) => PaymentWebViewScreen(result: result)),
            );
    setState(() => _busy = true);
    try {
      final result = await service.initiate(
        orderId: widget.orderId,
        provider: preferredOnlineProvider(providers),
      );
      if (!mounted) return;
      final completed = await open(context, result);
      if (!mounted) return;
      if (completed == true) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.saPaymentReceived)));
        widget.onPaid?.call();
        await _refreshOrders();
      } else {
        messenger.showSnackBar(SnackBar(content: Text(l10n.saPaymentNotCompleted)));
      }
    } on PaymentException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.saPaymentStartFailed(e.message))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refreshOrders() async {
    try {
      if (widget.kind == 'food') {
        await context.read<FoodProvider>().loadOrderHistory();
      } else {
        await context.read<MarketProvider>().loadOrderHistory();
      }
    } catch (_) {
      // Ro'yxat keyingi ochilishda yangilanadi — to'lov allaqachon o'tgan.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      key: const ValueKey('card-payment-pending'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.hourglass_top_rounded, color: kWarningDeep),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  l10n.saPaymentPendingTitle,
                  style: const TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w800,
                    color: agText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace2),
          Text(
            l10n.saPaymentPendingHint,
            style: const TextStyle(fontSize: kFontLabel, color: agText, height: 1.4),
          ),
          const SizedBox(height: kSpace3),
          AgPrimaryButton(
            key: const ValueKey('card-payment-retry'),
            label: l10n.saPaymentRetry,
            icon: Icons.credit_card_rounded,
            onPressed: _busy ? null : _pay,
          ),
        ],
      ),
    );
  }
}
