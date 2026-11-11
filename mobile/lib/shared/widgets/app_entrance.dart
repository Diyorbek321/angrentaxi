import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

// ============================================================================
// KIRISH ANIMATSIYALARI — kontent "paydo bo'ladi", shunchaki turmaydi.
//
// Muammo: `flutter_animate` paketi pubspec'da bor edi, lekin 114 fayldan
// atigi 8 tasida ishlatilardi. Qolgan ekranlarda kontent bir zumda,
// hech qanday o'tishsiz paydo bo'lardi — bu ayniqsa tarmoqdan ma'lumot
// kelganda seziladi: bo'sh ekran → to'satdan to'liq ro'yxat.
//
// NIMA UCHUN "STAGGER" (zinapoyali kechikish):
// Ro'yxat elementlari birdaniga emas, 55ms oralatib chiqadi. Bu ko'z
// harakatini boshqaradi — foydalanuvchi ro'yxatni yuqoridan pastga
// "o'qiydi", butun blokni bir zumda qabul qilishga urinmaydi.
//
// ⚠️ CHEGARA: kirish animatsiyasi faqat BIRINCHI ko'rinishda. Har bir
// setState'da qayta ijro etilsa, ilova "sakraydigan" bo'lib qoladi.
// `flutter_animate` buni o'zi hal qiladi (animatsiya bir marta ishga
// tushadi), lekin ro'yxatlarda `key` to'g'ri berilishi kerak.
// ============================================================================

/// Kontentni yumshoq "pastdan suzib chiqish" bilan ko'rsatadi.
///
/// ```dart
/// AppEntrance(child: OrderCard(order: order))
/// AppEntrance(index: i, child: OrderCard(order: orders[i]))   // ro'yxatda
/// ```
class AppEntrance extends StatelessWidget {
  const AppEntrance({
    super.key,
    required this.child,
    this.index = 0,
    this.delay = Duration.zero,
    this.offset = 12,
    this.duration,
  });

  final Widget child;

  /// Ro'yxatdagi tartib raqami — kechikish shu asosda hisoblanadi.
  final int index;

  /// Qo'shimcha boshlang'ich kechikish (masalan header'dan keyin).
  final Duration delay;

  /// Qanchalik pastdan ko'tarilishi (dp). Katta bloklar uchun 16–24,
  /// ro'yxat qatorlari uchun 8–12.
  final double offset;

  final Duration? duration;

  @override
  Widget build(BuildContext context) {
    // Foydalanuvchi harakatni kamaytirgan bo'lsa — animatsiyasiz.
    if (AppMotion.reduced(context)) return child;

    // Uzun ro'yxatlarda kechikish cheksiz o'smasligi kerak: 12-elementdan
    // keyin hammasi bir vaqtda chiqadi, aks holda 40-element ekranda
    // 2 soniyadan keyin paydo bo'lardi.
    final step = index.clamp(0, 12);
    final totalDelay = delay + AppMotion.stagger * step;

    return child
        .animate(delay: totalDelay)
        .fadeIn(
          duration: duration ?? AppMotion.slow,
          curve: AppMotion.enter,
        )
        .slideY(
          begin: offset / 100,
          end: 0,
          duration: duration ?? AppMotion.slow,
          curve: AppMotion.emphasized,
        );
  }
}

/// Ro'yxat bolalariga avtomatik zinapoyali kirish animatsiyasini qo'llaydi.
///
/// `Column`/`ListView` bolalarini qo'lda indekslash o'rniga:
/// ```dart
/// AppStagger(children: [Header(), Card1(), Card2()])
/// ```
class AppStagger extends StatelessWidget {
  const AppStagger({
    super.key,
    required this.children,
    this.delay = Duration.zero,
    this.offset = 12,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
  });

  final List<Widget> children;
  final Duration delay;
  final double offset;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: crossAxisAlignment,
      children: [
        for (var i = 0; i < children.length; i++)
          AppEntrance(
            index: i,
            delay: delay,
            offset: offset,
            child: children[i],
          ),
      ],
    );
  }
}

/// Diqqat tortadigan "puls" — yangi buyurtma taklifi, faol safar nishoni.
///
/// Cheksiz takrorlanadi, shuning uchun FAQAT haqiqatan diqqat talab
/// qiladigan, vaqt bilan chegaralangan holatlarda ishlating.
class AppPulse extends StatelessWidget {
  const AppPulse({
    super.key,
    required this.child,
    this.enabled = true,
    this.minScale = 1.0,
    this.maxScale = 1.06,
  });

  final Widget child;
  final bool enabled;
  final double minScale;
  final double maxScale;

  @override
  Widget build(BuildContext context) {
    if (!enabled || AppMotion.reduced(context)) return child;

    return child.animate(onPlay: (c) => c.repeat(reverse: true)).scaleXY(
          begin: minScale,
          end: maxScale,
          duration: const Duration(milliseconds: 900),
          curve: Curves.easeInOut,
        );
  }
}

/// Yuklanayotgan yuzalar uchun "shimmer" — skeleton ustiga qo'llanadi.
class AppShimmer extends StatelessWidget {
  const AppShimmer({super.key, required this.child, this.enabled = true});

  final Widget child;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled || AppMotion.reduced(context)) return child;

    final scheme = Theme.of(context).colorScheme;
    return child.animate(onPlay: (c) => c.repeat()).shimmer(
          duration: const Duration(milliseconds: 1400),
          color: scheme.surface.withValues(alpha: 0.55),
        );
  }
}

/// Widget uchun qisqa yozuv: `MyCard().entering(index: 2)`.
extension AppEntranceX on Widget {
  Widget entering(
          {int index = 0,
          Duration delay = Duration.zero,
          double offset = 12}) =>
      AppEntrance(index: index, delay: delay, offset: offset, child: this);
}
