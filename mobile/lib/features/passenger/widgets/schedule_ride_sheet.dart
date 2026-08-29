import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

/// Backend `SCHEDULED_MIN_LEAD_MINUTES` bilan bir xil bo'lishi SHART.
///
/// Bu yerdagi qiymat kichikroq bo'lsa, tanlagich foydalanuvchiga server rad
/// etadigan slotni taklif qilardi — ya'ni tanlash mumkin, buyurtma qilish
/// mumkin emas.
const int kScheduleMinLeadMinutes = 30;

/// Backend `SCHEDULED_MAX_AHEAD_DAYS`. Kun chiplari shundan oshmaydi.
const int kScheduleMaxAheadDays = 14;

/// Vaqt slotlari qadami.
const int kScheduleSlotMinutes = 15;

/// Kun chiplari soni (bugun + keyingi 6 kun). `kScheduleMaxAheadDays` dan
/// kichik: realistik holda odam bir haftadan uzoqqa taksi rejalashtirmaydi,
/// va uzun ro'yxat tanlashni qiyinlashtiradi.
const int kScheduleDayCount = 7;

/// Safarni rejalashtirish tanlagichi.
///
/// `showTimePicker`/`showDatePicker` ATAYLAB ISHLATILMAGAN: ular Material
/// dialog temasini olib keladi, `app_theme.dart` da esa
/// `timePickerTheme`/`datePickerTheme` sozlanmagan — natijada tanlagich
/// loyihaning mint dizayn tizimidan butunlay ajralib turardi.
///
/// `Future<DateTime?>` qaytaradi: `null` — foydalanuvchi voz kechdi yoki
/// "Hozir" ni tanladi.
class ScheduleRideSheet extends StatefulWidget {
  const ScheduleRideSheet({
    super.key,
    this.initialValue,
    this.now,
  });

  /// Oldin tanlangan vaqt — qayta ochilganda o'sha kun/slot ustida turadi.
  final DateTime? initialValue;

  /// ATAYLAB inject qilinadi — testda soatga bog'lanmaslik uchun.
  final DateTime? now;

  @override
  State<ScheduleRideSheet> createState() => _ScheduleRideSheetState();

  /// Sheetni ochadi va tanlangan vaqtni qaytaradi.
  static Future<DateTime?> show(
    BuildContext context, {
    DateTime? initialValue,
    DateTime? now,
  }) {
    return showModalBottomSheet<DateTime>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => ScheduleRideSheet(initialValue: initialValue, now: now),
    );
  }
}

class _ScheduleRideSheetState extends State<ScheduleRideSheet> {
  late final DateTime _now;
  late DateTime _selectedDay;
  DateTime? _selectedSlot;

  @override
  void initState() {
    super.initState();
    _now = widget.now ?? DateTime.now();
    final initial = widget.initialValue;
    _selectedDay = initial != null
        ? DateTime(initial.year, initial.month, initial.day)
        : DateTime(_now.year, _now.month, _now.day);
    _selectedSlot = initial;
  }

  /// Eng erta ruxsat etilgan lahza. Undan oldingi slotlar o'chiriladi.
  DateTime get _earliest =>
      _now.add(const Duration(minutes: kScheduleMinLeadMinutes));

  DateTime get _latest => _now.add(const Duration(days: kScheduleMaxAheadDays));

  List<DateTime> get _days => List.generate(
        kScheduleDayCount,
        (i) => DateTime(_now.year, _now.month, _now.day).add(Duration(days: i)),
      );

