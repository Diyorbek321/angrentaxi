import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
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
  });

  /// Server-assigned id of the order that was just created.
  final String orderId;

  /// True only when the card checkout actually completed. Cash-on-delivery and
  /// an abandoned card flow both leave this false, and the copy says so rather
  /// than claiming the payment was accepted.
  final bool paidOnline;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agSurface,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: kSpace8),
          child: _DoneView(orderId: orderId, paidOnline: paidOnline),
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
        const Text('Buyurtma qabul qilindi',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: kFontH1, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.5)),
        const SizedBox(height: kSpace2),
        Text(
          'Buyurtma raqami: ${orderId.split('-').first.toUpperCase()}',
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
              ? "To'lov qabul qilindi. Holatni «Buyurtmalar» bo'limida kuzating."
              : "Yetkazib berishda to'laysiz. Holatni «Buyurtmalar» bo'limida kuzating.",
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
            label: 'Buyurtmalarni koʻrish',
            excludeSemantics: true,
            child: GestureDetector(
              onTap: () => _backToHome(context),
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: kControlHeight,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: agInk,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: agInkShadow,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.near_me_rounded, color: agOnPrimary, size: 21),
                    SizedBox(width: kSpace2),
                    Text('Buyurtmalarni koʻrish',
                        style: TextStyle(color: agOnPrimary, fontSize: kFontTitle, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: kSpace3),
        Semantics(
          button: true,
          label: 'Bosh sahifaga',
          excludeSemantics: true,
          child: GestureDetector(
            onTap: () => _backToHome(context),
            behavior: HitTestBehavior.opaque,
            child: Container(
              constraints: const BoxConstraints(minHeight: kMinTapTarget, minWidth: kMinTapTarget),
              alignment: Alignment.center,
              child: const Text('Bosh sahifaga',
                  style: TextStyle(color: agGreenText, fontWeight: FontWeight.w700, fontSize: kFontBody)),
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
