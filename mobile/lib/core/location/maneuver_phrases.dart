import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/route_step.dart';

// ============================================================================
// O'ZBEKCHA MANEVR IBORALARI
//
// Bu fayl OSRM'ning inglizcha manevr turlarini haydovchi eshitadigan va
// o'qiydigan o'zbekcha gapga aylantiradi.
//
// NEGA alohida fayl: bir xil matn IKKI joyda kerak — ekrandagi banner va
// ovozli ko'rsatma. Ikkalasi bir manbadan olinsa, haydovchi eshitgan gap
// bilan ko'rgan yozuv hech qachon bir-biriga zid bo'lmaydi.
//
// KAFOLAT: bu yerdagi hech bir funksiya BO'SH SATR ham, INGLIZCHA satr ham
// qaytarmaydi. OSRM kelajakda yangi manevr turi qo'shsa (`ManeuverType
// .unknown` ga tushadi) yoki modifikatorni umuman yubormasa ham, haydovchi
// mazmunli o'zbekcha gap eshitadi — "yo'lda davom eting" eng yomon holatda
// ham to'g'ri maslahat, jim qolish esa xavfli.
// ============================================================================

/// Manevrgacha qolgan masofaga qarab ogohlantirish bosqichi.
///
/// Uch bosqich Yandex/Google navigatoridagi odatiy ritmni takrorlaydi:
/// avval "tayyorlaning", keyin "yaqinlashdingiz", oxirida "hozir buriling".
enum AnnouncementPhase {
  /// ~500 m — qatorni almashtirishga ulguradigan masofa.
  far,

  /// ~150 m — burilish ko'rinib turadi, sekinlashish vaqti.
  near,

  /// ~40 m — aynan hozir.
  immediate,
}

/// [AnnouncementPhase] uchun ovozda aytiladigan masofa (metr).
///
/// ATAYLAB o'lchangan masofa emas, bosqich chegarasi aytiladi: haydovchi
/// "487 metrdan keyin" ni eshitib foyda ko'rmaydi, "500 metrdan keyin" esa
/// darhol tushunarli. Ogohlantirish aynan shu chegarani kesib o'tganda
/// chiqadi, ya'ni raqam haqiqatdan uzoqlashmaydi.
const Map<AnnouncementPhase, int> kPhaseDistanceMeters = {
  AnnouncementPhase.far: 500,
  AnnouncementPhase.near: 100,
};

/// Ko'rsatmani oldindan yozib olingan bo'laklar sifatida beradi
/// (`tool/voice_clip_catalogue.json` dagi id'lar).
///
/// NEGA BO'LAKLAR: telefonlarning ko'pida o'zbekcha TTS ovozi YO'Q — ruscha
/// ovoz lotin matnini buzib o'qiydi yoki umuman jim. Yozib olingan bo'laklar
/// har qanday qurilmada, internetsiz bir xil toza ovoz beradi. Ko'cha nomi
/// AYTILMAYDI (uni oldindan yozib bo'lmaydi) — u ekrandagi bannerda.

/// OSRM manevrlarini o'zbekcha iboraga aylantiradi.
abstract final class ManeuverPhrases {
  /// Hech qanday ma'lumot bo'lmaganda ishlatiladigan zaxira ibora.
  ///
  /// Nega aynan shu gap: u har qanday yo'l holatida to'g'ri va haydovchini
  /// noto'g'ri harakatga undamaydi.
  static String get fallback => AppL10n.current.shManeuverContinue;

  /// Haydovchi marshrutdan chiqib, yo'l qayta qurilayotganda aytiladi.
  static String get rerouting => AppL10n.current.shManeuverRerouting;

  /// Ekranda ko'rsatiladigan / ovozda aytiladigan asosiy ko'rsatma.
  ///
  /// [step] — oldinda turgan manevr (`steps[i+1]`, `route_step.dart` dagi
  /// izohga qarang).
  static String instructionFor(RouteStep step) {
    final base = _baseInstruction(step);
    final street = step.name.trim();

    // Ko'cha nomi faqat MA'NOLI bo'lganda qo'shiladi. OSRM nomni bilmasa
    // bo'sh satr yuboradi; "O'ngga buriling, " kabi osilib qolgan vergul
    // ovozda ham, ekranda ham xato ko'rinadi.
    if (street.isEmpty || !_takesStreetName(step.type)) return base;

    return '$base, $street';
  }

