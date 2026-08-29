import 'dart:math' as math;

import 'package:angren_taxi/core/location/maneuver_phrases.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:latlong2/latlong.dart';

// ============================================================================
// NAVIGATSIYA DVIGATELI
//
// GPS ping'lari oqimini pog'onali ko'rsatmaga aylantiradi: hozir qaysi manevr
// oldinda, unga qancha qolgan va AYNAN HOZIR nimadir aytish kerakmi.
//
// Sof Dart: na Flutter, na plagin, na tarmoq. Sabab — bu sinfdagi eng muhim
// xatti-harakat (ovoz takrorlanmasligi) faqat shundagina qurilmasiz,
// millisekundlarda va ishonchli test qilinadi.
//
// ┌─ ENG MUHIM KAFOLAT ────────────────────────────────────────────────────┐
// │ Har bir (manevr, bosqich) juftligi uchun ogohlantirish FAQAT BIR MARTA │
// │ chiqadi.                                                               │
// │                                                                        │
// │ Nega bu shunchalik muhim: `update()` har GPS ping'ida chaqiriladi —    │
// │ ya'ni sekundiga bir marta, tirbandlikda esa mashina qimirlamasa ham.   │
// │ Agar ogohlantirish faqat "masofa < 150 m" shartiga qarab chiqsa,       │
// │ svetoforda turgan haydovchi "150 metrdan keyin o'ngga buriling" ni     │
// │ to'xtovsiz, sekundiga bir marta eshitadi. Bu ilovani o'chirib          │
// │ qo'yadigan darajadagi nosozlik.                                        │
// │                                                                        │
// │ Yechim: aytilgan (manevr, bosqich) juftliklari [_spoken] to'plamiga    │
// │ yoziladi va boshqa hech qachon aytilmaydi.                             │
// └────────────────────────────────────────────────────────────────────────┘
// ============================================================================

/// Ovozda aytilishi kerak bo'lgan bitta ogohlantirish.
class NavigationAnnouncement {
  const NavigationAnnouncement({
    required this.stepIndex,
    required this.phase,
    required this.text,
  });

  /// Qaysi manevr haqida (marshrutdagi indeks).
  final int stepIndex;

  /// Qaysi masofa bosqichida.
  final AnnouncementPhase phase;

  /// Aytiladigan o'zbekcha gap.
  final String text;

  @override
  String toString() => 'NavigationAnnouncement($stepIndex, ${phase.name}, "$text")';
}

/// Bitta GPS ping'idan keyingi navigatsiya holati.
class NavigationProgress {
  const NavigationProgress({
    required this.stepIndex,
    required this.step,
    required this.distanceToManeuverMeters,
    required this.instruction,
    required this.announcement,
    required this.isFinished,
  });

  /// Oldinda turgan manevrning marshrutdagi indeksi.
  final int stepIndex;

  /// Oldinda turgan manevr. Marshrut tugagan yoki bo'sh bo'lsa `null`.
  final RouteStep? step;

  /// Shu manevrgacha qolgan to'g'ri chiziqli masofa (metr).
  final double distanceToManeuverMeters;

  /// Ekranda ko'rsatiladigan o'zbekcha ko'rsatma. HECH QACHON bo'sh emas.
  final String instruction;

  /// Aynan shu ping'da aytilishi kerak bo'lgan gap, yoki `null` —
  /// "hozir jim tur". Ping'larning KATTA QISMIDA bu `null` bo'ladi.
  final NavigationAnnouncement? announcement;

  /// Marshrutning oxirgi manevri ham ortda qoldimi.
  final bool isFinished;
}

/// GPS ping'laridan pog'onali navigatsiya holatini hisoblaydi.
///
/// Bir marshrut uchun bitta nusxa: ichida "qaysi manevrgacha keldik" va
/// "nima allaqachon aytilgan" holati saqlanadi. Marshrut qayta yuklansa
/// yangi nusxa yaratiladi (yoki [reset] chaqiriladi).
class NavigationEngine {
  NavigationEngine({required List<RouteStep> steps})
      : _steps = List.unmodifiable(steps) {
    _stepIndex = _firstManeuverIndex();
  }

  final List<RouteStep> _steps;

  /// Oldinda turgan manevrning indeksi.
  late int _stepIndex;

  /// Allaqachon aytilgan (manevr indeksi, bosqich) juftliklari.
  ///
  /// Bu to'plam — yuqoridagi kafolatning butun mexanizmi. Kalit
  /// `"$stepIndex:${phase.name}"` ko'rinishida.
  final Set<String> _spoken = <String>{};

  /// Joriy manevrga eng yaqin kelingan masofa (metr).
  ///
  /// "Manevrni o'tib ketdikmi" degan savolga faqat shu qiymat javob bera
  /// oladi: bitta ping'ning o'zida uzoqlashayotganini bilib bo'lmaydi.
  double _closestToManeuver = double.infinity;

