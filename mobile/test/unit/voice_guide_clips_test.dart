import 'package:angren_taxi/core/location/voice_clip_player.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:flutter_test/flutter_test.dart';

class _Tts implements TtsEngine {
  _Tts(this.langs);
  final List<String> langs;
  final spoken = <String>[];

  @override
  Future<List<String>> languages() async => langs;
  @override
  Future<void> setLanguage(String language) async {}
  @override
  Future<void> setSpeechRate(double rate) async {}
  @override
  Future<void> speak(String text) async => spoken.add(text);
  @override
  Future<void> stop() async {}
}

class _Clips implements ClipPlayer {
  _Clips(this.installed);
  final Set<String> installed;
  final played = <List<String>>[];
  int stops = 0;

  @override
  Future<Set<String>> available(String language) async => installed;
  @override
  Future<bool> play(String language, List<String> clipIds) async {
    played.add(clipIds);
    return true;
  }

  @override
  Future<void> stop() async => stops++;
}

void main() {
  Future<VoiceGuide> ready(_Tts tts, _Clips clips) async {
    final guide = VoiceGuide(engine: tts, clips: clips);
    await guide.init();
    await Future<void>.delayed(Duration.zero); // clip list loads in the background
    return guide;
  }

  test('recorded clips win when every piece is installed', () async {
    final tts = _Tts(['ru-RU']);
    final clips = _Clips({'dist_100', 'shManeuverRight'});
    final guide = await ready(tts, clips);

    await guide.speak('100 metrdan keyin O\'ngga buriling', clips: ['dist_100', 'shManeuverRight']);

    expect(clips.played, [
      ['dist_100', 'shManeuverRight'],
    ]);
    expect(tts.spoken, isEmpty);
  });

  test('one missing piece → the whole sentence goes to TTS, never half a sentence', () async {
    final tts = _Tts(['ru-RU']);
    final clips = _Clips({'dist_100'});
    final guide = await ready(tts, clips);

    await guide.speak('100 metrdan keyin O\'ngga buriling', clips: ['dist_100', 'shManeuverRight']);

    expect(clips.played, isEmpty);
    expect(tts.spoken, ['100 metrdan keyin O\'ngga buriling']);
  });

  test('a phone with no TTS voice at all still speaks from clips', () async {
    final tts = _Tts(const []);
    final clips = _Clips({'shManeuverLeft'});
    final guide = await ready(tts, clips);

    expect(guide.isAvailable, isTrue);
    await guide.speak('Chapga buriling', clips: ['shManeuverLeft']);
    expect(clips.played.single, ['shManeuverLeft']);
  });

  test('a new sentence cuts the previous recording', () async {
    final clips = _Clips({'shManeuverLeft', 'shManeuverRight'});
    final guide = await ready(_Tts(['uz-UZ']), clips);

    await guide.speak('a', clips: ['shManeuverLeft']);
    await guide.speak('b', clips: ['shManeuverRight']);
    expect(clips.stops, 1);
  });
}
