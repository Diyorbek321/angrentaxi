import 'dart:convert';
import 'dart:io';

import 'package:angren_taxi/core/location/maneuver_phrases.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';

RouteStep _step(ManeuverType type, ManeuverModifier modifier, {int? exit}) => RouteStep(
      type: type,
      modifier: modifier,
      location: const LatLng(41.0, 70.0),
      distanceMeters: 100,
      durationSeconds: 20,
      name: 'Navoiy ko\'chasi',
      exit: exit,
    );

Map<String, dynamic> _catalogue() =>
    jsonDecode(File('tool/voice_clip_catalogue.json').readAsStringSync()) as Map<String, dynamic>;

Set<String> _catalogueIds() =>
    {for (final c in _catalogue()['clips'] as List<dynamic>) (c as Map<String, dynamic>)['id'] as String};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDownAll(() async {
    SharedPreferences.setMockInitialValues({'app_locale': 'uz'});
    LocaleController(await SharedPreferences.getInstance());
  });

  for (final locale in ['uz', 'ru']) {
    group('voice clips ($locale)', () {
      setUp(() async {
        SharedPreferences.setMockInitialValues({'app_locale': locale});
        LocaleController(await SharedPreferences.getInstance());
      });

      test('"100 metrdan keyin" + the maneuver, without the street name', () {
        final right = _step(ManeuverType.turn, ManeuverModifier.right);
        expect(ManeuverPhrases.voiceClipsFor(right, AnnouncementPhase.near), ['dist_100', 'shManeuverRight']);
        expect(ManeuverPhrases.voiceClipsFor(right, AnnouncementPhase.far), ['dist_500', 'shManeuverRight']);
        expect(ManeuverPhrases.voiceClipsFor(right, AnnouncementPhase.immediate), ['shManeuverRight']);
      });

      test('arrival uses the future form', () {
        final arrive = _step(ManeuverType.arrive, ManeuverModifier.none);
        expect(ManeuverPhrases.voiceClipsFor(arrive, AnnouncementPhase.near), ['dist_100', 'arrive_in']);
        expect(ManeuverPhrases.voiceClipsFor(arrive, AnnouncementPhase.immediate), ['shManeuverArrive']);
      });

      test('silent maneuvers produce no clips at all', () {
        expect(
          ManeuverPhrases.voiceClipsFor(_step(ManeuverType.merge, ManeuverModifier.left), AnnouncementPhase.near),
          isEmpty,
        );
        expect(
          ManeuverPhrases.voiceClipsFor(
              _step(ManeuverType.roundabout, ManeuverModifier.right, exit: 2), AnnouncementPhase.immediate),
          ['shManeuverRight'],
        );
      });

      test('every clip the engine can ask for exists in the catalogue', () {
        final ids = _catalogueIds();
        final asked = <String>{...ManeuverPhrases.reroutingClips};
        for (final type in ManeuverType.values) {
          for (final modifier in ManeuverModifier.values) {
            for (final exit in [null, 1, 3, 5, 6]) {
              for (final phase in AnnouncementPhase.values) {
                asked.addAll(ManeuverPhrases.voiceClipsFor(_step(type, modifier, exit: exit), phase));
              }
            }
          }
        }
        expect(asked.difference(ids), isEmpty, reason: 'clips with no recording → silence');
      });
    });
  }

  test('every catalogue entry points at a real ARB key in both languages', () {
    for (final lang in ['uz', 'ru']) {
      final arb = jsonDecode(File('lib/l10n/app_$lang.arb').readAsStringSync()) as Map<String, dynamic>;
      for (final c in _catalogue()['clips'] as List<dynamic>) {
        final key = (c as Map<String, dynamic>)['arb'] as String;
        expect(arb.containsKey(key), isTrue, reason: '$lang: $key');
      }
    }
  });
}
