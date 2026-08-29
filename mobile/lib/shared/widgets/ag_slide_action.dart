import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

// ============================================================================
// SURIB BAJARILADIGAN AMAL — haydovchining qaytarib bo'lmaydigan amali.
//
// ⚠️ NEGA BU KOMPONENT UMUMAN BOR: TASDIQ DIALOGI HIMOYA EMAS.
//
// Safarni yakunlash oldin `AlertDialog` orqali tasdiqlanardi: "Yakunlaysizmi?
// [Bekor qilish] [Yakunlash]". Bu naqsh stol usti ilovasidan kelgan va
// HARAKATDAGI avtomobilda teskari ishlaydi:
//
//   1. Modal ko'z-ko'rona yopiladi. Haydovchi tugmani bosadi, nigohini
//      yo'lga qaytaradi va ikkinchi marta ekranga qaramay "Yakunlash" ni
//      xotiradan bosadi — ya'ni dialog aslida hech narsani so'ramaydi,
//      faqat bitta qo'shimcha teginish qo'shadi.
//   2. Ikkala tugma ham TEGINISH nishoni — tasodifiy teginish (yo'l
//      chuquri, tormoz) ikkalasidan birini urishi mumkin. Ya'ni dialog
//      tasodifiy bajarilishdan HIMOYA QILMAYDI, uni ikki bosqichga
//      cho'zadi xolos.
//   3. Modal ekranni yopadi: xarita, manzil, SOS — hammasi bir zumda
//      yo'qoladi. Bu aynan xavfli lahzada eng yomon narsa.
//
// SURISH esa boshqacha fizika: uni tasodifan bajarib bo'lmaydi, chunki u
// UZUN va YO'NALTIRILGAN harakat talab qiladi (~70% masofa gorizontal
// bo'ylab). Tebranish, qo'lqop yoki tasodifiy teginish bunday harakatni
// hosil qila olmaydi. Ekran esa ochiq qoladi — haydovchi nima qilayotganini
// KO'RIB turadi.
//
// ⚠️ SURISH JESTI EKRAN O'QUVCHI UCHUN YOPIQ BO'LMASLIGI KERAK. Gorizontal
// sudrash TalkBack/VoiceOver foydalanuvchisiga umuman yetib bormaydi.
// Shuning uchun butun komponent `Semantics(button: true, onTap: ...)` ga
// o'raladi: ko'rmaydigan haydovchi uchun bu oddiy tugma bo'lib qoladi.
// Xavfsizlik jismoniy jestga bog'liq, bu esa faqat ko'z bilan
// boshqaradigan foydalanuvchiga tegishli chegara — yordamchi texnologiya
// orqali kelgan aktivatsiya allaqachon ataylab qilingan.
// ============================================================================

/// Surib bajariladigan amal — "Safarni yakunlash" kabi qaytarib bo'lmaydigan
/// haydovchi amallari uchun.
///
/// ```dart
/// AgSlideAction(
///   label: 'Safarni yakunlash',
///   onCompleted: _completeTrip,
///   enabled: !provider.isLoading,
/// )
/// ```
class AgSlideAction extends StatefulWidget {
  const AgSlideAction({
    super.key,
    required this.label,
    required this.onCompleted,
    this.enabled = true,
    this.icon = Icons.chevron_right_rounded,
  });

  /// Yo'lak markazidagi yozuv. Amalni TO'LIQ nomlashi kerak ("Safarni
  /// yakunlash"), chunki bu ham ekran o'quvchi uchun yagona yorliq.
  final String label;

  /// Surish tugallanganda chaqiriladi. Animatsiya tugashini KUTMAYDI —
  /// haydovchi barmog'ini ko'targan zahoti amal boshlanadi.
  final VoidCallback onCompleted;

  /// `false` bo'lganda surish ishlamaydi (masalan so'rov yuborilayotganda).
  /// Tugmacha o'z o'rnida qoladi — yo'qolib qolsa, panel balandligi
  /// sakraydi va qolgan nishonlar joyini o'zgartiradi.
  final bool enabled;

  /// Tugmachadagi ikonka. Yolg'iz ma'no tashimaydi — yonida doim [label]
  /// turadi; u faqat "bu narsa o'ngga suriladi" deb ishora qiladi.
  final IconData icon;

