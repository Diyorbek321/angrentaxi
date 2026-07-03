import 'package:angren_taxi/features/superapp/data/superapp_catalog.dart';
import 'package:angren_taxi/features/superapp/screens/product_detail_screen.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const restaurants = SuperappCatalog.restaurants;
    const products = SuperappCatalog.products;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 14),
            decoration: BoxDecoration(
              color: agSurface,
              boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 6))],
            ),
            child: Row(
              children: [
                AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(13)),
                    child: const Row(
                      children: [
                        Icon(Icons.search_rounded, size: 21, color: agGreen),
                        SizedBox(width: 9),
                        Expanded(
                          child: TextField(
                            autofocus: true,
                            decoration: InputDecoration(
                              isCollapsed: true,
                              border: InputBorder.none,
                              hintText: 'taom, doʻkon, mahsulot…',
                              hintStyle: TextStyle(color: agMuted, fontWeight: FontWeight.w600, fontSize: 14.5),
                            ),
                            style: TextStyle(color: agText, fontWeight: FontWeight.w700, fontSize: 14.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _sectionLabel('RESTORANLAR'),
                for (final r in restaurants.take(2)) ...[
                  _ResultRow(
                    color: r.color,
                    icon: r.icon,
                    title: r.name,
                    sub: '${r.tag} · ${r.time}',
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.star_rounded, size: 15, color: agOrange),
                        const SizedBox(width: 3),
                        Text(r.rating, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: agText)),
                      ],
                    ),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => RestaurantDetailScreen(restaurant: r)),
                    ),
                  ),
                  const SizedBox(height: 11),
                ],
                const SizedBox(height: 12),
                _sectionLabel('MAHSULOTLAR'),
                for (final p in products.take(3)) ...[
                  _ResultRow(
                    color: p.color,
                    icon: p.icon,
                    title: p.name,
                    sub: 'Market · ${p.unit}',
                    trailing: Text(Formatters.formatSom(p.price),
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: agText)),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(product: p)),
                    ),
                  ),
                  const SizedBox(height: 11),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 0, 2, 10),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1, color: agMuted)),
      );
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.color, required this.icon, required this.title, required this.sub, required this.trailing, required this.onTap});
  final Color color;
  final IconData icon;
  final String title;
  final String sub;
  final Widget trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: agCardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(13)),
              child: Icon(icon, size: 25, color: Colors.white.withValues(alpha: 0.95)),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: agText)),
                  Text(sub, style: const TextStyle(fontSize: 12, color: agSubtle, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}
