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
    final meters = kPhaseDistanceMeters[phase];
    if (meters == null) return [_clipFor(step)];
    if (step.type == ManeuverType.arrive) return ['dist_$meters', 'arrive_in'];
    return ['dist_$meters', _clipFor(step)];
  }

  /// Marshrut qayta qurilayotgani haqidagi gap bo'lagi.
  static const List<String> reroutingClips = ['shManeuverRerouting'];

  /// Asosiy ko'rsatmaning bo'lagi. Matn → kalit teskari jadvali orqali:
  /// `_baseInstruction` dagi tanlovni ikkinchi marta yozmaslik uchun (ikki
  /// nusxa vaqt o'tib ajralib ketardi va ovoz ekrandan boshqa gap aytardi).
  static String _clipFor(RouteStep step) {
    final isRoundabout = step.type == ManeuverType.roundabout ||
        step.type == ManeuverType.rotary ||
        step.type == ManeuverType.roundaboutTurn;
    final exit = step.exit;
    if (isRoundabout && exit != null && exit >= 1) {
      // 5 tadan ko'p chiqishli aylanma Angrenda yo'q — oddiy "aylanmaga kiring".
      return exit <= 5 ? 'roundabout_exit_$exit' : 'shManeuverRoundabout';
    }
    final l = AppL10n.current;
    final byText = <String, String>{
      l.shManeuverContinue: 'shManeuverContinue',
      l.shManeuverDepart: 'shManeuverDepart',
      l.shManeuverArrive: 'shManeuverArrive',
      l.shManeuverOnRamp: 'shManeuverOnRamp',
      l.shManeuverOffRamp: 'shManeuverOffRamp',
      l.shManeuverExitRoundabout: 'shManeuverExitRoundabout',
      l.shManeuverStraight: 'shManeuverStraight',
      l.shManeuverUturn: 'shManeuverUturn',
      l.shManeuverSharpRight: 'shManeuverSharpRight',
      l.shManeuverRight: 'shManeuverRight',
      l.shManeuverSlightRight: 'shManeuverSlightRight',
      l.shManeuverSlightLeft: 'shManeuverSlightLeft',
      l.shManeuverLeft: 'shManeuverLeft',
      l.shManeuverSharpLeft: 'shManeuverSharpLeft',
      l.shManeuverEndOfRoadRight: 'shManeuverEndOfRoadRight',
      l.shManeuverEndOfRoadLeft: 'shManeuverEndOfRoadLeft',
      l.shManeuverEndOfRoadUturn: 'shManeuverEndOfRoadUturn',
      l.shManeuverEndOfRoadStraight: 'shManeuverEndOfRoadStraight',
      l.shManeuverForkRight: 'shManeuverForkRight',
      l.shManeuverForkLeft: 'shManeuverForkLeft',
      l.shManeuverForkStraight: 'shManeuverForkStraight',
      l.shManeuverMergeRight: 'shManeuverMergeRight',
      l.shManeuverMergeLeft: 'shManeuverMergeLeft',
      l.shManeuverMerge: 'shManeuverMerge',
      l.shManeuverRoundabout: 'shManeuverRoundabout',
    };
    return byText[_baseInstruction(step)] ?? 'shManeuverContinue';
  }

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

  /// Manevr turiga mos, modifikatorni hisobga olgan asosiy ibora.
  ///
  /// `switch` TO'LIQ (exhaustive): `ManeuverType` ga yangi qiymat qo'shilsa
  /// analizator shu yerni xato deb belgilaydi va yangi tur e'tibordan
  /// chetda qolmaydi.
  static String _baseInstruction(RouteStep step) {
    return switch (step.type) {
      ManeuverType.depart => AppL10n.current.shManeuverDepart,
      ManeuverType.arrive => AppL10n.current.shManeuverArrive,
      ManeuverType.turn => _turnPhrase(step.modifier),
      ManeuverType.endOfRoad => _endOfRoadPhrase(step.modifier),
      ManeuverType.fork => _forkPhrase(step.modifier),
      ManeuverType.merge => _mergePhrase(step.modifier),
      ManeuverType.onRamp => AppL10n.current.shManeuverOnRamp,
      ManeuverType.offRamp => AppL10n.current.shManeuverOffRamp,
      ManeuverType.roundabout ||
      ManeuverType.rotary ||
      ManeuverType.roundaboutTurn =>
        _roundaboutPhrase(step.exit),
      ManeuverType.exitRoundabout ||
      ManeuverType.exitRotary =>
        AppL10n.current.shManeuverExitRoundabout,
      ManeuverType.straightOn => AppL10n.current.shManeuverStraight,

      // `new name` — yo'l nomi o'zgardi, harakat talab qilinmaydi. Xuddi
      // shunday `notification` ham faqat xabar beradi.
      ManeuverType.newName || ManeuverType.notification => fallback,

      // OSRM biz bilmaydigan tur yubordi. Modifikator bo'lsa — yo'nalish
      // baribir foydali ("chapga buriling"); bo'lmasa umumiy maslahat.
      ManeuverType.unknown => _unknownPhrase(step.modifier),
    };
  }

  /// Oddiy burilish iborasi.
  static String _turnPhrase(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.uturn => AppL10n.current.shManeuverUturn,
      ManeuverModifier.sharpRight => AppL10n.current.shManeuverSharpRight,
      ManeuverModifier.right => AppL10n.current.shManeuverRight,
      ManeuverModifier.slightRight => AppL10n.current.shManeuverSlightRight,
      ManeuverModifier.straight => AppL10n.current.shManeuverStraight,
      ManeuverModifier.slightLeft => AppL10n.current.shManeuverSlightLeft,
      ManeuverModifier.left => AppL10n.current.shManeuverLeft,
      ManeuverModifier.sharpLeft => AppL10n.current.shManeuverSharpLeft,

      // Modifikatorsiz "turn" — OSRM tomonni bilmayapti. Yo'nalishni
      // o'zimiz to'qib bo'lmaydi, shuning uchun neytral ibora.
      ManeuverModifier.none => fallback,
    };
  }

  /// Yo'l tugadi — majburiy burilish.
  static String _endOfRoadPhrase(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.right ||
      ManeuverModifier.sharpRight ||
      ManeuverModifier.slightRight =>
        AppL10n.current.shManeuverEndOfRoadRight,
      ManeuverModifier.left ||
      ManeuverModifier.sharpLeft ||
      ManeuverModifier.slightLeft =>
        AppL10n.current.shManeuverEndOfRoadLeft,
      ManeuverModifier.uturn => AppL10n.current.shManeuverEndOfRoadUturn,
      ManeuverModifier.straight ||
      ManeuverModifier.none =>
        AppL10n.current.shManeuverEndOfRoadStraight,
    };
  }

  /// Yo'l ikkiga ayrilishi.
  static String _forkPhrase(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.right ||
      ManeuverModifier.sharpRight ||
      ManeuverModifier.slightRight =>
        AppL10n.current.shManeuverForkRight,
      ManeuverModifier.left ||
      ManeuverModifier.sharpLeft ||
      ManeuverModifier.slightLeft =>
        AppL10n.current.shManeuverForkLeft,
      ManeuverModifier.uturn => AppL10n.current.shManeuverUturn,
      ManeuverModifier.straight ||
      ManeuverModifier.none =>
        AppL10n.current.shManeuverForkStraight,
    };
  }

  /// Qatorga qo'shilish.
  static String _mergePhrase(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.right ||
      ManeuverModifier.sharpRight ||
      ManeuverModifier.slightRight =>
        AppL10n.current.shManeuverMergeRight,
      ManeuverModifier.left ||
      ManeuverModifier.sharpLeft ||
      ManeuverModifier.slightLeft =>
        AppL10n.current.shManeuverMergeLeft,
      ManeuverModifier.uturn ||
      ManeuverModifier.straight ||
      ManeuverModifier.none =>
        AppL10n.current.shManeuverMerge,
    };
  }

  /// Aylanma yo'l. Chiqish raqami bo'lsa aytiladi — aynan shu raqam
  /// haydovchiga aylanmada qayerdan chiqishni ko'rsatadigan yagona ma'lumot.
  static String _roundaboutPhrase(int? exit) {
    if (exit == null || exit < 1) return AppL10n.current.shManeuverRoundabout;

    return AppL10n.current.shManeuverRoundaboutExit(exit);
  }

  /// Noma'lum tur — yo'nalish ma'lum bo'lsa undan foydalanamiz.
  static String _unknownPhrase(ManeuverModifier modifier) {
    if (modifier == ManeuverModifier.none) return fallback;

    return _turnPhrase(modifier);
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