  /// Manevr "o'tib ketilgan" deb hisoblanadigan masofa (metr).
  ///
  /// GPS shahar ichida ±10 m adashadi, shuning uchun aynan 0 ga yetishini
  /// kutib bo'lmaydi — kutilsa, ko'rsatma burilishdan keyin ham ekranda
  /// osilib qolardi.
  static const double kManeuverPassedMeters = 25;

  /// Manevr "yonidan o'tdik" deb hisoblash uchun kerakli yaqinlik (metr).
  ///
  /// Keng chorrahada yoki GPS biroz siljiganda mashina manevr nuqtasiga 25 m
  /// gacha yaqinlashmasligi mumkin — shunda ham burilish bajarilgan bo'ladi.
  static const double kApproachRadiusMeters = 80;

  /// Yaqinlashgandan keyin shuncha metr uzoqlashilsa — manevr ortda qoldi.
  ///
  /// GPS chayqalishidan (odatda ±10–20 m) sezilarli katta: aks holda turgan
  /// mashina shovqin tufayli "burildim" deb hisoblanib, ko'rsatma keyingi
  /// manevrga sakrab ketardi.
  static const double kDepartureDeltaMeters = 40;

  /// Bosqichlar chegarasi (metr). Tartib MUHIM: uzoqdan yaqinga.
  static const double kFarMeters = 500;
  static const double kNearMeters = 150;

  /// "Hozir buriling" chegarasi.
  ///
  /// [kManeuverPassedMeters] dan SEZILARLI katta bo'lishi SHART. Ping'lar
  /// sekundiga bir marta keladi, 60 km/soat esa sekundiga ~17 m — ikki
  /// chegara yaqin bo'lsa, oxirgi ogohlantirish tushadigan oraliqqa
  /// bironta ham ping tushmay, "hozir buriling" umuman aytilmay qolardi.
  /// 60 va 25 orasidagi 35 metr har qanday shahar tezligida kamida bitta
  /// ping'ni kafolatlaydi.
  static const double kImmediateMeters = 60;

  /// Oldinda turgan manevr (yoki marshrut tugagan bo'lsa `null`).
  RouteStep? get currentStep =>
      _stepIndex < _steps.length ? _steps[_stepIndex] : null;

  /// Marshrutda umuman manevr bormi.
  bool get hasRoute => _steps.isNotEmpty;

  /// Yangi GPS ping'ini qayta ishlaydi va navigatsiya holatini qaytaradi.
  ///
  /// Chaqiruvchi qaytgan [NavigationProgress.announcement] `null` bo'lmasa —
  /// va FAQAT o'shanda — ovozni ishga tushiradi.
  NavigationProgress update(LatLng position) {
    if (_steps.isEmpty) {
      return const NavigationProgress(
        stepIndex: 0,
        step: null,
        distanceToManeuverMeters: 0,
        instruction: ManeuverPhrases.fallback,
        announcement: null,
        isFinished: false,
      );
    }

    _advancePast(position);

    final step = currentStep;
    if (step == null) {
      return NavigationProgress(
        stepIndex: _steps.length,
        step: null,
        distanceToManeuverMeters: 0,
        instruction: ManeuverPhrases.instructionFor(_steps.last),
        announcement: null,
        isFinished: true,
      );
    }

    final distance = _distanceMeters(position, step.location);
    final announcement = _announcementFor(step, distance);

    return NavigationProgress(
      stepIndex: _stepIndex,
      step: step,
      distanceToManeuverMeters: distance,
      instruction: ManeuverPhrases.instructionFor(step),
      announcement: announcement,
      isFinished: false,
    );
  }

  /// Marshrut qayta hisoblanganda holatni tozalaydi.
  ///
  /// Aytilganlar ro'yxati ham tozalanadi: yangi marshrutdagi manevrlar
  /// boshqa, ularni qaytadan aytish kerak.
  void reset() {
    _spoken.clear();
    _stepIndex = _firstManeuverIndex();
    _closestToManeuver = double.infinity;
  }

  /// Haydovchi manevr nuqtasini o'tib ketgan bo'lsa keyingisiga suradi.
  void _advancePast(LatLng position) {
    // Avval uzilishdan keyingi qayta moslashuv, keyin oddiy siljish:
    // sakrash joriy qadamni ancha oldinga surishi mumkin va undan keyin
    // ham "o'tib ketildimi" tekshiruvi ishlashi kerak.
    _resyncAfterGap(position);

    while (_stepIndex < _steps.length) {
      final distance = _distanceMeters(position, _steps[_stepIndex].location);

      // 1) Manevr nuqtasining ustidamiz.
      if (distance <= kManeuverPassedMeters) {
        _advanceOne();
        continue;
      }

      // 2) Yaqin kelib, endi UZOQLASHYAPMIZ — burilish bajarildi.
      //
      // Faqat masofaga qarab bo'lmaydi: manevrgacha 100 m qolganda ham,
      // uni bajarib 100 m nariga ketganda ham masofa bir xil. Farqni
      // "eng yaqin kelingan nuqta" ko'rsatadi.
      if (_closestToManeuver <= kApproachRadiusMeters &&
          distance > _closestToManeuver + kDepartureDeltaMeters) {
        _advanceOne();
        continue;
      }

      if (distance < _closestToManeuver) _closestToManeuver = distance;
      return;
    }
  }

