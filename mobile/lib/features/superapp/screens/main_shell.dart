import 'dart:ui';

import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/home_tab.dart';
import 'package:angren_taxi/features/superapp/screens/orders_screen.dart';
import 'package:angren_taxi/features/superapp/screens/profile_tab.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Root Angren Go shell hosting the four primary tabs behind a floating,
/// frosted-glass navigation bar — a 1:1 port of the prototype's bottom nav.
class SuperappShell extends StatelessWidget {
  const SuperappShell({super.key});

  static const _tabs = [
    _TabDef('Asosiy', Icons.home_outlined, Icons.home_rounded),
    _TabDef('Buyurtma', Icons.receipt_long_outlined, Icons.receipt_long_rounded),
    _TabDef('Savat', Icons.shopping_bag_outlined, Icons.shopping_bag_rounded),
    _TabDef('Profil', Icons.person_outline_rounded, Icons.person_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();
    final index = provider.tabIndex;

    return Scaffold(
      backgroundColor: agBg,
      body: Stack(
        children: [
          IndexedStack(
            index: index,
            children: const [
              HomeTab(),
              OrdersScreen(embedded: true),
              CartScreen(embedded: true),
              ProfileTab(),
            ],
          ),
          Positioned(
            left: kSpace3,
            right: kSpace3,
            bottom: kSpace3,
            child: _NavBar(
              tabs: _tabs,
              index: index,
              cartBadge: provider.cartCount,
              onTap: (i) => provider.tabIndex = i,
            ),
          ),
        ],
      ),
    );
  }
}

class _TabDef {
  const _TabDef(this.label, this.icon, this.activeIcon);
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

class _NavBar extends StatelessWidget {
  const _NavBar({
    required this.tabs,
    required this.index,
    required this.cartBadge,
    required this.onTap,
  });

  final List<_TabDef> tabs;
  final int index;
  final int cartBadge;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(kRadiusXl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          height: 66,
          padding: const EdgeInsets.symmetric(horizontal: kSpace2),
          decoration: BoxDecoration(
            color: agSurface.withValues(alpha: 0.86),
            borderRadius: BorderRadius.circular(kRadiusXl),
            border: Border.all(color: agInk.withValues(alpha: 0.06)),
            boxShadow: agSoftShadow,
          ),
          child: Row(
            children: [
              for (var i = 0; i < tabs.length; i++)
                Expanded(
                  child: _NavItem(
                    tab: tabs[i],
                    active: i == index,
                    badge: i == 2 && cartBadge > 0 ? '$cartBadge' : null,
                    onTap: () => onTap(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tab,
    required this.active,
    required this.onTap,
    this.badge,
  });

  final _TabDef tab;
  final bool active;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    // Faol tab uchta signal bilan farqlanadi: to'ldirilgan ikonka (shakl),
    // qalinroq yozuv va rang. `agGreen` (#10A064) oq nav fonda 3.4:1 — matn
    // uchun yetarli emas, shuning uchun `agPrimary` (5.38:1).
    final color = active ? agPrimary : agSubtle;
    return Semantics(
      button: true,
      selected: active,
      label: tab.label,
      value: badge == null ? null : '$badge ta',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(active ? tab.activeIcon : tab.icon,
                      color: color, size: 25),
                  const SizedBox(height: 3),
                  Text(
                    tab.label,
                    style: TextStyle(
                      fontSize: kFontMicro,
                      fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                      color: color,
                    ),
                  ),
                ],
              ),
              if (badge != null)
                Positioned(
                  top: -2,
                  right: 18,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 17),
                    height: 17,
                    padding: const EdgeInsets.symmetric(horizontal: kSpace1),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: agRed,
                      borderRadius: BorderRadius.circular(kRadiusFull),
                      border: Border.all(color: agSurface, width: 2),
                    ),
                    child: Text(
                      badge!,
                      style: const TextStyle(
                        color: agOnPrimary,
                        fontSize: kFontMicro,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
