import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key, this.embedded = false});

  /// When hosted as a bottom-nav tab there's no back button.
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: 'Savat',
            onBack: embedded ? null : () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: provider.isCartEmpty
                ? const _EmptyCart()
                : _CartBody(provider: provider, embedded: embedded),
          ),
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                color: agSurface,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.06), blurRadius: 30, offset: const Offset(0, 14))],
              ),
              child: const Icon(Icons.shopping_bag_outlined, size: 52, color: Color(0xFFC2CCD4)),
            ),
            const SizedBox(height: 20),
            const Text("Savat bo'sh", style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: agText)),
            const SizedBox(height: 7),
            const Text(
              "Ovqat yoki market mahsulotlarini qo'shing va bu yerda ko'rinadi.",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w500, height: 1.5),
            ),
            const SizedBox(height: 22),
            GestureDetector(
              onTap: () {
                final provider = context.read<SuperappProvider>();
                if (provider.tabIndex != 0) provider.tabIndex = 0;
              },
              child: Container(
                height: 50,
                padding: const EdgeInsets.symmetric(horizontal: 26),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: agGreen, borderRadius: BorderRadius.circular(15)),
                child: const Text("Bosh sahifaga o'tish",
                    style: TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartBody extends StatelessWidget {
  const _CartBody({required this.provider, required this.embedded});
  final SuperappProvider provider;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 180),
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: agSurface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: agCardShadow,
              ),
              child: Column(
                children: [
                  for (var i = 0; i < provider.cart.length; i++)
                    _CartRow(
                      item: provider.cart[i],
                      last: i == provider.cart.length - 1,
                      onInc: () => provider.increment(provider.cart[i].id),
                      onDec: () => provider.decrement(provider.cart[i].id),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: agSurface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: agCardShadow,
              ),
              child: Column(
                children: [
                  _SummaryRow('Mahsulotlar', Formatters.formatSom(provider.cartSubtotal)),
                  const SizedBox(height: 10),
                  _SummaryRow('Yetkazib berish', Formatters.formatSom(provider.deliveryFee)),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: _DashedDivider(),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Jami', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                      Text(Formatters.formatSom(provider.cartTotal),
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: (embedded ? 92 : MediaQuery.of(context).padding.bottom + 18),
          child: AgPrimaryButton(
            label: 'Rasmiylashtirish · ${Formatters.formatSom(provider.cartTotal)}',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const CheckoutScreen()),
            ),
          ),
        ),
      ],
    );
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({required this.item, required this.last, required this.onInc, required this.onDec});
  final CartItem item;
  final bool last;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(color: item.color, borderRadius: BorderRadius.circular(14)),
            child: Icon(item.icon, size: 26, color: Colors.white.withValues(alpha: 0.95)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText)),
                const SizedBox(height: 3),
                Text(Formatters.formatSom(item.lineTotal),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: agGreen)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                GestureDetector(
                  onTap: onDec,
                  child: const Icon(Icons.remove_rounded, size: 20, color: agText),
                ),
                const SizedBox(width: 11),
                Text('${item.qty}',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
                const SizedBox(width: 11),
                GestureDetector(
                  onTap: onInc,
                  child: const Icon(Icons.add_rounded, size: 20, color: agGreen),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w600)),
        Text(value, style: const TextStyle(fontSize: 13.5, color: agText, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 5.0;
        const dashSpace = 4.0;
        final count = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(
            count,
            (_) => Container(width: dashWidth, height: 1, color: const Color(0xFFDCE2E6)),
          ),
        );
      },
    );
  }
}
