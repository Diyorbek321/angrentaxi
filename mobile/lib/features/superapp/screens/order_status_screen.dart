import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Combined order-processing → order-done flow matching the prototype: a brief
/// animated "sending" state, then a success confirmation.
class OrderStatusScreen extends StatefulWidget {
  const OrderStatusScreen({super.key});

  @override
  State<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends State<OrderStatusScreen> {
  bool _done = false;

  @override
  void initState() {
    super.initState();
    // Cart is already cleared by CheckoutScreen once the real order succeeds —
    // this delay is purely a cosmetic "sending" transition.
    Future<void>.delayed(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      setState(() => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agSurface,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: kSpace8),
          child: _done ? _DoneView() : const _ProcessingView(),
        ),
      ),
    );
  }
}

class _ProcessingView extends StatelessWidget {
  const _ProcessingView();

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 88,
          height: 88,
          child: ExcludeSemantics(
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 88,
                  height: 88,
                  child: CircularProgressIndicator(
                    strokeWidth: 5,
                    valueColor: AlwaysStoppedAnimation(agPrimary),
                    backgroundColor: agTint,
                  ),
                ),
                Icon(Icons.receipt_long_rounded, color: agGreenText, size: 38),
              ],
            ),
          ),
        ),
        SizedBox(height: kSpace8),
        Text('Buyurtma yuborilmoqda…',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: kFontH1, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.4)),
        SizedBox(height: kSpace2),
        Text(
          "To'lov tasdiqlanmoqda va do'kon\nbuyurtmangizni qabul qilmoqda",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: kFontBody, color: agSubtle, fontWeight: FontWeight.w500, height: 1.5),
        ),
        SizedBox(height: kSpace6),
        Column(
          children: [
            _Step(label: "To'lov qabul qilindi", state: _StepState.done),
            SizedBox(height: kSpace3),
            _Step(label: "Do'konga yuborilmoqda", state: _StepState.active),
            SizedBox(height: kSpace3),
            _Step(label: 'Kuryer tayinlanmoqda', state: _StepState.idle),
          ],
        ),
      ],
    );
  }
}

enum _StepState { done, active, idle }

class _Step extends StatelessWidget {
  const _Step({required this.label, required this.state});
  final String label;
  final _StepState state;

  @override
  Widget build(BuildContext context) {
    Widget marker;
    switch (state) {
      case _StepState.done:
        marker = Container(
          width: 22,
          height: 22,
          decoration: const BoxDecoration(color: agPrimary, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, size: 15, color: agOnPrimary),
        );
      case _StepState.active:
        marker = Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: agPrimary, width: 2),
          ),
          child: Center(
            child: Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(color: agPrimary, shape: BoxShape.circle),
            ),
          ),
        );
      case _StepState.idle:
        marker = Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: agBorder, width: 2),
          ),
        );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ExcludeSemantics(child: marker),
        const SizedBox(width: kSpace3),
        Text(label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: kFontLabel,
              color: state == _StepState.idle ? agSubtle : agText,
            )),
      ],
    );
  }
}

class _DoneView extends StatelessWidget {
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
        const Text(
          "Kuryer 20–30 daqiqada yetkazib beradi.\nHolatni «Buyurtmalar» bo'limida kuzating.",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: kFontBody, color: agSubtle, fontWeight: FontWeight.w500, height: 1.5),
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
