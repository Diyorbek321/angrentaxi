import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';

class PromosScreen extends StatelessWidget {
  const PromosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Aksiyalar va promokodlar', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                Container(
                  height: 50,
                  padding: const EdgeInsets.fromLTRB(16, 0, 8, 0),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: agCardShadow,
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.confirmation_number_rounded, size: 21, color: agGreen),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text('Promokodni kiriting',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agMuted)),
                      ),
                      Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: agGreen, borderRadius: BorderRadius.circular(11)),
                        child: const Text("Qo'llash",
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13.5)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [agInk, Color(0xFF1D3A2F)], begin: Alignment.centerLeft, end: Alignment.centerRight),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.22), blurRadius: 32, offset: const Offset(0, 14))],
                  ),
                  child: Stack(
                    clipBehavior: Clip.hardEdge,
                    children: [
                      Positioned(right: -14, top: -14, child: Icon(Icons.redeem_rounded, size: 110, color: agBright.withValues(alpha: 0.2))),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: agBright, borderRadius: BorderRadius.circular(8)),
                            child: const Text('FAOL', style: TextStyle(color: Color(0xFF06231A), fontSize: 11, fontWeight: FontWeight.w800)),
                          ),
                          const SizedBox(height: 12),
                          const Text('Birinchi safar −30%',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 24, letterSpacing: -0.5)),
                          const SizedBox(height: 4),
                          const Text('ANGREN30 · 30-iyungacha',
                              style: TextStyle(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const Text('Boshqa takliflar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: agText)),
                const SizedBox(height: 12),
                const _PromoRow(icon: Icons.restaurant_rounded, bg: Color(0xFFFEF3E2), color: agOrange,
                    title: 'Ovqatga bepul yetkazish', sub: '50 000 so\'mdan yuqori buyurtmaga', code: 'FOOD0'),
                const SizedBox(height: 11),
                const _PromoRow(icon: Icons.storefront_rounded, bg: Color(0xFFEFF6FF), color: agBlue,
                    title: 'Marketda −15%', sub: 'Hafta oxiri xaridlariga', code: 'SHOP15'),
                const SizedBox(height: 11),
                const _PromoRow(icon: Icons.group_add_rounded, bg: Color(0xFFF3EFFF), color: agPurple,
                    title: "Do'st taklif qiling", sub: 'Har bir do\'st uchun 20 000 so\'m', arrow: true),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PromoRow extends StatelessWidget {
  const _PromoRow({required this.icon, required this.bg, required this.color, required this.title, required this.sub, this.code, this.arrow = false});
  final IconData icon;
  final Color bg;
  final Color color;
  final String title;
  final String sub;
  final String? code;
  final bool arrow;

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
            width: 50,
            height: 50,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: agText)),
                Text(sub, style: const TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          if (code != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
              decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(9)),
              child: Text(code!, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: agText)),
            )
          else if (arrow)
            const Icon(Icons.arrow_forward_rounded, size: 22, color: Color(0xFFC2CCD4)),
        ],
      ),
    );
  }
}
