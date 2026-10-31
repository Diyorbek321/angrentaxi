import 'package:angren_taxi/features/superapp/screens/vendor_order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/vendor_cancel_flow.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Confirmation shown after a food/market order is actually placed.
///
/// This screen used to run a fixed 2200 ms timer and then declare success,
/// with three hardcoded progress steps ("To'lov qabul qilindi" ticked, "Do'konga
/// yuborilmoqda", "Kuryer tayinlanmoqda") that were unconnected to the order,
/// plus an invented "Kuryer 20–30 daqiqada yetkazib beradi" promise. By the
/// time this screen opens the order already exists server-side, so it now
/// simply reports what is true: the order number, and whether payment was
/// settled or is still outstanding.
class OrderStatusScreen extends StatelessWidget {
  const OrderStatusScreen({
    super.key,
    required this.orderId,
    required this.paidOnline,
    this.kind,
  });

  /// `food` / `market` — bekor qilish amali uchun. `null` — amal ko'rsatilmaydi.
  final String? kind;

  /// Server-assigned id of the order that was just created.
  final String orderId;

  /// True only when the card checkout actually completed. Cash-on-delivery and
  /// an abandoned card flow both leave this false, and the copy says so rather
  /// than claiming the payment was accepted.
  final bool paidOnline;

  @override
  Widget build(BuildContext context) {
    final kind = this.kind;
    final order = kind == null ? null : findVendorOrder(context, kind, orderId);
    return Scaffold(
      backgroundColor: agSurface,
      // Kichik ekranda (360×640) va katta shriftda tugmalar ekrandan
      // chiqib ketmasligi uchun aylantiriladigan, markazlashtirilgan.
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: kSpace6, vertical: kSpace4),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight - kSpace8),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _DoneView(orderId: orderId, paidOnline: paidOnline),
                      // Bekor qilish — ikkilamchi, lekin KO'RINADIGAN amal.
                      // Restoran qabul qilgach o'chiq holda sababi bilan turadi.
                      if (kind != null && order != null && order.isActive) ...[
                        const SizedBox(height: kSpace4),
                        VendorCancelAction(
                          kind: kind,
                          canCancel: order.canCancel,
                          onCancel: () async {
                            final cancelled =
                                await runVendorCancelFlow(context, kind: kind, orderId: orderId);
                            if (cancelled && context.mounted) {
                              Navigator.of(context).popUntil((route) => route.isFirst);
                              context.read<SuperappProvider>().tabIndex = 1;
                            }
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DoneView extends StatelessWidget {
  const _DoneView({required this.orderId, required this.paidOnline});

  final String orderId;
  final bool paidOnline;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(
          child: Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              gradient: agMintGradient,
              shape: BoxShape.circle,
              boxShadow: agCtaShadow,
            ),
            child: const Icon(Icons.check_rounded, size: 54, color: agOnMint),
          ),
        ),
        const SizedBox(height: kSpace6),
        Text(context.l10n.saOrderAccepted,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: kFontH1, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.5)),
        const SizedBox(height: kSpace2),
        Text(
          context.l10n
              .saOrderNumber(orderId.split('-').first.toUpperCase()),
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: kFontBody,
            color: agText,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: kSpace1),
        Text(
          paidOnline
              ? context.l10n.saOrderPaidOnlineHint
              : context.l10n.saOrderPayOnDeliveryHint,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: kFontBody,
            color: agSubtle,
            fontWeight: FontWeight.w500,
            height: 1.5,
          ),
        ),
        const SizedBox(height: kSpace6),
        SizedBox(
          width: double.infinity,
          child: Semantics(
            button: true,
            label: context.l10n.saViewOrders,
            excludeSemantics: true,
            child: GestureDetector(
              onTap: () => _backToHome(context),
              behavior: HitTestBehavior.opaque,
              child: Container(
                // Qat'iy balandlik emas — 1.3x shriftda matn kesilmasin.
                constraints: const BoxConstraints(minHeight: kControlHeight),
                padding: const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace2),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: agInk,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: agInkShadow,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.near_me_rounded, color: agOnPrimary, size: 21),
                    const SizedBox(width: kSpace2),
                    Flexible(
                      child: Text(context.l10n.saViewOrders,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: agOnPrimary, fontSize: kFontTitle, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: kSpace3),
        Semantics(
          button: true,
          label: context.l10n.saBackToHome,
          excludeSemantics: true,
          child: GestureDetector(
            onTap: () => _backToHome(context),
            behavior: HitTestBehavior.opaque,
            child: Container(
              constraints: const BoxConstraints(minHeight: kMinTapTarget, minWidth: kMinTapTarget),
              alignment: Alignment.center,
              child: Text(context.l10n.saBackToHome,
                  style: const TextStyle(color: agGreenText, fontWeight: FontWeight.w700, fontSize: kFontBody)),
            ),
          ),
        ),
      ],
    );
  }

  void _backToHome(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
    context.read<SuperappProvider>().tabIndex = 1; // Orders tab
  }
}
