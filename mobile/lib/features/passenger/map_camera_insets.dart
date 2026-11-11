import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// TO'LDIRILGAN TO'RTBURCHAK (padded-fit) — xarita kamerasi uchun.
//
// Muammo: xarita ekranlarida sheet ekranning pastki uchdan birini doim
// yopib turadi, kamera esa marshrutni TO'LIQ ekranga moslaydi. Natijada
// marshrutning markazi sheet ostida qoladi — bu toifadagi eng keng
// tarqalgan xarita xatosi: foydalanuvchi safarini ko'rish uchun sheetni
// pastga surishi kerak bo'ladi.
//
// Yechim: kamera to'liq ekranga emas, OCHIQ maydonga moslanadi. Buning
// uchun har tomondan qancha joy band ekani hisoblanadi va MapLibre'ning
// `newLatLngBounds` paddingiga beriladi.
//
// ⚠️ NEGA SHU YERDA. `AppVectorMap.fitToContent` paddingni ICHKARIDA qat'iy
// saqlaydi (`left/right: 48, top: 96, bottom: 260`) va uni tashqaridan
// berish yo'li yo'q. O'sha faylga tegish bu vazifaning doirasidan tashqarida,
// shuning uchun ekranlar kamerani o'z kontrolleri orqali boshqaradi va
// hisobni shu yerdan oladi — ikkala yo'lovchi ekrani (bosh ekran va faol
// safar) bir xil qoidaga bo'ysunishi uchun.
// ============================================================================

/// `AdaptiveMapPanel` ning O'Z chromasi — panel kontenti ustidagi va
/// ostidagi, ekranda ko'rinadigan, lekin kontent balandligiga KIRMAYDIGAN
/// qism:
///   · `kSpace3` — panelning tepadagi ichki bo'shlig'i,
///   · 5dp       — sudrash dastagi,
///   · `kSpace4` — dastakdan keyingi bo'shliq,
///   · `kSpace8` — pastdagi, tizim jest paneli uchun qoldirilgan bo'shliq.
///
/// O'lchangan kontent balandligiga shu qo'shilsa, sheetning ekranda
/// egallagan to'liq balandligi chiqadi.
///
/// ⚠️ Bu qiymat `adaptive_map_panel.dart` dagi paddinglarga bog'liq. O'sha
/// panel ichki bo'shliqlarini o'zgartirsa, bu yerdagi hisob ham yangilanishi
/// kerak — aks holda marshrut sheet chetiga bir necha dp yaqin turib qoladi.
const double kMapPanelChromeHeight = kSpace3 + 5 + kSpace4 + kSpace8;

/// Kamera hech qachon ekranning bundan ko'p qismini "band" deb hisoblamaydi.
///
/// Sheet kontenti kutilmaganda o'sib ketsa (masalan tizim shrifti 2x),
/// padding ekran balandligidan oshib ketishi va MapLibre'ga bema'ni kamera
/// berilishi mumkin. Shunda xarita umuman noto'g'ri joyga qarab qoladi —
/// yarim ochiq maydon buzuq kameradan yaxshiroq.
const double _kMaxOccludedFraction = 0.6;

/// Panel/sheet ostida qolgan maydonni hisobga oluvchi kamera chetlari.
///
/// ```dart
/// final insets = MapCameraInsets.forPanel(context, panelContentHeight: h);
/// controller.animateCamera(
///   ml.CameraUpdate.newLatLngBounds(
///     bounds,
///     left: insets.left, top: insets.top,
///     right: insets.right, bottom: insets.bottom,
///   ),
/// );
/// ```
@immutable
class MapCameraInsets {
  const MapCameraInsets({
    required this.left,
    required this.top,
    required this.right,
    required this.bottom,
  });

  final double left;
  final double top;
  final double right;
  final double bottom;

  /// Joriy tartib bo'yicha chetlar.
  ///
  /// [panelContentHeight] — `AdaptiveMapPanel` ga berilgan kontentning
  /// O'LCHANGAN balandligi (chroma qo'shilmagan). `null` bo'lsa (hali
  /// o'lchanmagan) faqat minimal chet qoladi: noma'lum balandlikni taxmin
  /// qilgandan ko'ra, kamerani birinchi kadrda biroz keng olish yaxshiroq —
  /// o'lchov kelishi bilan qayta hisoblanadi.
  ///
  /// 720dp dan keng ekranda panel PASTDA emas, CHAPDA turadi
  /// (`AdaptiveMapPanel` shunday qiladi), shuning uchun band maydon ham
  /// vertikaldan gorizontalga o'tadi.
  factory MapCameraInsets.forPanel(
    BuildContext context, {
    double? panelContentHeight,
  }) {
    final media = MediaQuery.of(context);
    // Tepadan: xavfsiz maydon (status bar / o'yiq) + nafas olish uchun 16dp.
    // Shu yerda suzuvchi yuqori panel ham turadi.
    final top = media.padding.top + kSpace4;

    if (context.canSplitMapPanel) {
      // Yon panel: chap gutter + panel kengligi + o'ng gutter.
      final left = media.padding.left +
          context.gutter * 2 +
          context.sidePanelWidth +
          kSpace4;
      return MapCameraInsets(
        left: left,
        top: top,
        right: media.padding.right + kSpace4,
        bottom: media.padding.bottom + kSpace4,
      );
    }

    final maxBottom = media.size.height * _kMaxOccludedFraction;
    final bottom = panelContentHeight == null
        ? kSpace4
        : (panelContentHeight + kMapPanelChromeHeight + kSpace4)
            .clamp(kSpace4, maxBottom);

    return MapCameraInsets(
      left: kSpace4,
      top: top,
      right: kSpace4,
      bottom: bottom,
    );
  }

  /// BITTA nuqtani ochiq maydon markaziga olib chiqish uchun ekran siljishi
  /// (`CameraUpdate.scrollBy`).
  ///
  /// `newLatLngBounds` ikkita va undan ko'p nuqta uchun ishlaydi; joriy
  /// joylashuvga markazlashda esa chegara yo'q — u yerda kamera nuqtaga
  /// qaratiladi va keyin shu qadar surriladi.
  ///
  /// Ishorasi MapLibre hujjatidan: `scrollBy(dx, dy)` kamera nishonini
  /// ekran koordinatasida dx SHARQQA, dy JANUBGA suradi. Nishon janubga
  /// ketsa, xarita mazmuni ekranda YUQORIGA siljiydi — ya'ni nuqta sheet
  /// ustiga chiqadi. Shuning uchun sheet baland bo'lganda `dy` musbat.
  Offset get centeringScroll =>
      Offset((right - left) / 2, (bottom - top) / 2);
}