  /// Masofa bosqichi bilan birga to'liq ogohlantirish gapi.
  ///
  /// `immediate` bosqichida masofa AYTILMAYDI: "40 metrdan keyin o'ngga
  /// buriling" deb aytilguncha haydovchi burilishni o'tkazib yuboradi.
  static String announcementFor(RouteStep step, AnnouncementPhase phase) {
    final instruction = instructionFor(step);
    final meters = kPhaseDistanceMeters[phase];
    if (meters == null) return instruction;

    // `arrive` uchun "yetib keldingiz" o'tgan zamon — uni masofa bilan
    // qo'shsa "500 metrdan keyin yetib keldingiz" degan noto'g'ri gap
    // chiqadi, shuning uchun kelasi zamon shakli ishlatiladi.
    if (step.type == ManeuverType.arrive) {
      return AppL10n.current.shManeuverArriveIn(meters);
    }

    return AppL10n.current.shManeuverInDistance(
      meters,
      _midSentence(instruction),
    );
  }

  /// [announcementFor] ning ovoz bo'laklari shaklidagi aynan o'sha gapi:
  /// `far`/`near` da avval masofa ("100 metrdan keyin"), keyin ko'rsatma.
  static List<String> voiceClipsFor(RouteStep step, AnnouncementPhase phase) {
    // Jim manevr — hech narsa (noto'g'ri bo'lak aytilgandan ko'ra jimlik).
    if (!isSpoken(step)) return const [];
    final meters = kPhaseDistanceMeters[phase];
    if (meters == null) return [_clipFor(step)];
    if (step.type == ManeuverType.arrive) return ['dist_$meters', 'arrive_in'];
    return ['dist_$meters', _clipFor(step)];
  }

  /// Marshrut qayta qurilayotgani haqidagi gap bo'lagi.
  static const List<String> reroutingClips = ['shManeuverRerouting'];

  /// Ovozda AYTILADIGAN ko'rsatmalarning bo'laklari. Ro'yxatda yo'q
  /// ko'rsatma (to'g'ri yurish, yo'l egilishi, qatorga qo'shilish) — jim.
  static Map<String, String> get _spokenClipByText {
    final l = AppL10n.current;
    return {
      l.shManeuverArrive: 'shManeuverArrive',
      l.shManeuverUturn: 'shManeuverUturn',
      l.shManeuverSharpRight: 'shManeuverSharpRight',
      l.shManeuverRight: 'shManeuverRight',
      l.shManeuverLeft: 'shManeuverLeft',
      l.shManeuverSharpLeft: 'shManeuverSharpLeft',
    };
  }

  /// Bu manevr haqida ovozda gapirish kerakmi. Dvigatel `false` bo'lganda
  /// umuman ogohlantirish chiqarmaydi.
  static bool isSpoken(RouteStep step) =>
      _spokenClipByText.containsKey(_baseInstruction(step));

  /// Asosiy ko'rsatmaning bo'lagi (faqat [isSpoken] manevrlar uchun ma'noli).
  static String _clipFor(RouteStep step) => _spokenClipByText[_baseInstruction(step)]!;

  /// Ko'rsatmani gap o'rtasiga qo'yish uchun tayyorlaydi.
  ///
  /// O'zbekchada ko'rsatma o'zgarmaydi ("500 metrdan keyin O'ngga
  /// buriling"). Ruschada esa "Через 500 метров поверните направо" —
  /// gap o'rtasidagi fe'l kichik harf bilan yoziladi.
  static String _midSentence(String instruction) {
    if (!AppL10n.localeName.startsWith('ru') || instruction.isEmpty) {
      return instruction;
    }
    return instruction[0].toLowerCase() + instruction.substring(1);
  }

