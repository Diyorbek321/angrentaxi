import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// XIZMAT CHIPLARI — sheet tepasidagi gorizontal tanlagich.
//
// Bu Yandex Go tuzilmasining eng tanib olinadigan elementi: xarita ustidagi
// panel tepasida bitta qator chip turadi va foydalanuvchi ilovaning qaysi
// "olamida" ekanini shu qatordan o'qiydi. Ilovamizda bu rolni superapp
// plitkalari bajarardi — ular ekranning yarmini egallardi va tanlangan
// xizmat panel ochilgach ko'rinmay qolardi.
//
// UCH QAROR, UCHTASI HAM SABABLI:
//
// 1. YORLIQLAR ICHKARIDA YO'Q. Xizmatlar ro'yxati serverdan keladi (yangi
//    vertikal qo'shilishi, shahar bo'yicha o'chirilishi mumkin), shuning
//    uchun bu widget "Taksi/Yuk/Ovqat/Market" ni BILMAYDI — chaqiruvchi
//    beradi. Shu sababli `icon` ham ixtiyoriy: server bilmagan xizmat uchun
//    mos ikonka bo'lmasligi mumkin, chip esa faqat matn bilan ham to'liq.
//
// 2. TANLANGAN = INK, MINT EMAS. Tanlangan chip `kInk` fon + oq matn
//    (17.50:1) bilan chiziladi. Mint to'ldirish ustida oq matn 2.12:1
//    berardi, `kPrimary` esa butun ilovada CTA ma'nosini tashiydi —
//    tanlagich CTA emas, shuning uchun neytral eng to'q qatlam olinadi.
//    Tanlanmagan chip `kSurface` — u sheet foni bilan bir xil, demak uni
//    faqat CHEGARA ajratadi: `kLineInteractive` (3.67:1, WCAG 1.4.11).
//    `kLine` (1.22:1) bu yerda ko'rinmasdi.
//
// 3. RANG BIRDANIGA ALMASHADI. Fon va matn rangi orasida animatsiya yo'q:
//    to'q↔och oraliqdagi har bir kadr kontrast talabidan o'tishi kerak
//    bo'lardi, oraliq ranglar esa o'tmaydi. Bosilish javobini
//    `AppPressable` ning masshtabi beradi — u xavfsiz animatsiya.
// ============================================================================

/// Chipning VIZUAL balandligi (Yandex Go o'lchami).
const double _kChipHeight = 36;

/// Vizual chip 36dp, lekin tegish maydoni `kMinTapTarget` (48dp) dan kichik
/// bo'lishi mumkin emas — farq vertikal padding sifatida beriladi
/// (6 + 36 + 6 = 48).
///
/// `AppPressable.minTapTarget` bu yerda ishlatilmaydi: u `ConstrainedBox`
/// bilan chipning O'ZINI 48dp ga cho'zib yuborardi va pill 36dp bo'lmasdi.
const double _kChipTapPadding = (kMinTapTarget - _kChipHeight) / 2;

/// Chegara qalinligi tanlangan va tanlanmagan holatda BIR XIL: 1dp farq ham
/// chip kengligini o'zgartirib, qatordagi qolgan chiplarni siljitib yuborardi.
const double _kChipBorderWidth = 1.5;

/// Yorliq oldidagi ikonka o'lchami — matndan (13dp) sal katta, lekin 36dp li
/// chipni ichkaridan cho'zib yubormaydigan darajada.
const double _kChipIconSize = 18;

/// Chip kaliti — chaqiruvchi va testlar chipni id bo'yicha topadi.
ValueKey<String> agServiceChipKey(String id) =>
    ValueKey<String>('ag-service-chip-$id');

/// Bitta xizmat chipi uchun ma'lumot. Serverdan kelgan javob shu turga
/// o'giriladi — widget hech qanday standart ro'yxatga ega emas.
@immutable
class AgServiceChipItem {
  const AgServiceChipItem({
    required this.id,
    required this.label,
    this.icon,
  });

  /// Barqaror identifikator: `onSelect` shuni qaytaradi va tanlov shu
  /// bo'yicha solishtiriladi. Yorliq tarjima qilinadi, id — yo'q.
  final String id;

  /// Ko'rinadigan yozuv (masalan "Taksi", "Yuk").
  final String label;

  /// Yorliq oldidagi ikonka. Ixtiyoriy — 1-izohga qarang.
  final IconData? icon;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AgServiceChipItem &&
          other.id == id &&
          other.label == label &&
          other.icon == icon;

  @override
  int get hashCode => Object.hash(id, label, icon);
}

