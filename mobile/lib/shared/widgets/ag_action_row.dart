import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

// ============================================================================
// AMAL QATORI — safar ekranidagi ikkilamchi amallar (qo'ng'iroq / xabar /
// ulashish / bekor qilish).
//
// Muammo: bu amallar ilgari har ekranda boshqacha ko'rinardi — biror joyda
// `TextButton`, boshqa joyda ikonka, uchinchi joyda to'liq kenglikdagi
// tugma. Natijada "bekor qilish" ba'zan asosiy CTA bilan bir xil vaznda
// chiqib, tasodifan bosiladigan bo'lib qolardi.
//
// Yandex Go tuzilmasi bu yerda aniq javob beradi: bir xil vaznli amallar
// TENG KENGLIKDA yonma-yon turadi, ikonka ustida — yozuv ostida. Teng
// kenglik "bularning hammasi bir darajadagi tanlov" degan ma'noni
// kompozitsiyaning o'zi orqali beradi.
//
// NEGA ASOSIY CTA EMAS: fon `kSurface`, to'ldirilgan yashil emas. Safar
// ekranida asosiy harakat allaqachon bor ("Safarni boshlash", "Yetib
// keldim") — bu qator undan past darajada turishi kerak, aks holda ikkita
// "asosiy" tugma raqobatlashadi.
//
// NEGA CHEGARA BOR: `kSurface` (oq) ilova foni `kBackground` ustida atigi
// 1.04:1 — tugmaning cheti ko'rinmaydi. WCAG 1.4.11 komponentni ANIQLASH
// uchun 3:1 talab qiladi, shuning uchun `kLineInteractive` chegarasi
// chiziladi (`kLine` emas — u 1.22:1 bilan bezak ajratkichi).
// ============================================================================

/// Qatordagi bitta amal.
///
/// `onTap` `null` bo'lsa amal vaqtincha mavjud emas (masalan safar
/// boshlanmaguncha "Ulashish") — tugma o'z o'rnida qoladi, lekin bosilmaydi.
/// Yo'qolib qolmasligi muhim: qator elementlari joyini o'zgartirsa,
/// foydalanuvchi mushak xotirasiga tayangan holda noto'g'ri tugmani bosadi.
@immutable
class AgActionItem {
  const AgActionItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;

  /// Ikonka ostidagi yozuv — MAJBURIY. Telefon ikonasi yolg'iz o'zi
  /// "haydovchiga qo'ng'iroq" ni ham, "yordam xizmati" ni ham anglatishi
  /// mumkin; qaysi biri ekanini faqat yozuv ayta oladi.
  final String label;

  final VoidCallback? onTap;

  /// Buzg'unchi amal — bekor qilish, o'chirish. Yozuv va ikonka
  /// `kErrorDeep` ga o'tadi (oq ustida 6.47:1).
  ///
  /// ⚠️ CHAQIRUVCHINING MAS'ULIYATI: buzg'unchi element eng ko'p
  /// bosiladigan amal yonida turmasligi kerak. "Qo'ng'iroq" bilan "Bekor
  /// qilish" yonma-yon bo'lsa, harakatdagi qo'l bittasini bosmoqchi bo'lib
  /// ikkinchisiga tegadi — bu qaytarib bo'lmaydigan xato. Buzg'unchi
  /// elementni qatorning oxiriga qo'ying yoki umuman alohida chiqaring.
  /// Rang bu xatodan saqlamaydi: rangni ajratmaydigan foydalanuvchi uchun
  /// yagona farq — ikonka shakli va yozuv.
  final bool destructive;
}

/// Teng kenglikdagi ikonali amal tugmalari qatori.
///
/// ```dart
/// AgActionRow(
///   items: [
///     AgActionItem(icon: Icons.call_rounded, label: 'Qo\'ng\'iroq', onTap: _call),
///     AgActionItem(icon: Icons.chat_bubble_rounded, label: 'Xabar', onTap: _chat),
///     AgActionItem(icon: Icons.ios_share_rounded, label: 'Ulashish', onTap: _share),
///     AgActionItem(
///       icon: Icons.close_rounded,
///       label: 'Bekor qilish',
///       onTap: _cancel,
///       destructive: true,
///     ),
///   ],
/// )
/// ```
class AgActionRow extends StatelessWidget {
  const AgActionRow({
    super.key,
    required this.items,
    this.driver = false,
  });

  final List<AgActionItem> items;

