// ManeuverPhrases — OSRM manevrlarini o'zbekcha gapga aylantirish.
//
// Asosiy talab: haydovchi HECH QACHON bo'sh yozuv ham, inglizcha gap ham
// ko'rmasligi/eshitmasligi kerak. OSRM yangi manevr turi qo'shsa yoki
// modifikatorni yubormasa ham navigatsiya mazmunli qolishi shart.

import 'package:angren_taxi/core/location/maneuver_phrases.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

RouteStep step(
  ManeuverType type,
  ManeuverModifier modifier, {
  String name = '',
  int? exit,
}) {
  return RouteStep(
    type: type,
    modifier: modifier,
    location: const LatLng(41.0, 70.0),
    distanceMeters: 100,
    durationSeconds: 20,
    name: name,
    exit: exit,
  );
}

/// Lotin o'zbek alifbosida yo'q, lekin inglizcha ko'rsatmalarda tez-tez
/// uchraydigan so'zlar — matnga tarjima qilinmagan satr o'tib ketmaganini
/// shu ro'yxat ushlaydi.
const List<String> kEnglishLeakWords = [
  'turn',
  'left',
  'right',
  'straight',
  'continue',
  'roundabout',
  'exit',
  'merge',
  'arrive',
  'depart',
  'fork',
  'ramp',
  'destination',
  'head',
  'onto',
  'slight',
  'sharp',
  'uturn',
];

void main() {
  group('ManeuverPhrases — to\'liq qamrov', () {
    test('HAR BIR tur/modifikator juftligi bo\'sh bo\'lmagan matn beradi', () {
      for (final type in ManeuverType.values) {
        for (final modifier in ManeuverModifier.values) {
          final text = ManeuverPhrases.instructionFor(step(type, modifier));

          expect(
            text.trim(),
            isNotEmpty,
            reason: '$type / $modifier uchun matn bo\'sh qoldi',
          );
        }
      }
    });

    test('hech bir juftlikda inglizcha so\'z qolib ketmagan', () {
      for (final type in ManeuverType.values) {
        for (final modifier in ManeuverModifier.values) {
          final text =
              ManeuverPhrases.instructionFor(step(type, modifier)).toLowerCase();

          for (final english in kEnglishLeakWords) {
            expect(
              text,
              isNot(contains(english)),
              reason: '$type / $modifier matnida inglizcha "$english" qoldi',
            );
          }
        }
      }
    });

    test('har bosqichdagi ogohlantirish ham bo\'sh emas', () {
      for (final type in ManeuverType.values) {
        for (final phase in AnnouncementPhase.values) {
          final text = ManeuverPhrases.announcementFor(
            step(type, ManeuverModifier.none),
            phase,
          );

          expect(text.trim(), isNotEmpty, reason: '$type / $phase bo\'sh');
        }
      }
    });
  });

  group('ManeuverPhrases — noma\'lum va yetishmayotgan ma\'lumot', () {
    test('noma\'lum turda ham yo\'nalish saqlanib qoladi', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.unknown, ManeuverModifier.left),
      );

      expect(
        text,
        contains('Chapga'),
        reason: 'Tur noma\'lum bo\'lsa ham modifikator foydali ma\'lumot',
      );
    });

    test('tur ham, yo\'nalish ham noma\'lum bo\'lsa umumiy maslahat beradi', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.unknown, ManeuverModifier.none),
      );

      expect(text, ManeuverPhrases.fallback);
      expect(text, isNotEmpty);
    });

    test('modifikatorsiz burilishda yo\'nalish O\'YLAB TOPILMAYDI', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.turn, ManeuverModifier.none),
      );

      // Noto'g'ri tomonni aytish — jim qolishdan ham xavfli.
      expect(text, isNot(contains('ngga')));
      expect(text, isNot(contains('Chapga')));
      expect(text, ManeuverPhrases.fallback);
    });

    test('ko\'cha nomi bo\'sh bo\'lsa osilib qolgan vergul chiqmaydi', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.turn, ManeuverModifier.right),
      );

      expect(text, 'O\'ngga buriling');
      expect(text, isNot(endsWith(',')));
    });
  });

  group('ManeuverPhrases — mazmun', () {
    test('ko\'cha nomi ko\'rsatmaga qo\'shiladi', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.turn, ManeuverModifier.right, name: 'Navoiy ko\'chasi'),
      );

      expect(text, 'O\'ngga buriling, Navoiy ko\'chasi');
    });

    test('aylanmada chiqish raqami aytiladi', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.roundabout, ManeuverModifier.right, exit: 2),
      );

      expect(text, contains('2-chiqish'));
    });

    test('chiqish raqami noma\'lum aylanmada ham gap to\'g\'ri qoladi', () {
      final text = ManeuverPhrases.instructionFor(
        step(ManeuverType.roundabout, ManeuverModifier.right),
      );

      expect(text, 'Aylanmaga kiring');
    });

    test('uzoq bosqichda "yetib borasiz" kelasi zamonda aytiladi', () {
      final text = ManeuverPhrases.announcementFor(
        step(ManeuverType.arrive, ManeuverModifier.none),
        AnnouncementPhase.far,
      );

      // "500 metrdan keyin manzilga yetib keldingiz" — mantiqsiz gap.
      expect(text, '500 metrdan keyin manzilga yetib borasiz');
    });

    test('oxirgi bosqichda masofa aytilmaydi', () {
      final text = ManeuverPhrases.announcementFor(
        step(ManeuverType.turn, ManeuverModifier.left),
        AnnouncementPhase.immediate,
      );

      expect(text, 'Chapga buriling');
    });
  });
}