/// Sheet tepasidagi gorizontal xizmat tanlagichi.
///
/// ```dart
/// AgServiceChips(
///   items: services.map((s) => AgServiceChipItem(id: s.code, label: s.name)).toList(),
///   selectedId: activeService,
///   onSelect: (id) => setState(() => activeService = id),
/// )
/// ```
class AgServiceChips extends StatelessWidget {
  const AgServiceChips({
    super.key,
    required this.items,
    required this.selectedId,
    required this.onSelect,
    this.padding,
  });

  /// Ko'rsatiladigan xizmatlar — tartibi ham chaqiruvchidan (server
  /// odatda eng ommabop xizmatni birinchi qaytaradi).
  final List<AgServiceChipItem> items;

  /// Tanlangan xizmat id si. `null` — hech biri tanlanmagan (masalan
  /// ro'yxat hali yuklanmagan yoki tanlov tozalangan).
  final String? selectedId;

  /// Tanlov o'zgarganda chaqiriladi. Widget o'z holatini saqlamaydi —
  /// tanlov ekran/provider darajasida turadi, chunki u xarita va sheet
  /// mazmuniga ham ta'sir qiladi.
  final ValueChanged<String> onSelect;

  /// Skroll mazmunining chetki bo'shlig'i. Standart — ekran gutteri.
  ///
  /// Padding skroll KONTENTIGA beriladi, widgetga emas: shunda chiplar
  /// ekran chetiga tegib "kesilib" ketadi va yana chip borligi ko'rinadi.
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    // Server bo'sh ro'yxat qaytarsa, sheet tepasida bo'sh joy qolmaydi.
    if (items.isEmpty) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: padding ?? EdgeInsets.symmetric(horizontal: context.gutter),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: kSpace2),
            _AgServiceChip(
              key: agServiceChipKey(items[i].id),
              item: items[i],
              selected: items[i].id == selectedId,
              onTap: () => onSelect(items[i].id),
            ),
          ],
        ],
      ),
    );
  }
}

class _AgServiceChip extends StatelessWidget {
  const _AgServiceChip({
    super.key,
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final AgServiceChipItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Tanlangan: oq matn `kInk` ustida 17.50:1.
    // Tanlanmagan: `kInkMuted` oq ustida 5.47:1 — ikkalasi ham AA.
    final fg = selected ? kOnPrimary : kInkMuted;

    return Semantics(
      button: true,
      selected: selected,
      // Bir vaqtda faqat bitta xizmat tanlanadi — ekran o'quvchi buni
      // ro'yxatdagi tanlov sifatida e'lon qiladi, alohida tugma emas.
      inMutuallyExclusiveGroup: true,
      label: item.label,
      // `excludeSemantics` ichkaridagi `AppPressable` tugma tugunini
      // o'chiradi — shuning uchun bosish HARAKATI shu yerda qayta e'lon
      // qilinadi, aks holda ekran o'quvchi chipni ko'radi-yu, ikki marta
      // bosib uni tanlay olmaydi.
      onTap: onTap,
      excludeSemantics: true,
      child: AppPressable(
        onTap: onTap,
        // Tanlov o'zgarishi uchun "select" naqshi (iOS'da selectionClick,
        // Android'da lightImpact) — `AppHaptics.select()`.
        haptic: AppHapticLevel.select,
        pressedScale: 0.96,
        minTapTarget: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: _kChipTapPadding),
          child: Container(
            // `minHeight`, aniq balandlik emas: foydalanuvchi tizim shrift
            // o'lchamini kattalashtirsa chip o'sadi, matn kesilmaydi.
            constraints: const BoxConstraints(minHeight: _kChipHeight),
            padding: const EdgeInsets.symmetric(horizontal: kSpace4),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? kInk : kSurface,
              borderRadius: BorderRadius.circular(kRadiusFull),
              border: Border.all(
                // Tanlanmagan chip sheet foni bilan bir xil rangda —
                // uni faqat shu chegara ko'rsatib turadi (WCAG 1.4.11).
                color: selected ? kInk : kLineInteractive,
                width: _kChipBorderWidth,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (item.icon != null) ...[
                  Icon(item.icon, size: _kChipIconSize, color: fg),
                  const SizedBox(width: kSpace2),
                ],
                Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontSize: context.fs(kFontLabel),
                    // Tanlanganda ham qalinlik o'zgarmaydi: w600↔w800
                    // almashinuvi chip kengligini o'zgartirib, qatordagi
                    // qolgan chiplarni siljitib yuborardi.
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
