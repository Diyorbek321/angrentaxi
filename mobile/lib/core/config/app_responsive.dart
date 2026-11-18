import 'package:flutter/material.dart';

// ============================================================================
// RESPONSIVE TIZIM — bitta ilova, barcha ekran o'lchamlari.
//
// Muammo: 114 Dart faylidan 0 tasida breakpoint bor edi. Ilova 360dp
// telefonga qarab qurilgan — iPhone SE (320dp) da toshib ketardi, planshet
// va ochilgan foldable (900dp+) da esa tugmalar butun ekran bo'ylab
// cho'zilib, "kattalashtirilgan telefon ilovasi" ko'rinishini berardi.
//
// Yechim: Material 3 window size class'lari + har bir sinf uchun aniq
// gutter, kontent kengligi, ustunlar soni va tipografika ko'paytuvchisi.
//
// QOIDA: ekranlarda `MediaQuery.of(context).size.width < 400` kabi
// qo'lbola tekshiruvlar YOZMANG — `context.bp` va `context.gutter`dan
// foydalaning.
// ============================================================================

/// Material 3 "window size class" — qurilma emas, MAVJUD KENGLIK sinfi.
/// (Ochilgan foldable telefon ham `medium` bo'ladi — bu to'g'ri.)
enum Breakpoint {
  /// < 360dp — iPhone SE, eski/arzon Androidlar. Eng tor holat.
  tight,

  /// 360–599dp — telefonlarning asosiy qismi. Bazaviy dizayn shu yerda.
  compact,

  /// 600–904dp — planshet portret, ochilgan foldable, katta telefon landshaft.
  medium,

  /// ≥ 905dp — planshet landshaft, iPad Pro, Desktop/web.
  expanded,
}

/// Kenglikdan breakpoint hisoblash. Sinov (test) uchun ochiq.
Breakpoint breakpointForWidth(double width) {
  if (width < 360) return Breakpoint.tight;
  if (width < 600) return Breakpoint.compact;
  if (width < 905) return Breakpoint.medium;
  return Breakpoint.expanded;
}

/// Responsive qiymatlarga qisqa yo'l: `context.bp`, `context.gutter`, ...
extension ResponsiveContext on BuildContext {
  Size get _screen => MediaQuery.sizeOf(this);

  /// Joriy window size class.
  Breakpoint get bp => breakpointForWidth(_screen.width);

  bool get isTight => bp == Breakpoint.tight;

  /// Telefon (tight yoki compact) — bir ustunli tartib.
  bool get isPhone => bp == Breakpoint.tight || bp == Breakpoint.compact;

  /// Planshet/foldable — ikki ustunli tartibga joy bor.
  bool get isTablet => bp == Breakpoint.medium || bp == Breakpoint.expanded;

  bool get isLandscape =>
      MediaQuery.orientationOf(this) == Orientation.landscape;

  /// Xarita + panel yonma-yon joylashtirish mumkinmi.
  ///
  /// Taksi ilovasining eng katta responsive yutug'i shu: planshetda va
  /// landshaft telefonda xaritani pastdagi sheet bilan yopish o'rniga
  /// yon panelga chiqarish — xarita to'liq ko'rinadi.
  bool get canSplitMapPanel => _screen.width >= 720;

  /// Ekran chetidagi gorizontal padding.
  double get gutter => switch (bp) {
        Breakpoint.tight => 12,
        Breakpoint.compact => 16,
        Breakpoint.medium => 24,
        Breakpoint.expanded => 32,
      };

  EdgeInsets get gutterPadding => EdgeInsets.symmetric(horizontal: gutter);

  /// O'qish uchun qulay maksimal kontent kengligi.
  ///
  /// Planshetda forma va CTA'lar 900dp cho'zilmasligi kerak — markazda
  /// cheklanadi. Telefonda cheklov yo'q (`double.infinity`).
  double get contentMaxWidth => switch (bp) {
        Breakpoint.tight || Breakpoint.compact => double.infinity,
        Breakpoint.medium => 560,
        Breakpoint.expanded => 640,
      };

  /// Yonma-yon tartibda xarita ustidagi panel kengligi.
  double get sidePanelWidth => bp == Breakpoint.expanded ? 420.0 : 360.0;

  /// Katakli (grid) tartiblar uchun ustunlar soni — superapp plitkalari,
  /// mahsulot kartalari.
  int gridColumns({int phone = 2, int tablet = 3, int wide = 4}) =>
      switch (bp) {
        Breakpoint.tight || Breakpoint.compact => phone,
        Breakpoint.medium => tablet,
        Breakpoint.expanded => wide,
      };

