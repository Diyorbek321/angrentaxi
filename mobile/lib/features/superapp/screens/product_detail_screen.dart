import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/models/catalog_models.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ProductDetailScreen extends StatelessWidget {
  const ProductDetailScreen({super.key, required this.product});
  final Product product;

  void _add(BuildContext context) {
    context.read<SuperappProvider>().addToCart(
          CartItem(id: product.id, name: product.name, price: product.price, qty: 1, icon: product.icon, color: product.color),
        );
  }

  @override
  Widget build(BuildContext context) {
    final p = product;
    final provider = context.watch<SuperappProvider>();
    final topPad = MediaQuery.of(context).padding.top;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: agSurface,
      body: Stack(
        children: [
          ListView(
            padding: EdgeInsets.zero,
            children: [
              SizedBox(
                height: 260,
                child: Stack(
                  children: [
                    Container(
                      height: 260,
                      width: double.infinity,
                      color: p.color,
                      alignment: Alignment.center,
                      child: Icon(p.icon, size: 120, color: Colors.white.withValues(alpha: 0.92)),
                    ),
                    Positioned(
                      top: topPad + 8,
                      left: 16,
                      child: GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.arrow_back_rounded, color: agText, size: 23),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -22),
                child: Container(
                  decoration: const BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  padding: const EdgeInsets.fromLTRB(18, 22, 18, 160),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Korzinka Express · ${p.unit}',
                          style: const TextStyle(fontSize: 12.5, color: agMuted, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(p.name,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.4)),
                      const SizedBox(height: 10),
                      Text(Formatters.formatSom(p.price),
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: agGreen)),
                      const SizedBox(height: 14),
                      const Text(
                        "Yangi va sifatli mahsulot, yaqin do'kondan tez yetkazib beriladi. Ombor mavjud.",
                        style: TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w500, height: 1.6),
                      ),
                      const SizedBox(height: 18),
                      const Row(
                        children: [
                          Expanded(child: _InfoChip(label: 'YETKAZISH', value: '15–25 daq')),
                          SizedBox(width: 10),
                          Expanded(child: _InfoChip(label: 'REYTING', value: '4.8 ★')),
                          SizedBox(width: 10),
                          Expanded(child: _InfoChip(label: 'OMBOR', value: 'Mavjud', valueColor: agGreen)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: bottomPad + 18,
            child: Column(
              children: [
                if (provider.cartCount > 0) ...[
                  AgCartBar(
                    count: provider.cartCount,
                    label: 'Savatga buyurtma',
                    trailing: Formatters.formatSom(provider.cartSubtotal),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                AgPrimaryButton(
                  label: 'Savatga · ${Formatters.formatSom(p.price)}',
                  icon: Icons.add_shopping_cart_rounded,
                  onPressed: () => _add(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value, this.valueColor = agText});
  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFB), borderRadius: BorderRadius.circular(14)),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: agMuted, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: valueColor)),
        ],
      ),
    );
  }
}