  /// Tanlangan kundagi TANLASH MUMKIN bo'lgan slotlar.
  ///
  /// ⚠️ O'tgan va juda yaqin slotlar ro'yxatga UMUMAN KIRMAYDI, "o'chirilgan"
  /// holda ko'rsatilmaydi. Ikkinchi variant ham tanlashni to'sardi, lekin
  /// bugungi kunda ro'yxat 00:00 dan boshlanib, foydalanuvchi birinchi
  /// yaroqli vaqtgacha o'nlab o'lik katakchani aylantirib o'tishi kerak
  /// bo'lardi — ya'ni to'g'ri, lekin foydalanish uchun og'ir.
  ///
  /// Kech tunda ro'yxat BO'SH bo'lishi mumkin (masalan 23:50 da minimal
  /// zaxira ertangi kunga o'tib ketadi) — bu holat UI da alohida
  /// ishlanadi.
  List<DateTime> get _slots {
    final dayEnd = _selectedDay.add(const Duration(days: 1));
    var cursor = _selectedDay;

    // Birinchi yaroqli slotgacha "sakraymiz": 15 daqiqalik panjaraga
    // yaxlitlangan holda.
    if (_earliest.isAfter(cursor)) {
      final minutesIn = _earliest.difference(_selectedDay).inMinutes;
      final steps = (minutesIn / kScheduleSlotMinutes).ceil();
      cursor = _selectedDay.add(Duration(minutes: steps * kScheduleSlotMinutes));
    }

    final slots = <DateTime>[];
    while (cursor.isBefore(dayEnd) && !cursor.isAfter(_latest)) {
      slots.add(cursor);
      cursor = cursor.add(const Duration(minutes: kScheduleSlotMinutes));
    }
    return slots;
  }

  bool _isSlotEnabled(DateTime slot) =>
      !slot.isBefore(_earliest) && !slot.isAfter(_latest);

  String _dayLabel(DateTime day) => Formatters.formatDayLabel(day, now: _now);

