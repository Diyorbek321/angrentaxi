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
    Future<void>.delayed(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      context.read<SuperappProvider>().clearCart();
      setState(() => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agSurface,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 36),
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
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 88,
                height: 88,
                child: CircularProgressIndicator(
                  strokeWidth: 5,
                  valueColor: AlwaysStoppedAnimation(agGreen),
                  backgroundColor: agTint,
                ),
              ),
              Icon(Icons.receipt_long_rounded, color: agGreen, size: 38),
            ],
          ),
        ),
        SizedBox(height: 30),
        Text('Buyurtma yuborilmoqda…',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.4)),
        SizedBox(height: 8),
        Text(
          "To'lov tasdiqlanmoqda va do'kon\nbuyurtmangizni qabul qilmoqda",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14.5, color: agSubtle, fontWeight: FontWeight.w500, height: 1.5),
        ),
        SizedBox(height: 26),
        Column(
          children: [
            _Step(label: "To'lov qabul qilindi", state: _StepState.done),
            SizedBox(height: 12),
            _Step(label: "Do'konga yuborilmoqda", state: _StepState.active),
            SizedBox(height: 12),
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
          decoration: const BoxDecoration(color: agGreen, shape: BoxShape.circle),
          child: const Icon(Icons.check_rounded, size: 15, color: Colors.white),
        );
      case _StepState.active:
        marker = Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: agGreen, width: 2),
          ),
          child: Center(
            child: Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(color: agGreen, shape: BoxShape.circle),
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
        marker,
        const SizedBox(width: 11),
        Text(label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13.5,
              color: state == _StepState.idle ? agMuted : agText,
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
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [agBright, agGreen]),
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: agGreen.withValues(alpha: 0.4), blurRadius: 40, offset: const Offset(0, 18))],
          ),
          child: const Icon(Icons.check_rounded, size: 54, color: Colors.white),
        ),
        const SizedBox(height: 28),
        const Text('Buyurtma qabul qilindi',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.5)),
        const SizedBox(height: 8),
        const Text(
          "Kuryer 20–30 daqiqada yetkazib beradi.\nHolatni «Buyurtmalar» bo'limida kuzating.",
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14.5, color: agSubtle, fontWeight: FontWeight.w500, height: 1.5),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: GestureDetector(
            onTap: () => _backToHome(context),
            child: Container(
              height: 54,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: agInk, borderRadius: BorderRadius.circular(16)),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.near_me_rounded, color: Colors.white, size: 21),
                  SizedBox(width: 8),
                  Text('Buyurtmalarni koʻrish',
                      style: TextStyle(color: Colors.white, fontSize: 15.5, fontWeight: FontWeight.w800)),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: () => _backToHome(context),
          child: const Text('Bosh sahifaga',
              style: TextStyle(color: agSubtle, fontWeight: FontWeight.w700, fontSize: 14.5)),
        ),
      ],
    );
  }

  void _backToHome(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
    context.read<SuperappProvider>().tabIndex = 1; // Orders tab
  }
}
