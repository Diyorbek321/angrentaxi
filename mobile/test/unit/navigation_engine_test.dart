// NavigationEngine — GPS ping'laridan pog'onali ko'rsatma.
//
// Bu fayldagi ENG MUHIM testlar — "takrorlanmaslik" guruhi. Navigatsiyadagi
// eng ehtimolli va eng og'riqli xato: ogohlantirish har GPS ping'ida qayta
// aytilishi. Ping sekundiga bir marta keladi, svetoforda turgan mashina esa
// qimirlamaydi — himoya bo'lmasa haydovchi bir xil gapni tinimsiz eshitadi.

import 'package:angren_taxi/core/location/maneuver_phrases.dart';
import 'package:angren_taxi/core/location/navigation_engine.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

/// Sinov boshlanadigan nuqta (Angren markazi atrofi).
const LatLng kOrigin = LatLng(41.0, 70.0);

/// Bir daraja kenglik ≈ shuncha metr — shimolga aniq masofa surish uchun.
const double kMetersPerDegreeLat = 111194.9;

/// [kOrigin] dan shimolga [meters] metr uzoqlikdagi nuqta.
LatLng north(double meters) =>
    LatLng(kOrigin.latitude + meters / kMetersPerDegreeLat, kOrigin.longitude);

RouteStep step({
  required LatLng at,
  ManeuverType type = ManeuverType.turn,
  ManeuverModifier modifier = ManeuverModifier.right,
  String name = '',
  int? exit,
}) {
  return RouteStep(
    type: type,
    modifier: modifier,
    location: at,
    distanceMeters: 100,
    durationSeconds: 20,
    name: name,
    exit: exit,
  );
}

/// Odatiy marshrut: `depart` boshida, keyin 1000 m dagi o'ng burilish,
/// oxirida 2000 m dagi `arrive`.
List<RouteStep> routeWithTurnAt(double turnMeters) => [
      step(at: north(0), type: ManeuverType.depart, modifier: ManeuverModifier.none),
      step(at: north(turnMeters), name: 'Navoiy ko\'chasi'),
      step(at: north(turnMeters + 1000), type: ManeuverType.arrive, modifier: ManeuverModifier.none),
    ];