  /// Ping'lar orasida uzoq tanaffus bo'lsa navigatsiyani joyiga qaytaradi.
  ///
  /// Tunnel, fon rejimi yoki tarmoq uzilishida ikki ping orasida bir necha
  /// yuz metr bo'ladi va oraliqda bir nechta chorraha qolib ketishi mumkin.
  /// Bunda "eng yaqin kelingan nuqta" mantig'i ishlamaydi — o'sha manevrlarga
  /// umuman yaqinlashilgani QAYD ETILMAGAN. Shuning uchun: hozir ustida
  /// turgan eng OXIRGI manevr topiladi va navigatsiya o'sha yerga suriladi.
  ///
  /// Oxiridan boshlab qidiriladi — uzoq tanaffusda bir nechta manevr
  /// yaqinda bo'lsa, eng oldingisi emas, eng OXIRGISI to'g'ri javob.
  ///
  /// Faqat `kManeuverPassedMeters` radiusidagi manevrga sakraydi: "keyingi
  /// manevr yaqinroq ko'rinyapti" degan yumshoqroq shart xavfli bo'lardi —
  /// shahar ko'chalari to'rida marshrut qaytib o'tganda oldindagi burilish
  /// noto'g'ri o'tkazib yuborilardi.
  void _resyncAfterGap(LatLng position) {
    for (var i = _steps.length - 1; i > _stepIndex; i--) {
      if (_distanceMeters(position, _steps[i].location) <=
          kManeuverPassedMeters) {
        _stepIndex = i;
        _closestToManeuver = double.infinity;
        return;
      }
    }
  }

  /// Keyingi manevrga o'tadi va yaqinlik o'lchagichini tozalaydi.
  void _advanceOne() {
    _stepIndex++;
    _closestToManeuver = double.infinity;
  }

  /// Shu ping'da aytilishi kerak bo'lgan gap, yoki `null`.
  NavigationAnnouncement? _announcementFor(RouteStep step, double distance) {
    final phase = _phaseFor(distance);
    if (phase == null) return null;

    final key = _keyFor(_stepIndex, phase);
    if (_spoken.contains(key)) return null;

    // Shu bosqich VA undan UZOQROQ bosqichlar "aytilgan" deb belgilanadi.
    //
    // Nega uzoqroqlari ham: haydovchi burilishga 100 m qolganda navigatsiyani
    // ochsa, birinchi ping darhol `near` bosqichiga tushadi. Keyin GPS sal
    // adashib masofani 160 m ko'rsatsa, `far` hali aytilmagan bo'lgani uchun
    // "500 metrdan keyin..." deb ORQAGA qadam tashlangan bo'lardi. Bosqichlar
    // faqat oldinga siljishi kerak.
    for (final coarser in AnnouncementPhase.values) {
      if (coarser.index <= phase.index) {
        _spoken.add(_keyFor(_stepIndex, coarser));
      }
    }

    return NavigationAnnouncement(
      stepIndex: _stepIndex,
      phase: phase,
      text: ManeuverPhrases.announcementFor(step, phase),
    );
  }

  /// Masofaga mos bosqich, yoki `null` — hali uzoq, gapirish erta.
  static AnnouncementPhase? _phaseFor(double distanceMeters) {
    if (distanceMeters <= kImmediateMeters) return AnnouncementPhase.immediate;
    if (distanceMeters <= kNearMeters) return AnnouncementPhase.near;
    if (distanceMeters <= kFarMeters) return AnnouncementPhase.far;

    return null;
  }

  static String _keyFor(int stepIndex, AnnouncementPhase phase) =>
      '$stepIndex:${phase.name}';

  /// Birinchi MA'NOLI manevr indeksi.
  ///
  /// OSRM'ning `steps[0]` i doim `depart` — u haydovchi turgan joyning
  /// o'zida, ya'ni masofasi nol. Undan boshlansa `_advancePast` uni darhol
  /// o'tkazib yuborardi, lekin oldin "Yo'lni boshlang" ni `immediate`
  /// bosqichida aytib ulgurardi. Haydovchi buni allaqachon biladi.
  int _firstManeuverIndex() => _steps.length > 1 ? 1 : 0;

  /// Ikki nuqta orasidagi sferik masofa (metr).
  ///
  /// To'g'ri chiziq, yo'l bo'ylab emas — manevrga yaqinlashganda farq
  /// yo'qoladi, uzoqda esa aniqlik baribir kerak emas.
  static double _distanceMeters(LatLng a, LatLng b) {
    const earthRadiusMeters = 6371000.0;
    double toRad(double deg) => deg * math.pi / 180;

    final dLat = toRad(b.latitude - a.latitude);
    final dLng = toRad(b.longitude - a.longitude);
    final lat1 = toRad(a.latitude);
    final lat2 = toRad(b.latitude);

    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1) * math.cos(lat2) * math.sin(dLng / 2) * math.sin(dLng / 2);

    return 2 * earthRadiusMeters * math.asin(math.min(1, math.sqrt(h)));
  }
}
