import 'package:angren_taxi/features/superapp/screens/order_status_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Rasmiylashtirish', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                const _OptionCard(
                  iconBg: agTint,
                  iconColor: agGreen,
                  icon: Icons.location_on_rounded,
                  title: 'Yetkazib berish manzili',
                  subtitle: "Uy · Navoiy ko'chasi, 12",
                ),
                const SizedBox(height: 14),
                const _OptionCard(
                  iconBg: Color(0xFFEFF6FF),
                  iconColor: agBlue,
                  icon: Icons.credit_card_rounded,
                  title: "To'lov usuli",
                  subtitle: 'Uzcard · 8600 •••• 4421',
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _row('Mahsulotlar', Formatters.formatSom(provider.cartSubtotal)),
                      const SizedBox(height: 10),
                      _row('Yetkazib berish', Formatters.formatSom(provider.deliveryFee)),
                      const SizedBox(height: 12),
                      const Divider(color: Color(0xFFDCE2E6), height: 1),
                      const SizedBox(height: 12),
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
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).padding.bottom + 18),
            child: AgPrimaryButton(
              label: 'Buyurtmani tasdiqlash',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const OrderStatusScreen()),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _row(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w600)),
          Text(value, style: const TextStyle(fontSize: 13.5, color: agText, fontWeight: FontWeight.w700)),
        ],
      );
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.iconBg,
    required this.iconColor,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final Color iconBg;
  final Color iconColor;
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(13)),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: agMuted, size: 20),
        ],
      ),
    );
  }
}