  @override
  Widget build(BuildContext context) {
    final selected = _selectedSlot;
    final canConfirm = selected != null && _isSlotEnabled(selected);

    return Container(
      decoration: const BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      padding: EdgeInsets.fromLTRB(
        context.gutter,
        kSpace3,
        context.gutter,
        kSpace5 + MediaQuery.of(context).padding.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sheet "tutqichi" — pastga sudrab yopish mumkinligini bildiradi.
          Center(
            child: ExcludeSemantics(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: kLineStrong,
                  borderRadius: BorderRadius.circular(kRadiusFull),
                ),
              ),
            ),
          ),
          const SizedBox(height: kSpace4),
          const Text(
            'Safarni rejalashtirish',
            style: TextStyle(
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          const SizedBox(height: kSpace2),
          const Text(
            "Haydovchi belgilangan vaqtdan 10 daqiqa oldin qidiriladi. "
            "Narx hozir qotiriladi va o'zgarmaydi.",
            style: TextStyle(
              fontSize: kFontLabel,
              fontWeight: FontWeight.w500,
              color: kInkMuted,
            ),
          ),
          const SizedBox(height: kSpace4),
          _buildDayStrip(),
          const SizedBox(height: kSpace4),
          _buildSlotGrid(),
          const SizedBox(height: kSpace4),
          _buildConfirmButton(canConfirm, selected),
          const SizedBox(height: kSpace2),
          _buildNowButton(),
        ],
      ),
    );
  }

  Widget _buildDayStrip() {
    return SizedBox(
      height: kMinTapTarget,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _days.length,
        separatorBuilder: (_, __) => const SizedBox(width: kSpace2),
        itemBuilder: (context, i) {
          final day = _days[i];
          final isSel = day == _selectedDay;
          return Semantics(
            button: true,
            selected: isSel,
            label: _dayLabel(day),
            excludeSemantics: true,
            child: AppPressable(
              onTap: () => setState(() => _selectedDay = day),
              pressedScale: 0.95,
              haptic: AppHapticLevel.select,
              minTapTarget: false,
              child: Container(
                constraints: const BoxConstraints(minHeight: kMinTapTarget),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                decoration: BoxDecoration(
                  color: isSel ? kMintTint : kSurface2,
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  border: Border.all(
                    color: isSel ? kPrimary : Colors.transparent,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  _dayLabel(day),
                  style: TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w700,
                    color: isSel ? kPrimary : kInk,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSlotGrid() {
    final slots = _slots;

    if (slots.isEmpty) {
      // Kech tunda bugungi kunda vaqt qolmagan — boshi berk ko'cha emas,
      // keyingi qadam aytiladi.
      return Container(
        height: kMinTapTarget * 2,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: kSpace4),
        decoration: BoxDecoration(
          color: kSurface2,
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        child: const Text(
          "Bu kun uchun vaqt qolmadi — keyingi kunni tanlang.",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: kFontBody,
            fontWeight: FontWeight.w600,
            color: kInkMuted,
          ),
        ),
      );
    }

    return SizedBox(
      // Ekranning yarmidan oshmasin — sheet CTA bilan birga sig'ishi kerak.
      height: MediaQuery.of(context).size.height * 0.32,
      child: GridView.builder(
        padding: EdgeInsets.zero,
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 96,
          mainAxisSpacing: kSpace2,
          crossAxisSpacing: kSpace2,
          // 48dp balandlik — `kMinTapTarget` bilan bir xil.
          mainAxisExtent: kMinTapTarget,
        ),
        itemCount: slots.length,
        itemBuilder: (context, i) {
          final slot = slots[i];
          // Ro'yxatdagi har bir slot allaqachon yaroqli; tekshiruv
          // saqlanadi, chunki `_slots` mantiqi kelajakda o'zgarishi mumkin.
          final enabled = _isSlotEnabled(slot);
          final isSel = _selectedSlot == slot;
          final label = Formatters.formatTime(slot);

          return Semantics(
            button: true,
            enabled: enabled,
            selected: isSel,
            label: label,
            excludeSemantics: true,
            child: AppPressable(
              // O'tgan / juda yaqin slot bosilmaydi: backend uni baribir
              // rad etadi, va rad etilgan tanlovni ko'rsatish yolg'on
              // ta'sir beradi.
              onTap: enabled ? () => setState(() => _selectedSlot = slot) : null,
              pressedScale: 0.94,
              haptic: AppHapticLevel.select,
              minTapTarget: false,
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isSel ? kMintTint : kSurface2,
                  borderRadius: BorderRadius.circular(kRadiusSm),
                  border: Border.all(
                    color: isSel ? kPrimary : Colors.transparent,
                    width: 1.5,
                  ),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: kFontBody,
                    fontWeight: FontWeight.w700,
                    // O'chirilgan slot `kInkSubtle` — o'qiladi, lekin
                    // "bu yerda emas" deb turadi.
                    color: !enabled
                        ? kInkSubtle
                        : isSel
                            ? kPrimary
                            : kInk,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildConfirmButton(bool canConfirm, DateTime? selected) {
    return Semantics(
      button: true,
      enabled: canConfirm,
      child: AppPressable(
        onTap: canConfirm ? () => Navigator.of(context).pop(selected) : null,
        haptic: AppHapticLevel.impact,
        pressedScale: 0.98,
        minTapTarget: false,
        child: Container(
          width: double.infinity,
          height: kControlHeight,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: canConfirm ? kGradientCta : null,
            color: canConfirm ? null : kPrimaryDisabled,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: canConfirm ? kShadowCta : null,
          ),
          child: Text(
            canConfirm && selected != null
                ? Formatters.formatScheduleLabel(selected, now: _now)
                : 'Vaqtni tanlang',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: kFontH3,
              fontWeight: FontWeight.w800,
              color: canConfirm ? kOnPrimary : kInkSubtle,
            ),
          ),
        ),
      ),
    );
  }

  /// "Hozir" ga qaytarish — `null` qaytaradi, ya'ni rejalashtirish bekor.
  Widget _buildNowButton() {
    return Semantics(
      button: true,
      child: AppPressable(
        onTap: () => Navigator.of(context).pop(),
        haptic: AppHapticLevel.tap,
        minTapTarget: false,
        child: Container(
          width: double.infinity,
          height: kControlHeightSm,
          alignment: Alignment.center,
          child: const Text(
            'Hozir buyurtma qilaman',
            style: TextStyle(
              fontSize: kFontBody,
              fontWeight: FontWeight.w700,
              color: kInkMuted,
            ),
          ),
        ),
      ),
    );
  }
}