  /// Yo'lak balandligi — haydovchi asosiy amali.
  static const double height = kControlHeightDriver;

  /// Surilishi kerak bo'lgan tugmacha o'lchami.
  ///
  /// Yo'lak (64) ichida 6dp chetlar bilan 52 qoladi. Bu `kMinTapTargetDriver`
  /// (56) dan kichik ko'rinadi, lekin sudrash nishoni TEGINISH nishoni emas:
  /// jest butun yo'lak bo'ylab tutiladi (pastdagi `onHorizontalDrag*` ga
  /// qarang), ya'ni barmoq 64dp balandlikdagi butun tasmani ushlaydi.
  static const double thumbSize = 52;

  /// Amal bajarilishi uchun bosib o'tilishi kerak bo'lgan masofa ulushi.
  ///
  /// 0.7 — ataylab 1.0 emas: yo'lakning oxirgi santimetrida barmoq ko'pincha
  /// ekran chetiga tegib "uzilib" qoladi va haydovchi harakatni qayta
  /// boshlashga majbur bo'ladi. 70% "niyat" ni isbotlash uchun yetarlicha
  /// uzun, lekin qo'lni cho'zishga majburlamaydi.
  static const double completionFraction = 0.7;

  @override
  State<AgSlideAction> createState() => _AgSlideActionState();
}

/// Tugmacha bilan yo'lak chegarasi orasidagi bo'shliq: (64 - 52) / 2.
const double _kTrackInset = (AgSlideAction.height - AgSlideAction.thumbSize) / 2;

/// Oddiy teginishga javoban tugmacha qanchalik "turtiladi".
///
/// NEGA UMUMAN TURTILADI: surishni bilmagan haydovchi tugmani BOSADI. Agar
/// hech narsa qimirlamasa, u ekran qotib qolgan deb o'ylab qayta-qayta
/// bosadi — aynan yakunlash lahzasida. Kichik turtki "bu narsa suriladi"
/// deb javob beradi va 0.7 chegarasidan uzoq bo'lgani uchun hech qachon
/// tasodifan bajarilmaydi.
const double _kHintFraction = 0.12;

/// Yozuv qanchalik tez so'nishi. 1.6 — tugmacha yozuv ustiga yetib
/// borgunicha yozuv allaqachon g'oyib bo'ladi, ya'ni ular ustma-ust
/// tushib o'qilmas holga kelmaydi.
const double _kLabelFadeRate = 1.6;

