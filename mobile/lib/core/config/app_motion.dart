import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// MOTION TIZIMI — platformaga mos ekran o'tishlari va kirish animatsiyalari.
//
// Muammo: 35 ta `MaterialPageRoute` chaqiruvi, 0 ta `PageRouteBuilder`,
// 0 ta `pageTransitionsTheme`. Natijada iOS'da ham Android'ning pastdan
// yuqoriga siljish o'tishi ishlatilardi — iOS foydalanuvchisi uchun ilova
// "begona" his qilinadi va orqaga surish (back-swipe) imkoniyati yo'q edi.
//
// Yechim: o'tishlar TEMA darajasida belgilanadi. Shunda mavjud 35 ta
// chaqiruvning birortasini ham o'zgartirmasdan butun ilova to'g'ri
// animatsiyaga o'tadi:
//   iOS     → gorizontal siljish + parallaks + interaktiv orqaga surish
//   Android → Material 3 "shared axis" (fade-through + yumshoq siljish)
//
// QOIDA: animatsiya harakatni TUSHUNTIRISHI kerak. Bezak uchun animatsiya
// qo'shilmaydi. Foydalanuvchi "harakatni kamaytirish"ni yoqsa
// (`disableAnimations`), barcha davomiylik nolga tushadi.
// ============================================================================

/// Motion tokenlari va yordamchilari.
abstract final class AppMotion {
  // --- Davomiylik (app_theme.dart dagi kDuration* ustiga qurilgan) ---

  /// Mikro-javob: bosilish, toggle, ripple. 150ms.
  static const Duration fast = kDurationFast;

  /// Standart: kartaning paydo bo'lishi, holat almashinuvi. 200ms.
  static const Duration base = kDurationBase;

  /// Ekran o'tishi, sheet ochilishi. 300ms.
  static const Duration slow = kDurationSlow;

  /// Urg'uli: hero, katta panel, muvaffaqiyat animatsiyasi. 500ms.
  static const Duration slower = kDurationSlower;

  /// Ro'yxat elementlari orasidagi kechikish (stagger qadami).
  static const Duration stagger = Duration(milliseconds: 55);

  // --- Egri chiziqlar ---

  static const Curve standard = kEaseStandard;

  /// Sheet va drawer uchun — tez boshlanib, yumshoq to'xtaydi.
  static const Curve emphasized = kEaseEmphasized;

  static const Curve enter = kEaseOut;

  /// Chiqib ketish — tezroq, chunki foydalanuvchi allaqachon qaror qilgan.
  static const Curve exit = Curves.easeIn;

  /// Yengil "spring" hissi — bosilgan tugma qaytishi, badge paydo bo'lishi.
  static const Curve spring = Curves.easeOutBack;

  /// Foydalanuvchi tizim sozlamalarida harakatni kamaytirganmi.
  ///
  /// iOS: Sozlamalar → Universal Access → Reduce Motion.
  /// Android: Sozlamalar → Accessibility → Remove animations.
  static bool reduced(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context);

  /// Harakat kamaytirilgan bo'lsa nol, aks holda berilgan davomiylik.
  /// Har bir animatsiyada shu orqali o'tkazing.
  static Duration duration(BuildContext context, Duration value) =>
      reduced(context) ? Duration.zero : value;
}

// ---------------------------------------------------------------------------
// EKRAN O'TISHLARI
// ---------------------------------------------------------------------------

/// Material 3 "shared axis (X)" o'tishi — Android uchun.
///
/// Yangi ekran o'ngdan 30dp siljib kirib, paydo bo'ladi; eskisi chapga
/// 30dp siljib, o'chadi. Material 3 spetsifikatsiyasidagi bu naqsh
/// "ierarxiyada oldinga siljish"ni bildiradi va standart `ZoomPageTransition`
/// dan sezilarli darajada yengilroq his qilinadi.
class SharedAxisPageTransitionsBuilder extends PageTransitionsBuilder {
  const SharedAxisPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T>? route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (AppMotion.reduced(context)) return child;

    // Kiruvchi ekran: o'ngdan 30dp + fade in (oxirgi 70% da).
    final slideIn = Tween<Offset>(
      begin: const Offset(0.06, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: animation, curve: AppMotion.emphasized));

    final fadeIn = CurvedAnimation(
      parent: animation,
      curve: const Interval(0.3, 1, curve: Curves.easeOut),
    );