  /// Xizmat plitkalari (Taksi/Yuk/Ovqat/Market) uchun ustunlar.
  int get serviceTileColumns => gridColumns(phone: 4, tablet: 6, wide: 8);

  /// Tipografika ko'paytuvchisi — katta ekranda matn biroz kattalashadi,
  /// tor ekranda biroz kichrayadi. Foydalanuvchining tizim shrift
  /// sozlamasidan MUSTAQIL (u `textScaler` orqali qo'shimcha qo'llanadi).
  double get typeScale => switch (bp) {
        Breakpoint.tight => 0.94,
        Breakpoint.compact => 1.0,
        Breakpoint.medium => 1.05,
        Breakpoint.expanded => 1.1,
      };

  /// Shkaladagi shrift o'lchamini joriy breakpointga moslash.
  /// `fs(kFontH1)` → tight'da 21.6, expanded'da 25.3.
  double fs(double size) => size * typeScale;

  /// Vertikal bo'shliqni tor ekranda siqish (kartalar orasidagi masofa).
  /// `vs(kSpace6)` → tight'da 18, boshqa joyda 24.
  double vs(double space) => isTight ? space * 0.75 : space;

  /// Pastdagi tizim panel(gesture bar)i uchun xavfsiz padding.
  double get bottomInset => MediaQuery.paddingOf(this).bottom;

  /// Yuqoridagi status bar balandligi.
  double get topInset => MediaQuery.paddingOf(this).top;

  /// Klaviatura ochilganda uning balandligi (0 = yopiq).
  double get keyboardInset => MediaQuery.viewInsetsOf(this).bottom;

  bool get isKeyboardOpen => keyboardInset > 0;
}

/// Kontentni markazda cheklaydigan o'ram.
///
/// Planshetda to'liq kenglikdagi tugma/forma xunuk ko'rinadi. Bu widget
/// telefonda hech narsa qilmaydi, planshetda esa kontentni
/// `contentMaxWidth` ichida markazlashtiradi.
///
/// ```dart
/// ResponsiveContent(child: Column(children: [...]))
/// ```
class ResponsiveContent extends StatelessWidget {
  const ResponsiveContent({
    super.key,
    required this.child,
    this.maxWidth,
    this.alignment = Alignment.topCenter,
  });

  final Widget child;

  /// Standart `context.contentMaxWidth` o'rniga aniq kenglik.
  final double? maxWidth;
  final AlignmentGeometry alignment;

  @override
  Widget build(BuildContext context) {
    final limit = maxWidth ?? context.contentMaxWidth;
    if (!limit.isFinite) return child;

    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: limit),
        child: child,
      ),
    );
  }
}

/// Gutter + kontent cheklovini birga qo'llaydigan o'ram — ekran tanasi
/// uchun eng ko'p ishlatiladigan konteyner.
class ResponsiveBody extends StatelessWidget {
  const ResponsiveBody({
    super.key,
    required this.child,
    this.maxWidth,
    this.top = 0,
    this.bottom = 0,
  });

  final Widget child;
  final double? maxWidth;
  final double top;
  final double bottom;

  @override
  Widget build(BuildContext context) {
    return ResponsiveContent(
      maxWidth: maxWidth,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          context.gutter,
          top,
          context.gutter,
          bottom,
        ),
        child: child,
      ),
    );
  }
}

/// Breakpointga qarab turli widget qaytaradigan tanlagich.
///
/// `medium`/`expanded` berilmasa, bir pastki sinfga tushadi — ya'ni
/// faqat `compact` berish ham yetarli.
class ResponsiveSwitcher extends StatelessWidget {
  const ResponsiveSwitcher({
    super.key,
    required this.compact,
    this.tight,
    this.medium,
    this.expanded,
  });

  final WidgetBuilder compact;
  final WidgetBuilder? tight;
  final WidgetBuilder? medium;
  final WidgetBuilder? expanded;

  @override
  Widget build(BuildContext context) {
    return switch (context.bp) {
      Breakpoint.tight => (tight ?? compact)(context),
      Breakpoint.compact => compact(context),
      Breakpoint.medium => (medium ?? compact)(context),
      Breakpoint.expanded => (expanded ?? medium ?? compact)(context),
    };
  }
}