class _AgSlideActionState extends State<AgSlideAction>
    with SingleTickerProviderStateMixin {
  late final AnimationController _settle;

  /// Yo'lak bo'ylab joriy holat, 0..1.
  double _progress = 0;

  /// Animatsiya davomida `_progress` shu egri chiziqdan o'qiladi.
  Animation<double>? _settleAnimation;

  /// Amal bajarilgan — takroriy chaqiruvni to'sadi. Bitta safar ikki marta
  /// yakunlanmasligi kerak.
  bool _completed = false;

  /// Oxirgi tartibda tugmacha bosib o'tishi mumkin bo'lgan piksel masofa.
  /// `build` da hisoblanadi; jest ishlovchilari shundan foydalanadi.
  double _travel = 1;

  @override
  void initState() {
    super.initState();
    _settle = AnimationController(vsync: this, duration: AppMotion.base)
      ..addListener(() {
        final animation = _settleAnimation;
        if (animation == null) return;
        setState(() => _progress = animation.value);
      });
  }

  @override
  void didUpdateWidget(AgSlideAction oldWidget) {
    super.didUpdateWidget(oldWidget);

    // So'rov yiqilib, amal QAYTA ochilganda tugmacha boshiga qaytadi —
    // aks holda u oxirida qotib qoladi va haydovchi qayta urinolmaydi.
    if (widget.enabled && !oldWidget.enabled) {
      _completed = false;
      if (_progress != 0) _run(_toTween(0), AppMotion.base);
      return;
    }

    // Amal yopilganda yarim surilgan tugmacha "hali ham suriladi" degan
    // yolg'on signal beradi — boshiga qaytariladi.
    if (!widget.enabled && oldWidget.enabled && !_completed && _progress > 0) {
      _run(_toTween(0), AppMotion.fast);
    }
  }

  @override
  void dispose() {
    _settle.dispose();
    super.dispose();
  }

  Animation<double> _toTween(double target) => Tween<double>(
        begin: _progress,
        end: target,
      ).animate(
        CurvedAnimation(
          parent: _settle,
          // Orqaga qaytish SPRING bilan — jismoniy "qo'yib yuborilgan
          // prujina" hissi harakat BEKOR qilinganini so'zsiz aytadi.
          curve: target == 0 ? AppMotion.spring : AppMotion.enter,
        ),
      );

  void _run(Animation<double> animation, Duration duration) {
    _settleAnimation = animation;
    _settle
      ..duration = AppMotion.duration(context, duration)
      ..forward(from: 0);
  }

  void _onDragStart(DragStartDetails _) {
    if (_completed) return;
    // Qaytish animatsiyasi o'rtasida barmoq qaytib kelsa, u tugmachani
    // tortib olib ketmasligi kerak.
    _settle.stop();
    _settleAnimation = null;
  }

  void _onDragUpdate(DragUpdateDetails details) {
    if (_completed) return;
    final delta = details.primaryDelta;
    if (delta == null) return;
    setState(() {
      _progress = (_progress + delta / _travel).clamp(0.0, 1.0);
    });
  }

  /// Chegara TEKSHIRUVI barmoq KO'TARILGANDA bo'ladi, surish paytida emas.
  ///
  /// Sabab xavfsizlikda: yo'l chuqurida barmoq beixtiyor uzoqqa sirg'alishi
  /// mumkin. Barmoq ekranda ekan, haydovchi orqaga tortib harakatni bekor
  /// qila oladi — mid-drag bajarilsa, bu imkoniyat yo'qoladi.
  void _onDragEnd(DragEndDetails _) {
    if (_completed) return;
    if (_progress >= AgSlideAction.completionFraction) {
      _complete();
    } else {
      _run(_toTween(0), AppMotion.base);
    }
  }

  void _complete() {
    if (_completed || !widget.enabled) return;
    _completed = true;
    _run(_toTween(1), AppMotion.fast);
    // "Hal bo'ldi" naqshi — barmoq ko'tarilgan zahoti, ekranga qaramasdan.
    AppHaptics.success();
    widget.onCompleted();
  }

  /// Oddiy teginish — bajarmaydi, faqat surish kerakligini ko'rsatadi.
  void _hint() {
    if (!widget.enabled || _completed) return;
    AppHaptics.tap();
    _run(
      TweenSequence<double>([
        TweenSequenceItem(
          tween: Tween<double>(begin: _progress, end: _kHintFraction),
          weight: 1,
        ),
        TweenSequenceItem(
          tween: Tween<double>(begin: _kHintFraction, end: 0),
          weight: 1,
        ),
      ]).animate(CurvedAnimation(parent: _settle, curve: AppMotion.standard)),
      AppMotion.base,
    );
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.enabled;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      // Ekran o'quvchi uchun oddiy tugma — surish jesti unga yetib
      // bormaydi (fayl boshidagi izohga qarang).
      onTap: enabled ? _complete : null,
      // Ichkaridagi `Text` ni ham o'qisa, nom ikki marta aytiladi.
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          // Cheksiz kenglik (o'ralmagan `Row`) da masofa hisoblanmaydi —
          // 1 bilan bo'lish xavfsiz, chunki bunday tartib baribir chizilmaydi.
          _travel = width.isFinite
              ? (width - _kTrackInset * 2 - AgSlideAction.thumbSize)
                  .clamp(1.0, double.infinity)
              : 1.0;

          // Spring egri chizig'i 0 dan pastga otib ketadi (easeOutBack);
          // chizishda 0 ga qisiladi, aks holda tugmacha yo'lakdan
          // tashqariga chiqib ketardi.
          final offset = (_progress * _travel).clamp(0.0, _travel);
          final labelOpacity =
              (1 - _progress * _kLabelFadeRate).clamp(0.0, 1.0);

          return SizedBox(
            height: AgSlideAction.height,
            child: GestureDetector(
              // Jest butun yo'lak bo'ylab tutiladi, faqat tugmachada emas:
              // harakatdagi mashinada barmoq 52dp kvadratga aniq tushmaydi.
              behavior: HitTestBehavior.opaque,
              onTap: enabled ? _hint : null,
              onHorizontalDragStart: enabled ? _onDragStart : null,
              onHorizontalDragUpdate: enabled ? _onDragUpdate : null,
              onHorizontalDragEnd: enabled ? _onDragEnd : null,
              child: Stack(
                children: [
                  _buildTrack(enabled),
                  _buildFill(enabled, offset),
                  _buildLabel(enabled, labelOpacity),
                  Positioned(
                    left: _kTrackInset + offset,
                    top: _kTrackInset,
                    child: _buildThumb(enabled),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  /// Yo'lak. Chegara `kLineInteractive` — `kSurface` yo'lak `kSurface2` fonli
  /// qatlamli sheet ustida atigi 1.12:1, ya'ni cheti ko'rinmaydi. WCAG 1.4.11
  /// boshqaruvni ANIQLASH uchun 3:1 talab qiladi (`kLine` 1.22:1 bilan bu
  /// vazifani bajara olmaydi).
  Widget _buildTrack(bool enabled) {
    return Positioned.fill(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusLg),
          border: Border.all(
            // O'chirilgan boshqaruv WCAG kontrast talabidan ozod va
            // pastroq kontrast aynan "hozir bosilmaydi" degani.
            color: enabled ? kLineInteractive : kLine,
            width: 1.5,
          ),
        ),
      ),
    );
  }

  /// Bosib o'tilgan qism. Rang emas, MASOFA ma'no tashiydi: haydovchi
  /// yo'lakning qanchasi to'lganini bir ko'z tashlashda ko'radi.
  Widget _buildFill(bool enabled, double offset) {
    if (!enabled || offset <= 0) return const SizedBox.shrink();
    return Positioned(
      left: 0,
      top: 0,
      bottom: 0,
      width: _kTrackInset * 2 + AgSlideAction.thumbSize + offset,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: kMintTint,
          borderRadius: BorderRadius.circular(kRadiusLg),
        ),
      ),
    );
  }

  /// Yozuv tugmachaning O'NGIDA markazlashadi — boshlang'ich holatda
  /// tugmacha uni yopib qo'ymasligi uchun.
  Widget _buildLabel(bool enabled, double opacity) {
    return Positioned.fill(
      left: _kTrackInset + AgSlideAction.thumbSize + kSpace2,
      right: kSpace3,
      child: Center(
        child: Opacity(
          opacity: opacity,
          child: Text(
            widget.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: kFontTitle,
              fontWeight: FontWeight.w800,
              // Oq yo'lakda kInk 17.5:1 — quyoshda ham o'qiladi.
              //
              // O'chirilgan holatdagi `kInkSubtle` — YAGONA istisno.
              // Yozuvda u 3.67:1 bilan AA'dan past, lekin o'chirilgan
              // boshqaruvlar WCAG kontrast talabidan ozod va aynan shu
              // pastlik "hozir bosilmaydi" degan signalni beradi.
              // `kInkMuted` ga o'tkazilsa o'chirilgan yo'lak ishlayotgan
              // yo'lakdan farq qilmay qoladi — xavfsizlik boshqaruvida bu
              // yolg'on signal. Naqsh `ag_action_row.dart` dagi bir xil
              // asoslangan istisnodan.
              color: enabled ? kInk : kInkSubtle,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildThumb(bool enabled) {
    return Container(
      width: AgSlideAction.thumbSize,
      height: AgSlideAction.thumbSize,
      decoration: BoxDecoration(
        // kPrimary to'ldirish ustida kOnPrimary 5.38:1.
        color: enabled ? kPrimary : kSurface2,
        // Yo'lak radiusidan (22) chetlar (6) ayirilsa konsentrik 16 chiqadi.
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: enabled ? kShadowCard : null,
      ),
      child: Icon(
        widget.icon,
        color: enabled ? kOnPrimary : kInkSubtle,
        size: 26,
      ),
    );
  }
}