  /// Asosiy ibora — FAQAT oddiy, aniq ko'rsatmalar (foydalanuvchi qarori,
  /// 2026-10-06): "o'ngga / chapga / keskin / orqaga qayting / yetib
  /// keldingiz". Ayrilish, yo'l oxiri, aylanma, rampa — hammasi chiqish
  /// YO'NALISHIGA qarab shu iboralarga keltiriladi. "Sal o'ngga" (yo'l
  /// egilishi), qatorga qo'shilish va to'g'ri yurish — [isSpoken] bo'yicha
  /// JIM: ekranda ko'rinadi, lekin aytilmaydi.
  ///
  /// ⚠️ "Svetofordan buriling" YO'Q va bo'lmasligi kerak: OSRM burilish
  /// joyida svetofor bor-yo'qligini bilmaydi, svetofor yo'q joyda bu gap
  /// haydovchini adashtirardi.
  ///
  /// `switch` TO'LIQ (exhaustive): `ManeuverType` ga yangi qiymat qo'shilsa
  /// analizator shu yerni xato deb belgilaydi.
  static String _baseInstruction(RouteStep step) {
    return switch (step.type) {
      ManeuverType.depart => AppL10n.current.shManeuverDepart,
      ManeuverType.arrive => AppL10n.current.shManeuverArrive,
      // Oddiy burilishda "sal" — yo'l egilishi, burilish emas.
      ManeuverType.turn => _directional(step.modifier, slightIsTurn: false),
      // Bularda "sal" ham haqiqiy tanlov (qaysi tarmoqqa/chiqishga) — aniq
      // burilish sifatida aytiladi.
      ManeuverType.endOfRoad ||
      ManeuverType.fork ||
      ManeuverType.onRamp ||
      ManeuverType.offRamp ||
      ManeuverType.roundabout ||
      ManeuverType.rotary ||
      ManeuverType.roundaboutTurn ||
      // Noma'lum tur: modifikator bo'lsa yo'nalish baribir foydali.
      ManeuverType.unknown =>
        _directional(step.modifier, slightIsTurn: true),
      ManeuverType.straightOn => AppL10n.current.shManeuverStraight,
      ManeuverType.exitRoundabout ||
      ManeuverType.exitRotary ||
      ManeuverType.merge ||
      ManeuverType.newName ||
      ManeuverType.notification =>
        fallback,
    };
  }

  /// Yo'nalish → ibora. Modifikatorsiz tomon O'YLAB TOPILMAYDI (noto'g'ri
  /// tomonni aytish jim qolishdan ham xavfli) — umumiy, jim ibora.
  static String _directional(ManeuverModifier modifier, {required bool slightIsTurn}) {
    final l = AppL10n.current;
    return switch (modifier) {
      ManeuverModifier.uturn => l.shManeuverUturn,
      ManeuverModifier.sharpRight => l.shManeuverSharpRight,
      ManeuverModifier.right => l.shManeuverRight,
      ManeuverModifier.slightRight => slightIsTurn ? l.shManeuverRight : fallback,
      ManeuverModifier.straight => l.shManeuverStraight,
      ManeuverModifier.slightLeft => slightIsTurn ? l.shManeuverLeft : fallback,
      ManeuverModifier.left => l.shManeuverLeft,
      ManeuverModifier.sharpLeft => l.shManeuverSharpLeft,
      ManeuverModifier.none => fallback,
    };
  }

  /// Ko'cha nomi qaysi manevrlarda ma'noli.
  ///
  /// Yetib kelish va aylanmadan chiqishda nom faqat chalg'itadi: haydovchi
  /// manzilni allaqachon biladi, aylanmada esa chiqish raqami muhimroq.
  static bool _takesStreetName(ManeuverType type) {
    return switch (type) {
      ManeuverType.turn ||
      ManeuverType.endOfRoad ||
      ManeuverType.fork ||
      ManeuverType.merge ||
      ManeuverType.newName ||
      ManeuverType.straightOn ||
      ManeuverType.onRamp ||
      ManeuverType.offRamp ||
      ManeuverType.depart ||
      ManeuverType.unknown =>
        true,
      ManeuverType.arrive ||
      ManeuverType.roundabout ||
      ManeuverType.rotary ||
      ManeuverType.roundaboutTurn ||
      ManeuverType.exitRoundabout ||
      ManeuverType.exitRotary ||
      ManeuverType.notification =>
        false,
    };
  }
}
