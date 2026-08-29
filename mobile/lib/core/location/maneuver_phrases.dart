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
  AnnouncementPhase.near: 150,
};

/// OSRM manevrlarini o'zbekcha iboraga aylantiradi.
abstract final class ManeuverPhrases {
  /// Hech qanday ma'lumot bo'lmaganda ishlatiladigan zaxira ibora.
  ///
  /// Nega aynan shu gap: u har qanday yo'l holatida to'g'ri va haydovchini
  /// noto'g'ri harakatga undamaydi.
  static const String fallback = 'Yo\'lda davom eting';

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
      return '$meters metrdan keyin manzilga yetib borasiz';
    }

    return '$meters metrdan keyin $instruction';
  }

  /// Manevr turiga mos, modifikatorni hisobga olgan asosiy ibora.
  ///
  /// `switch` TO'LIQ (exhaustive): `ManeuverType` ga yangi qiymat qo'shilsa
  /// analizator shu yerni xato deb belgilaydi va yangi tur e'tibordan
  /// chetda qolmaydi.
  static String _baseInstruction(RouteStep step) {
    return switch (step.type) {
      ManeuverType.depart => 'Yo\'lni boshlang',
      ManeuverType.arrive => 'Manzilga yetib keldingiz',
      ManeuverType.turn => _turnPhrase(step.modifier),
      ManeuverType.endOfRoad => _endOfRoadPhrase(step.modifier),
      ManeuverType.fork => _forkPhrase(step.modifier),
      ManeuverType.merge => _mergePhrase(step.modifier),
      ManeuverType.onRamp => 'Chiqish yo\'lkasiga kiring',
      ManeuverType.offRamp => 'Yo\'lkadan chiqing',
      ManeuverType.roundabout ||
      ManeuverType.rotary ||
      ManeuverType.roundaboutTurn =>
        _roundaboutPhrase(step.exit),
      ManeuverType.exitRoundabout ||
      ManeuverType.exitRotary =>
        'Aylanmadan chiqing',
      ManeuverType.straightOn => 'To\'g\'ri davom eting',

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
      ManeuverModifier.uturn => 'Orqaga qayting',
      ManeuverModifier.sharpRight => 'Keskin o\'ngga buriling',
      ManeuverModifier.right => 'O\'ngga buriling',
      ManeuverModifier.slightRight => 'Sal o\'ngga oling',
      ManeuverModifier.straight => 'To\'g\'ri davom eting',
      ManeuverModifier.slightLeft => 'Sal chapga oling',
      ManeuverModifier.left => 'Chapga buriling',
      ManeuverModifier.sharpLeft => 'Keskin chapga buriling',

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
        'Yo\'l oxirida o\'ngga buriling',
      ManeuverModifier.left ||
      ManeuverModifier.sharpLeft ||
      ManeuverModifier.slightLeft =>
        'Yo\'l oxirida chapga buriling',
      ManeuverModifier.uturn => 'Yo\'l oxirida orqaga qayting',
      ManeuverModifier.straight ||
      ManeuverModifier.none =>
        'Yo\'l oxirigacha davom eting',
    };
  }

  /// Yo'l ikkiga ayrilishi.
  static String _forkPhrase(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.right ||
      ManeuverModifier.sharpRight ||
      ManeuverModifier.slightRight =>
        'Ayrilishda o\'ng tomonni tanlang',
      ManeuverModifier.left ||
      ManeuverModifier.sharpLeft ||
      ManeuverModifier.slightLeft =>
        'Ayrilishda chap tomonni tanlang',
      ManeuverModifier.uturn => 'Orqaga qayting',
      ManeuverModifier.straight ||
      ManeuverModifier.none =>
        'Ayrilishda to\'g\'ri davom eting',
    };
  }

  /// Qatorga qo'shilish.
  static String _mergePhrase(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.right ||
      ManeuverModifier.sharpRight ||
      ManeuverModifier.slightRight =>
        'O\'ng qatorga qo\'shiling',
      ManeuverModifier.left ||
      ManeuverModifier.sharpLeft ||
      ManeuverModifier.slightLeft =>
        'Chap qatorga qo\'shiling',
      ManeuverModifier.uturn ||
      ManeuverModifier.straight ||
      ManeuverModifier.none =>
        'Qatorga qo\'shiling',
    };
  }

  /// Aylanma yo'l. Chiqish raqami bo'lsa aytiladi — aynan shu raqam
  /// haydovchiga aylanmada qayerdan chiqishni ko'rsatadigan yagona ma'lumot.
  static String _roundaboutPhrase(int? exit) {
    if (exit == null || exit < 1) return 'Aylanmaga kiring';

    return 'Aylanmaga kiring va $exit-chiqishdan chiqing';
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