void main() {
  group('NavigationEngine — takrorlanmaslik kafolati', () {
    test('bir joyda turgan mashinaga ogohlantirish FAQAT BIR MARTA aytiladi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      // Haydovchi burilishga 100 m qolganda svetoforda turib qoldi va
      // 30 ta ping bir xil joydan keldi.
      final standingStill = north(900);

      final announcements = <NavigationAnnouncement>[];
      for (var i = 0; i < 30; i++) {
        final progress = engine.update(standingStill);
        if (progress.announcement != null) {
          announcements.add(progress.announcement!);
        }
      }

      expect(
        announcements,
        hasLength(1),
        reason: 'Turgan mashina bitta gapni 30 marta eshitmasligi kerak',
      );
      expect(announcements.single.phase, AnnouncementPhase.near);
    });

    test('GPS chayqalishi ORQAGA qadam tashlab qayta gapirtirmaydi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      // 100 m — `near` bosqichi.
      final first = engine.update(north(900));
      expect(first.announcement?.phase, AnnouncementPhase.near);

      // GPS adashib mashinani 160 m ga "qaytardi" — bu `far` oynasiga
      // tushadi, lekin `far` allaqachon ortda qolgan bosqich.
      final drifted = engine.update(north(840));
      expect(
        drifted.announcement,
        isNull,
        reason: 'Yaqinlashgandan keyin "500 metrdan keyin" deyish mumkin emas',
      );
    });

    test('har bosqich o\'z navbatida bir martadan aytiladi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      // Hali uzoq — jim.
      expect(engine.update(north(400)).announcement, isNull);

      // 500 m — `far`.
      expect(engine.update(north(510)).announcement?.phase, AnnouncementPhase.far);
      // Xuddi shu oynada yana bir necha ping — endi jim.
      expect(engine.update(north(520)).announcement, isNull);
      expect(engine.update(north(560)).announcement, isNull);

      // 150 m — `near`.
      expect(engine.update(north(870)).announcement?.phase, AnnouncementPhase.near);
      expect(engine.update(north(880)).announcement, isNull);

      // 60 m — `immediate`.
      expect(
        engine.update(north(950)).announcement?.phase,
        AnnouncementPhase.immediate,
      );
      expect(engine.update(north(960)).announcement, isNull);
    });

    test('keyingi manevr uchun ogohlantirishlar QAYTADAN boshlanadi', () {
      // Ikkita ketma-ket burilish: 1000 m va 2000 m da.
      final engine = NavigationEngine(steps: [
        step(at: north(0), type: ManeuverType.depart, modifier: ManeuverModifier.none),
        step(at: north(1000)),
        step(at: north(2000), modifier: ManeuverModifier.left),
        step(at: north(3000), type: ManeuverType.arrive, modifier: ManeuverModifier.none),
      ]);

      engine.update(north(900)); // 1-burilish uchun `near`
      engine.update(north(1010)); // burilishni o'tdi

      // Ikkinchi burilishga 100 m qolganda — yangi manevr, yangi hisob.
      final second = engine.update(north(1900));
      expect(second.announcement?.phase, AnnouncementPhase.near);
      expect(second.announcement?.text, contains('Chapga buriling'));
    });

    test('reset() dan keyin marshrut qaytadan aytiladi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      expect(engine.update(north(900)).announcement, isNotNull);
      expect(engine.update(north(900)).announcement, isNull);

      // Marshrut qayta hisoblandi — eski "aytilgan" ro'yxati yaroqsiz.
      engine.reset();

      expect(engine.update(north(900)).announcement, isNotNull);
    });
  });

  group('NavigationEngine — qadamlar bo\'ylab siljish', () {
    test('depart qadami o\'tkazib yuboriladi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      // Birinchi ping haydovchi turgan joyning o'zidan — depart shu yerda.
      final progress = engine.update(north(0));

      expect(
        progress.step?.type,
        ManeuverType.turn,
        reason: '"Yo\'lni boshlang" ni haydovchi allaqachon biladi',
      );
      expect(progress.announcement, isNull);
    });

    test('bitta ping ichida bir nechta qadam o\'tib ketilsa ham quvib yetadi', () {
      final engine = NavigationEngine(steps: [
        step(at: north(0), type: ManeuverType.depart, modifier: ManeuverModifier.none),
        step(at: north(100)),
        step(at: north(200), modifier: ManeuverModifier.left),
        step(at: north(300), type: ManeuverType.arrive, modifier: ManeuverModifier.none),
      ]);

      // Tunnel/tarmoq uzilishi: keyingi ping darhol 300 m dan keldi.
      final progress = engine.update(north(300));

      expect(progress.isFinished, isTrue);
    });

    test('manevrga yaqin kelib uzoqlashsa keyingisiga o\'tadi', () {
      final engine = NavigationEngine(steps: [
        step(at: north(0), type: ManeuverType.depart, modifier: ManeuverModifier.none),
        step(at: north(1000)),
        step(at: north(2000), modifier: ManeuverModifier.left),
        step(at: north(3000), type: ManeuverType.arrive, modifier: ManeuverModifier.none),
      ]);

      // Keng chorraha: mashina manevr nuqtasiga atigi 50 m gacha yaqinlashdi
      // (25 m radiusiga umuman kirmadi), lekin burilishni bajardi.
      expect(engine.update(north(950)).step?.location.latitude,
          north(1000).latitude);

      // Endi uzoqlashyapti — burilish ortda qoldi.
      final after = engine.update(north(1100));

      expect(
        after.step?.modifier,
        ManeuverModifier.left,
        reason: 'Bajarilgan burilish ekranda osilib qolmasligi kerak',
      );
    });

    test('GPS shovqini "burildim" deb hisoblanmaydi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      // Manevrga 60 m qolib to'xtadi (svetofor).
      engine.update(north(940));
      // GPS 20 m chayqaldi — bu burilish emas.
      final jittered = engine.update(north(920));

      expect(
        jittered.step?.type,
        ManeuverType.turn,
        reason: 'Shovqin manevrni bajarilgan deb belgilamasligi kerak',
      );
    });

    test('marshrut tugagach ogohlantirish chiqmaydi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      final finished = engine.update(north(2000));
      expect(finished.isFinished, isTrue);
      expect(finished.announcement, isNull);
      expect(finished.step, isNull);
    });

    test('bo\'sh marshrutda yiqilmaydi va mazmunli matn qaytaradi', () {
      final engine = NavigationEngine(steps: const []);

      final progress = engine.update(kOrigin);

      expect(engine.hasRoute, isFalse);
      expect(progress.announcement, isNull);
      expect(progress.instruction, isNotEmpty);
      expect(progress.instruction, ManeuverPhrases.fallback);
    });
  });

  group('NavigationEngine — masofa va matn', () {
    test('manevrgacha qolgan masofani metrda beradi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      final progress = engine.update(north(700));

      expect(progress.distanceToManeuverMeters, closeTo(300, 5));
    });

    test('ko\'rsatma matni hech qachon bo\'sh emas', () {
      // Har masofa uchun YANGI dvigatel: bu test matnni tekshiradi,
      // qadamlar bo'ylab siljishni emas (u yuqoridagi guruhda).
      for (final metres in [0.0, 200.0, 900.0, 1500.0, 2100.0]) {
        final engine = NavigationEngine(steps: routeWithTurnAt(1000));
        expect(engine.update(north(metres)).instruction, isNotEmpty);
      }
    });

    test('ogohlantirish matnida masofa va yo\'nalish birga keladi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      final far = engine.update(north(510)).announcement;

      expect(far!.text, '500 metrdan keyin O\'ngga buriling, Navoiy ko\'chasi');
    });

    test('"hozir buriling" da masofa aytilmaydi', () {
      final engine = NavigationEngine(steps: routeWithTurnAt(1000));

      final immediate = engine.update(north(950)).announcement;

      expect(immediate!.phase, AnnouncementPhase.immediate);
      expect(immediate.text, isNot(contains('metrdan keyin')));
    });
  });
}