    // Chiquvchi (ostidagi) ekran: chapga 30dp + fade out (dastlabki 30% da).
    final slideOut = Tween<Offset>(
      begin: Offset.zero,
      end: const Offset(-0.06, 0),
    ).animate(
      CurvedAnimation(parent: secondaryAnimation, curve: AppMotion.emphasized),
    );

    final fadeOut = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(
        parent: secondaryAnimation,
        curve: const Interval(0, 0.3, curve: Curves.easeIn),
      ),
    );

    return SlideTransition(
      position: slideOut,
      child: FadeTransition(
        opacity: fadeOut,
        child: SlideTransition(
          position: slideIn,
          child: FadeTransition(opacity: fadeIn, child: child),
        ),
      ),
    );
  }
}

/// Butun ilova uchun o'tishlar jadvali — `ThemeData.pageTransitionsTheme`
/// ga beriladi.
///
/// iOS/macOS'da `CupertinoPageTransitionsBuilder` ishlatiladi: u nafaqat
/// to'g'ri vizual o'tishni beradi, balki chetdan surib orqaga qaytish
/// (interactive pop) imkoniyatini ham YOQADI — iOS foydalanuvchisi buni
/// mushak xotirasi darajasida kutadi.
const PageTransitionsTheme kAppPageTransitions = PageTransitionsTheme(
  builders: <TargetPlatform, PageTransitionsBuilder>{
    TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
    TargetPlatform.android: SharedAxisPageTransitionsBuilder(),
    TargetPlatform.fuchsia: SharedAxisPageTransitionsBuilder(),
    TargetPlatform.linux: SharedAxisPageTransitionsBuilder(),
    TargetPlatform.windows: SharedAxisPageTransitionsBuilder(),
  },
);

// ---------------------------------------------------------------------------
// MAXSUS ROUTE'LAR — tema o'tishidan farq qilishi kerak bo'lgan holatlar
// ---------------------------------------------------------------------------

/// Ierarxiyada YONMA-YON ekranlar uchun (tab almashinuvi, filtr natijasi).
/// Siljishsiz, faqat fade + mayin masshtab — "oldinga o'tish" ma'nosini
/// bermaydi.
Route<T> fadeThroughRoute<T>(Widget page, {String? name}) {
  return PageRouteBuilder<T>(
    settings: RouteSettings(name: name),
    transitionDuration: AppMotion.slow,
    reverseTransitionDuration: AppMotion.base,
    pageBuilder: (_, __, ___) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (AppMotion.reduced(context)) return child;
      final fade = CurvedAnimation(
        parent: animation,
        curve: const Interval(0.35, 1, curve: Curves.easeOut),
      );
      final scale = Tween<double>(begin: 0.96, end: 1).animate(
        CurvedAnimation(parent: animation, curve: AppMotion.emphasized),
      );
      return FadeTransition(
        opacity: fade,
        child: ScaleTransition(scale: scale, child: child),
      );
    },
  );
}

/// To'liq ekranli modal — pastdan ko'tariladi, ikkala platformada ham
/// bir xil (chunki bu "sahifa" emas, "vazifa" oynasi).
Route<T> modalSheetRoute<T>(
  Widget page, {
  String? name,
  bool opaque = true,
}) {
  return PageRouteBuilder<T>(
    settings: RouteSettings(name: name),
    opaque: opaque,
    barrierColor: kInk.withValues(alpha: 0.32),
    transitionDuration: AppMotion.slow,
    reverseTransitionDuration: AppMotion.base,
    pageBuilder: (_, __, ___) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (AppMotion.reduced(context)) return child;
      final slide = Tween<Offset>(
        begin: const Offset(0, 1),
        end: Offset.zero,
      ).animate(
        CurvedAnimation(parent: animation, curve: AppMotion.emphasized),
      );
      return SlideTransition(position: slide, child: child);
    },
  );
}

/// Muhim tasdiq/xato oynalari uchun — markazdan kattalashib chiqadi.
Route<T> fadeScaleRoute<T>(Widget page, {String? name}) {
  return PageRouteBuilder<T>(
    settings: RouteSettings(name: name),
    opaque: false,
    barrierColor: kInk.withValues(alpha: 0.45),
    transitionDuration: AppMotion.base,
    pageBuilder: (_, __, ___) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (AppMotion.reduced(context)) return child;
      final curved =
          CurvedAnimation(parent: animation, curve: AppMotion.emphasized);
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.92, end: 1).animate(curved),
          child: child,
        ),
      );
    },
  );
}
