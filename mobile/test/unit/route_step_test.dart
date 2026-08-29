// RouteStep — OSRM `legs[].steps[]` ni manevr modeliga aylantirish.
//
// OSRM javobi ilova nazorat qilmaydigan tashqi ma'lumot: profil boshqacha
// bo'lsa `name` yoki `modifier` umuman kelmaydi, demo server esa formatni
// o'zgartirishi mumkin. Bitta yo'q maydon butun navigatsiyani yiqitmasligi
// shart — shuning uchun har bir himoya alohida test qilinadi.

import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> osrmStep({
  String type = 'turn',
  String? modifier = 'right',
  List<dynamic>? location,
  Object? distance = 120.5,
  Object? duration = 30.2,
  Object? name = 'Navoiy',
  int? exit,
}) {
  return {
    'distance': distance,
    'duration': duration,
    'name': name,
    'maneuver': {
      'type': type,
      if (modifier != null) 'modifier': modifier,
      'location': location ?? [70.1436, 41.0167],
      if (exit != null) 'exit': exit,
    },
  };
}

void main() {
  group('RouteStep.fromOsrmJson', () {
    test('to\'liq qadamni o\'qiydi', () {
      final step = RouteStep.fromOsrmJson(osrmStep())!;

      expect(step.type, ManeuverType.turn);
      expect(step.modifier, ManeuverModifier.right);
      expect(step.distanceMeters, 120.5);
      expect(step.durationSeconds, 30.2);
      expect(step.name, 'Navoiy');
    });

    test('koordinata [lng, lat] tartibida keladi va almashtiriladi', () {
      final step = RouteStep.fromOsrmJson(osrmStep())!;

      // Teskari o'qilsa mashina Hindiston okeanida ko'rinardi.
      expect(step.location.latitude, 41.0167);
      expect(step.location.longitude, 70.1436);
    });

    test('maneuver bo\'lmasa null qaytaradi', () {
      expect(RouteStep.fromOsrmJson({'distance': 10}), isNull);
    });

    test('koordinata yetishmasa null qaytaradi', () {
      expect(
        RouteStep.fromOsrmJson(osrmStep(location: [70.1436])),
        isNull,
      );
    });

    test('koordinata son bo\'lmasa null qaytaradi', () {
      expect(
        RouteStep.fromOsrmJson(osrmStep(location: ['a', 'b'])),
        isNull,
      );
    });

    test('modifier yuborilmasa none bo\'ladi, qadam yo\'qolmaydi', () {
      final step = RouteStep.fromOsrmJson(osrmStep(modifier: null))!;

      expect(step.modifier, ManeuverModifier.none);
    });

    test('name yuborilmasa bo\'sh satr bo\'ladi', () {
      final step = RouteStep.fromOsrmJson(osrmStep(name: null))!;

      expect(step.name, '');
    });

    test('distance/duration son bo\'lmasa nolga tushadi', () {
      final step =
          RouteStep.fromOsrmJson(osrmStep(distance: 'x', duration: null))!;

      expect(step.distanceMeters, 0);
      expect(step.durationSeconds, 0);
    });

    test('aylanmadagi chiqish raqamini o\'qiydi', () {
      final step =
          RouteStep.fromOsrmJson(osrmStep(type: 'roundabout', exit: 3))!;

      expect(step.exit, 3);
    });
  });

  group('RouteStep.parseType', () {
    test('OSRM ikki so\'zli turlarini tanib oladi', () {
      expect(RouteStep.parseType('new name'), ManeuverType.newName);
      expect(RouteStep.parseType('end of road'), ManeuverType.endOfRoad);
      expect(RouteStep.parseType('roundabout turn'), ManeuverType.roundaboutTurn);
      expect(RouteStep.parseType('exit roundabout'), ManeuverType.exitRoundabout);
      expect(RouteStep.parseType('on ramp'), ManeuverType.onRamp);
      expect(RouteStep.parseType('off ramp'), ManeuverType.offRamp);
    });

    test('`continue` alohida nom bilan saqlanadi', () {
      // Dart'da `continue` kalit so'z — shuning uchun `straightOn`.
      expect(RouteStep.parseType('continue'), ManeuverType.straightOn);
    });

    test('notanish tur unknown ga tushadi, xato ko\'tarilmaydi', () {
      expect(RouteStep.parseType('teleport'), ManeuverType.unknown);
      expect(RouteStep.parseType(null), ManeuverType.unknown);
      expect(RouteStep.parseType(42), ManeuverType.unknown);
    });
  });

  group('RouteStep.parseModifier', () {
    test('barcha yo\'nalishlarni o\'qiydi', () {
      expect(RouteStep.parseModifier('sharp left'), ManeuverModifier.sharpLeft);
      expect(RouteStep.parseModifier('slight right'), ManeuverModifier.slightRight);
      expect(RouteStep.parseModifier('uturn'), ManeuverModifier.uturn);
    });

    test('notanish modifikator none ga tushadi', () {
      expect(RouteStep.parseModifier('sideways'), ManeuverModifier.none);
      expect(RouteStep.parseModifier(null), ManeuverModifier.none);
    });
  });

  group('RouteStep.fromOsrmLegs', () {
    test('bir nechta leg qadamlarini BITTA ketma-ketlikka qo\'shadi', () {
      final steps = RouteStep.fromOsrmLegs([
        {
          'steps': [osrmStep(type: 'depart'), osrmStep()]
        },
        {
          'steps': [osrmStep(type: 'arrive')]
        },
      ]);

      // Oraliq nuqtali buyurtmada OSRM marshrutni bo'ladi, haydovchi uchun
      // esa bu bitta uzluksiz yo'l.
      expect(steps, hasLength(3));
      expect(steps.first.type, ManeuverType.depart);
      expect(steps.last.type, ManeuverType.arrive);
    });

    test('legs null bo\'lsa bo\'sh ro\'yxat qaytaradi', () {
      expect(RouteStep.fromOsrmLegs(null), isEmpty);
    });

    test('buzuq qadam butun marshrutni yiqitmaydi, faqat o\'zi tashlanadi', () {
      final steps = RouteStep.fromOsrmLegs([
        {
          'steps': [
            osrmStep(),
            {'maneuver': 'buzuq'},
            osrmStep(type: 'arrive'),
          ]
        },
      ]);

      expect(steps, hasLength(2));
    });

    test('kutilmagan tuzilma xato ko\'tarmaydi', () {
      expect(RouteStep.fromOsrmLegs(['satr', 42, <String, dynamic>{}]), isEmpty);
      expect(
        RouteStep.fromOsrmLegs([
          {'steps': 'ro\'yxat emas'}
        ]),
        isEmpty,
      );
    });
  });
}
