import 'dart:ui';

import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/screens/home_tab.dart';
import 'package:angren_taxi/features/superapp/screens/orders_screen.dart';
import 'package:angren_taxi/features/superapp/screens/profile_tab.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// ============================================================================
// ANGREN GO QOBIG'I — to'rtta tabli suzuvchi pastki navigatsiya.
//
// YORLIQLAR DOIM KO'RINADI. Faqat ikonali nav bitta ishni qiladigan
// ilovada ishlaydi; ko'p xizmatli super-appda esa u foydalanuvchini har
// sessiyada ikonalarni qaytadan o'rganishga majbur qiladi ("qop —
// savatmi yoki buyurtmami?"). To'rtta element 11px yorliq bilan bemalol
// sig'adi, shuning uchun yorliqni yashirishning hech qanday sababi yo'q.
//
// TANLANGAN TAB UCHTA MUSTAQIL SIGNAL bilan farqlanadi — rang yolg'iz
// yetarli emas:
//   1. SHAKL  — to'ldirilgan ikonka (tanlanmaganda kontur);
//   2. YUZA   — ikonka ortida `agTint` tabletka;
//   3. RANG   — `kPrimary`.
//
// RANG QOIDASI. Tanlanmagan holatda IKONKA `kInkSubtle` (3.67:1 — WCAG
// 1.4.11 grafik element uchun 3:1 dan yuqori), YORLIQ esa `kInkMuted`
// (5.47:1). Ikkalasi bir xil emas: `kInkSubtle` YOZUVDA taqiqlangan,
// chunki 11px matn uchun 3.67:1 o'qilmaydi.
// ============================================================================

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

  /// Savat tabining indeksi — nishon faqat shu elementga qo'yiladi.
  /// Raqamni ikki joyda takrorlamaslik uchun nomlangan konstanta.
  static const int _cartTabIndex = 2;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();
    final index = provider.tabIndex;

    // Jest paneli bor qurilmalarda nav uning ostiga tushib qolmasligi
    // kerak — pastki xavfsiz zona gutter'ga QO'SHILADI, uni almashtirmaydi.
    final bottomInset = MediaQuery.of(context).padding.bottom;

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
            bottom: kSpace3 + bottomInset,
            child: _NavBar(
              tabs: _tabs,
              index: index,
              cartTabIndex: _cartTabIndex,
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
    required this.cartTabIndex,
    required this.cartBadge,
    required this.onTap,
  });

  final List<_TabDef> tabs;
  final int index;
  final int cartTabIndex;
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
                    badge: i == cartTabIndex && cartBadge > 0
                        ? '$cartBadge'
                        : null,
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

  /// Ikonka ortidagi tabletka o'lchamlari. Bular shkala tokenlari emas,
  /// aynan shu komponentning geometriyasi: 66dp balandlikdagi navga
  /// tabletka + yorliq sig'ishi kerak.
  static const double _pillHeight = 28;
  static const double _pillWidth = 52;

  @override
  Widget build(BuildContext context) {
    // IKONKA va YORLIQ ranglari ATAYLAB har xil.
    //
    // Tanlanmagan ikonka `kInkSubtle` (agMuted, 3.67:1) — u grafik element,
    // WCAG 1.4.11 bo'yicha 3:1 yetarli, va bu pastroq kontrast tanlangan
    // tabni kuchliroq ajratadi.
    //
    // Tanlanmagan YORLIQ esa `kInkMuted` (agSubtle, 5.47:1). 11px matnni
    // `kInkSubtle` bilan yozish qoidabuzarlik bo'lardi — yorliqlar doim
    // ko'rinadigan navda esa aynan matn eng ko'p o'qiladigan qism.
    final iconColor = active ? agPrimary : agMuted;
    final labelColor = active ? agPrimary : agSubtle;

    return Semantics(
      button: true,
      selected: active,
      label: tab.label,
      value: badge == null ? null : '$badge ta',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          // Tab almashuvi — "tanlov o'zgardi" hodisasi, oddiy tugma emas.
          AppHaptics.select();
          onTap();
        },
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Nishon ikonkaning O'ZIGA bog'lanadi, element kengligiga
              // emas — ilgari `right: 18` sehrli raqami ishlatilardi va u
              // element kengligi o'zgarganda ikonkadan uzilib qolardi.
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  AnimatedContainer(
                    duration: kDurationFast,
                    curve: kEaseStandard,
                    width: _pillWidth,
                    height: _pillHeight,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      // Tabletka — uchinchi signal (yuza). Tanlanmaganda
                      // butunlay shaffof, ya'ni nav tinch qoladi.
                      color: active ? agTint : Colors.transparent,
                      borderRadius: BorderRadius.circular(kRadiusFull),
                    ),
                    child: Icon(
                      active ? tab.activeIcon : tab.icon,
                      color: iconColor,
                      size: 23,
                    ),
                  ),
                  if (badge != null)
                    Positioned(
                      top: -1,
                      right: 6,
                      child: _CartBadge(count: badge!),
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                tab.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: kFontMicro,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                  color: labelColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Savatdagi DONA soni.
///
/// ⚠️ Oq raqam `kError` (#E5484D) fonda 3.91:1 — kichik matn uchun 4.5:1
/// dan past. Bu ataylab qabul qilingan murosa: qizil nishon butun ilovada
/// (`AgIconButton.badge`) shu ko'rinishda va uni faqat shu yerda
/// o'zgartirish tilni buzardi. Murosa xavfsiz, chunki SON hech qachon
/// YAGONA kanal emas — yonida doim "Savat" yorlig'i turadi, ekran
/// o'quvchiga son `Semantics.value` orqali "N ta" deb aytiladi, va aniq
/// ro'yxat savat ekranining o'zida.
class _CartBadge extends StatelessWidget {
  const _CartBadge({required this.count});

  final String count;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 18),
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: kSpace1),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: agRed,
        borderRadius: BorderRadius.circular(kRadiusFull),
        // Oq halqa nishonni ikonka konturidan uzadi — aks holda ikkalasi
        // qo'shilib, dog'ga o'xshab ko'rinadi.
        border: Border.all(color: agSurface, width: 2),
      ),
      child: Text(
        count,
        style: const TextStyle(
          color: agOnPrimary,
          fontSize: kFontMicro,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
