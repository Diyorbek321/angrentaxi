import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// VARIANT CHIPLARI — to'liq qatorlar O'RNIGA bitta gorizontal qator.
//
// Muammo: to'lov usuli, belgilangan narx, promokod va haydovchiga izoh —
// har biri alohida "ikonka + sarlavha + qiymat + chevron" qatori edi. To'rtta
// qator sheet balandligining yarmini yeb qo'yardi va foydalanuvchi narx bilan
// CTA ni BIRGA ko'rolmasdi (asosiy qaror ikkalasiga birdan qaraganda
// qabul qilinadi). Yandex Go bu variantlarni bitta skroll qatoriga siqadi:
// eng ko'p ishlatiladigani birinchi, qolganlari barmoq ostida.
//
// ⚠️ Chip VIZUAL balandligi 34dp — bu WCAG 2.5.8 (48dp) ga zid emas:
// tegish maydoni `AppPressable` orqali 48dp gacha kengaytiriladi va faqat
// ichkaridagi quti kichik qoladi. Shuning uchun chip `SizedBox(height: 34)`
// ga o'ralmaydi — `Align(heightFactor: 1)` quti o'lchamini tegish
// maydonidan AJRATADI, aks holda 34dp li quti 48dp ga cho'zilib ketardi.
//
// ⚠️ Nofaol chipda chegara MAJBURIY: foni `kSurface` bo'lgani uchun oq sheet
// ustida chegarasiz chip umuman ko'rinmaydi. Bu yerda `kLine` (1.22:1)
// yaramaydi — WCAG 1.4.11 komponentni ANIQLASH uchun 3:1 talab qiladi,
// shuning uchun `kLineInteractive` (oq ustida 3.67:1).
//
// Ekranlardagi yopiq `_PaymentChip` shu widgetning ajdodi. Farqi: ikonka
// ixtiyoriy, o'chirilgan holat bor, chegara aniqlanadigan (`kLineInteractive`)
// va yorliq o'rniga barqaror `id` qaytariladi.
// ============================================================================

/// Ixcham chip balandligi — 34dp.
///
/// Shkalada (`kControlHeight` 54, `kControlHeightSm` 48) bu o'lcham yo'q,
/// chunki u boshqaruv emas, IKKILAMCHI variant belgisi: qator sheet
/// ichida "ikkinchi darajali" bo'lib turishi kerak. Balandlik `minHeight`
/// sifatida qo'llanadi — tizim shrifti kattalashtirilganda chip o'sadi,
/// matn kesilmaydi.
const double _kChipMinHeight = 34;

/// Chegara qalinligi barcha holatda BIR XIL: faol/nofaol almashganda
/// 1dp farq butun qatorni siljitib yuborardi.
const double _kChipBorderWidth = 1.5;

const double _kChipIconSize = 16;

/// Chip kaliti — chaqiruvchi va integratsiya testlari chipni `id` bo'yicha
/// topadi. Kalit widget ichida YASHIRILMAYDI: yashirin bo'lsa, ekran testi
/// chipni yorlig'i bo'yicha qidirishga majbur bo'lardi va yorliq
/// tarjimasi o'zgarishi bilan test sinardi.
ValueKey<String> agOptionChipKey(String id) =>
    ValueKey<String>('ag-option-chip-$id');

/// Bitta variant chipining ma'lumoti.
@immutable
class AgOptionChipItem {
  const AgOptionChipItem({
    required this.id,
    required this.label,
    this.icon,
    this.active = false,
    this.enabled = true,
    this.semanticsLabel,
  });

  /// `onTap` ga qaytariladigan BARQAROR kalit. Yorliq bo'yicha taqqoslash
  /// mumkin emas — u tarjima va formatlash bilan o'zgaradi
  /// ("Hozir" → "14:30", "Naqd" → "Наличные").
  final String id;

  final String label;

  /// Ixtiyoriy. "Promokod" yoki "Izoh" kabi chiplar ikonkasiz ham
  /// tushunarli va tor ekranda (320dp) qatorda joy tejaydi.
  final IconData? icon;

  final bool active;

  /// O'chirilgan variant — masalan karta biriktirilmagan. Yashirish
  /// o'rniga ko'rsatib o'chiriladi: foydalanuvchi variant BORLIGINI
  /// bilsin, faqat hozir tanlab bo'lmasin.
  final bool enabled;

  /// Yorliq yolg'iz o'zi ma'no bermaganda ("14:30" → "Safar vaqti 14:30").
  final String? semanticsLabel;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AgOptionChipItem &&
          other.id == id &&
          other.label == label &&
          other.icon == icon &&
          other.active == active &&
          other.enabled == enabled &&
          other.semanticsLabel == semanticsLabel;

  @override
  int get hashCode =>
      Object.hash(id, label, icon, active, enabled, semanticsLabel);

  AgOptionChipItem copyWith({
    String? id,
    String? label,
    IconData? icon,
    bool? active,
    bool? enabled,
    String? semanticsLabel,
  }) =>
      AgOptionChipItem(
        id: id ?? this.id,
        label: label ?? this.label,
        icon: icon ?? this.icon,
        active: active ?? this.active,
        enabled: enabled ?? this.enabled,
        semanticsLabel: semanticsLabel ?? this.semanticsLabel,
      );
}

