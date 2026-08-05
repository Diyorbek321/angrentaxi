import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
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
    return AppEmptyState(
      icon: Icons.shopping_bag_outlined,
      title: "Savat bo'sh",
      message: "Ovqat yoki market mahsulotlarini qo'shing va bu yerda ko'rinadi.",
      actionLabel: "Bosh sahifaga o'tish",
      onAction: () {
        final provider = context.read<SuperappProvider>();
        if (provider.tabIndex != 0) provider.tabIndex = 0;
      },
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
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 180),
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: kSpace4),
              decoration: BoxDecoration(
                color: agSurface,
                borderRadius: BorderRadius.circular(kRadiusLg),
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
            const SizedBox(height: kSpace4),
            Container(
              padding: const EdgeInsets.all(kSpace4),
              decoration: BoxDecoration(
                color: agSurface,
                borderRadius: BorderRadius.circular(kRadiusLg),
                boxShadow: agCardShadow,
              ),
              child: Column(
                children: [
                  _SummaryRow('Mahsulotlar', Formatters.formatSom(provider.cartSubtotal)),
                  const SizedBox(height: kSpace3),
                  _SummaryRow('Yetkazib berish', Formatters.formatSom(provider.deliveryFee)),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: kSpace3),
                    child: _DashedDivider(),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Jami',
                          style: TextStyle(
                              fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                      Text(Formatters.formatSom(provider.cartTotal),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        Positioned(
          left: kSpace4,
          right: kSpace4,
          bottom: (embedded ? 92 : MediaQuery.of(context).padding.bottom + kSpace4),
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
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: item.color,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Icon(item.icon, size: 26, color: agOnPrimary.withValues(alpha: 0.95)),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
                const SizedBox(height: kSpace1),
                Text(Formatters.formatSom(item.lineTotal),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: kFontLabel, color: agGreenText)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: kSpace1),
            decoration: BoxDecoration(
              color: agBg,
              borderRadius: BorderRadius.circular(kRadiusSm),
            ),
            child: Row(
              children: [
                _QtyButton(
                  icon: Icons.remove_rounded,
                  color: agText,
                  semanticsLabel: 'Miqdorni kamaytirish',
                  onTap: onDec,
                ),
                Text('${item.qty}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                _QtyButton(
                  icon: Icons.add_rounded,
                  color: agGreenText,
                  semanticsLabel: 'Miqdorni oshirish',
                  onTap: onInc,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Savatdagi "+" / "−" tugmasi — vizual ikonka kichik bo'lsa ham
/// tegish maydoni har doim kamida `kMinTapTarget` (48dp).
class _QtyButton extends StatelessWidget {
  const _QtyButton({
    required this.icon,
    required this.color,
    required this.semanticsLabel,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minWidth: kMinTapTarget,
            minHeight: kMinTapTarget,
          ),
          child: Icon(icon, size: 20, color: color),
        ),
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
        Text(label,
            style: const TextStyle(
                fontSize: kFontLabel, color: agSubtle, fontWeight: FontWeight.w600)),
        Text(value,
            style: const TextStyle(
                fontSize: kFontLabel, color: agText, fontWeight: FontWeight.w700)),
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
            (_) => Container(width: dashWidth, height: 1, color: agBorder),
          ),
        );
      },
    );
  }
}