  /// Haydovchi ilovasi rejimi — tugma balandligi 52dp dan 60dp ga chiqadi.
  ///
  /// NEGA HAYDOVCHIGA KATTAROQ: yo'lovchi telefonni tinch holatda, ikki
  /// qo'llab ushlab turadi; haydovchi esa HARAKATDA — mashina tebranadi,
  /// qo'lda qo'lqop bo'lishi mumkin, quyosh aksi ekranni yuvib yuboradi va
  /// nigoh yo'ldan bir soniyaga uziladi. Shu sharoitda 48dp minimal
  /// nishon yetarli emas: teginish nishoni kamida 56dp bo'lishi kerak.
  /// 60dp — shu chegaradan yuqorida, ya'ni bir marta tegishda tushadi va
  /// haydovchi ikkinchi urinish uchun yo'ldan ko'z uzmaydi.
  final bool driver;

  /// Yo'lovchi o'lchami.
  static const double passengerHeight = 52;

  /// Haydovchi o'lchami — sababi `driver` izohida.
  static const double driverHeight = 60;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final height = driver ? driverHeight : passengerHeight;

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: kSpace2),
          Expanded(child: _AgActionButton(item: items[i], height: height)),
        ],
      ],
    );
  }
}

/// Ikonka o'lchami. Yozuv bilan birga 52dp ichiga sig'ishi kerak, shuning
/// uchun shkaladagi 22dp standart ikonkadan kichik.
const double _kActionIconSize = 17;

/// Yozuv o'lchami. Shkaladagi eng kichik token `kFontMicro` (11) dan ham
/// past, shuning uchun tokenga aylantirilmadi — shkalaga `kFontNano` (10)
/// qo'shilsa, shu ikkala konstanta o'rniga token ishlatilsin.
/// w700 og'irlik va `kInkMuted` (5.47:1) buni o'qilishli ushlab turadi.
const double _kActionLabelSize = 10;

class _AgActionButton extends StatelessWidget {
  const _AgActionButton({required this.item, required this.height});

  final AgActionItem item;
  final double height;

  @override
  Widget build(BuildContext context) {
    final enabled = item.onTap != null;

    // O'chirilgan holat `kInkSubtle` — u 3.67:1 bilan oddiy matn uchun
    // yetarli emas, lekin o'chirilgan boshqaruvlar WCAG kontrast talabidan
    // ozod va aynan "bosilmaydi" degan signalni beradi.
    final foreground = !enabled
        ? kInkSubtle
        : item.destructive
            ? kErrorDeep
            : kInkMuted;

    return AppPressable(
      onTap: item.onTap,
      semanticsLabel: item.label,
      // Tugma kichik — 0.97 masshtab sezilmaydi.
      pressedScale: 0.94,
      // Buzg'unchi amalda kuchliroq haptika: barmoq ko'tarilishidan oldin
      // "bu boshqa narsa" degan jismoniy ogohlantirish beradi.
      haptic: item.destructive ? AppHapticLevel.impact : AppHapticLevel.tap,
      // O'z balandligimiz (52/60) allaqachon 48dp dan katta — `AppPressable`
      // ning qo'shimcha `ConstrainedBox` i ortiqcha qatlam bo'lardi.
      minTapTarget: false,
      child: Container(
        // Qat'iy balandlik EMAS, minimal: tizim shrifti kattalashtirilganda
        // yozuv qirqilib ketmasligi uchun quti o'sishga haqli.
        constraints: BoxConstraints(minHeight: height),
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace1,
          vertical: kSpace2,
        ),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusMd),
          border: Border.all(color: kLineInteractive, width: 1.5),
        ),
        // Yorliqni `AppPressable` semantikasi allaqachon o'qiydi — ichkarisi
        // qo'shilsa, ekran o'quvchi nomni ikki marta takrorlaydi.
        child: ExcludeSemantics(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(item.icon, size: _kActionIconSize, color: foreground),
              const SizedBox(height: kSpace1),
              // BIR QATOR + ellipsis: to'rtta amal 360dp ekranda ~76dp
              // qutiga tushadi, shrift kattalashtirilganda uzun yorliq
              // ("Bekor qilish") qirqiladi. Ikkinchi qatorga o'tkazish
              // qatorni qiyshaytirardi, shuning uchun qirqilishga yo'l
              // qo'yiladi — lekin ma'no yo'qolmaydi: `AppPressable`
              // semantikasi TO'LIQ nomni o'qiydi va ikonka shakli
              // ikkinchi zaxira signal bo'lib qoladi.
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: _kActionLabelSize,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                  color: foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