/// Gorizontal skroll qatoridagi variant chiplari.
///
/// Holatni CHAQIRUVCHI saqlaydi — widget faqat bosilgan chip `id` sini
/// qaytaradi, ro'yxatni o'zi o'zgartirmaydi (o'zgarmas ma'lumot oqimi).
///
/// ```dart
/// AgOptionChips(
///   items: [
///     AgOptionChipItem(
///       id: 'cash',
///       label: 'Naqd',
///       icon: Icons.payments_rounded,
///       active: method == 'cash',
///     ),
///     const AgOptionChipItem(id: 'promo', label: 'Promokod'),
///   ],
///   onTap: (id) => setState(() => method = id),
/// )
/// ```
class AgOptionChips extends StatelessWidget {
  const AgOptionChips({
    super.key,
    required this.items,
    required this.onTap,
    this.padding = EdgeInsets.zero,
    this.spacing = kSpace2,
  });

  final List<AgOptionChipItem> items;

  /// Bosilgan chipning `id` si.
  final ValueChanged<String> onTap;

  /// Standart holatda NOL: qator odatda allaqachon gutter'i bor sheet
  /// ichida turadi. Chetdan-chetga skroll kerak bo'lsa (chiplar ekran
  /// chekkasidan "chiqib" ketsin), `context.gutterPadding` bering.
  final EdgeInsetsGeometry padding;

  final double spacing;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    // Skroll — chiplar soni va yorliq uzunligi oldindan noma'lum (promokod
    // nomi, formatlangan vaqt). Qat'iy `Row` 320dp ekranda toshib ketardi.
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: padding,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) SizedBox(width: spacing),
            _AgOptionChip(
              // Kalit ro'yxat bolasida: chiplar tartibi o'zgarganda
              // (masalan karta biriktirilib, u boshiga chiqqanda)
              // Flutter elementni indeks bo'yicha emas, `id` bo'yicha
              // moslashtiradi va bosilish animatsiyasi boshqa chipga
              // "yopishib" qolmaydi.
              key: agOptionChipKey(items[i].id),
              item: items[i],
              onTap: onTap,
            ),
          ],
        ],
      ),
    );
  }
}

class _AgOptionChip extends StatelessWidget {
  const _AgOptionChip({
    super.key,
    required this.item,
    required this.onTap,
  });

  final AgOptionChipItem item;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = item.enabled;
    final active = item.active;

    // O'chirilgan komponentga WCAG 1.4.11 kontrast talabi qo'yilmaydi —
    // aksincha, bo'shashgan `kLine` chegarasi va `kSurface2` foni
    // "bu chip hozir ishlamaydi" degan vizual signalning o'zi.
    final background =
        !enabled ? kSurface2 : (active ? kMintTint : kSurface);
    final borderColor =
        !enabled ? kLine : (active ? kPrimary : kLineInteractive);
    final labelColor = !enabled ? kInkSubtle : (active ? kPrimary : kInk);
    final iconColor = !enabled ? kInkSubtle : (active ? kPrimary : kInkMuted);

    return Semantics(
      button: true,
      selected: active,
      enabled: enabled,
      label: item.semanticsLabel ?? item.label,
      // `excludeSemantics` ichkaridagi tugma tugunini o'chirgani uchun
      // bosish HARAKATI shu yerda qayta e'lon qilinadi — aks holda ekran
      // o'quvchi chipni ko'radi-yu, uni faollashtira olmaydi.
      onTap: enabled ? () => onTap(item.id) : null,
      excludeSemantics: true,
      child: AppPressable(
        onTap: enabled ? () => onTap(item.id) : null,
        // Tarif/filtr almashtirish "tanlov o'zgardi" haptikasi bilan
        // beriladi — oddiy `tap` dan farqli, bu holat almashganini bildiradi.
        haptic: AppHapticLevel.select,
        // Chip kichik: 0.97 sezilmaydi, 0.9 esa qatorda "sakrab" ko'rinadi.
        pressedScale: 0.96,
        child: Align(
          // `heightFactor` quti balandligini 48dp li tegish maydonidan
          // ajratadi; `widthFactor` esa cheksiz kenglikdagi skroll qatorida
          // Align'ning butun bo'shliqni egallab olishini to'xtatadi.
          widthFactor: 1,
          heightFactor: 1,
          child: AnimatedContainer(
            duration: AppMotion.duration(context, AppMotion.fast),
            curve: AppMotion.standard,
            constraints: const BoxConstraints(minHeight: _kChipMinHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: kSpace4,
              vertical: kSpace1,
            ),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(kRadiusFull),
              border: Border.all(color: borderColor, width: _kChipBorderWidth),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (item.icon != null) ...[
                  Icon(item.icon, size: _kChipIconSize, color: iconColor),
                  const SizedBox(width: kSpace2),
                ],
                // Matn/ikona rangi ANIMATSIYASIZ almashadi (fon esa 150ms
                // da yumshoq o'tadi): oraliq rang qiymatlari kontrastni
                // vaqtincha AA dan pastga tushiradi.
                Text(
                  item.label,
                  // Chip — IXCHAM belgi: uzun yoki qatorga bo'lingan yorliq
                  // qator balandligini o'zgartirib, yonidagi chiplarni
                  // vertikal siljitib yuborardi.
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.fs(kFontLabel),
                    fontWeight: FontWeight.w600,
                    color: labelColor,
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
