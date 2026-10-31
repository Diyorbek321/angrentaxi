// VoiceGuide — ovozli ko'rsatma va til tanlash.
//
// Eng muhimi: uz-UZ ovozi O'zbekistonda sotiladigan telefonlarning ko'pida
// YO'Q. Shuning uchun uz-UZ → ru-RU → OVOZSIZ zanjiri qurilmasiz test
// qilinadi — aks holda buni faqat haydovchining telefonida bilib olardik.

import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:flutter_test/flutter_test.dart';

/// TTS dvigatelining soxta nusxasi — platforma kanalisiz.
class FakeTtsEngine implements TtsEngine {
  FakeTtsEngine(this._languages);

  final List<String> _languages;

  String? language;
  double? rate;
  final List<String> spoken = [];
  int stopCount = 0;

  /// `true` bo'lsa har chaqiruv xato ko'taradi — TTS umuman o'rnatilmagan
  /// qurilmani taqlid qiladi.
  bool throwOnEverything = false;

  @override
  Future<List<String>> languages() async {
    if (throwOnEverything) throw Exception('TTS yo\'q');
    return _languages;
  }

  @override
  Future<void> setLanguage(String value) async {
    if (throwOnEverything) throw Exception('TTS yo\'q');
    language = value;
  }

  @override
  Future<void> setSpeechRate(double value) async => rate = value;

  @override
  Future<void> speak(String text) async {
    if (throwOnEverything) throw Exception('TTS yo\'q');
    spoken.add(text);
  }

  @override
  Future<void> stop() async => stopCount++;
}

void main() {
  group('VoiceGuide — til tanlash', () {
    test('uz-UZ mavjud bo\'lsa o\'zbekcha ovoz tanlanadi', () async {
      final tts = FakeTtsEngine(['en-US', 'ru-RU', 'uz-UZ']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();

      expect(tts.language, 'uz-UZ');
      expect(guide.isAvailable, isTrue);
    });

    test('uz-UZ bo\'lmasa ru-RU ga tushadi', () async {
      final tts = FakeTtsEngine(['en-US', 'ru-RU']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();

      expect(tts.language, 'ru-RU');
      expect(guide.isAvailable, isTrue);
    });

    test('ikkalasi ham bo\'lmasa OVOZSIZ ishlaydi, yiqilmaydi', () async {
      final tts = FakeTtsEngine(['en-US', 'de-DE']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();
      await guide.speak('O\'ngga buriling');

      expect(guide.isAvailable, isFalse);
      expect(tts.spoken, isEmpty);
    });

    test('qurilmada TTS umuman bo\'lmasa ham xato ko\'tarilmaydi', () async {
      final tts = FakeTtsEngine([])..throwOnEverything = true;
      final guide = VoiceGuide(engine: tts);

      await guide.init();
      await guide.speak('O\'ngga buriling');

      expect(guide.isAvailable, isFalse);
    });

    test('til kodi pastki chiziq bilan yozilsa ham tanib oladi', () async {
      // Android ba'zi qurilmalarda "uz_UZ" ko'rinishida qaytaradi.
      final tts = FakeTtsEngine(['en_US', 'uz_UZ']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();

      expect(tts.language, 'uz_UZ');
      expect(guide.isAvailable, isTrue);
    });

    test('mintaqasiz "uz" kodi ham qabul qilinadi', () async {
      final tts = FakeTtsEngine(['en', 'uz']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();

      expect(tts.language, 'uz');
    });

    test('navigatsiya uchun sekinlashtirilgan tezlik o\'rnatiladi', () async {
      final tts = FakeTtsEngine(['uz-UZ']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();

      expect(tts.rate, VoiceGuide.speechRate);
    });
  });

  group('VoiceGuide — gapirish', () {
    test('yangi ko\'rsatma eskisini TO\'XTATADI', () async {
      final tts = FakeTtsEngine(['uz-UZ']);
      final guide = VoiceGuide(engine: tts);
      await guide.init();

      await guide.speak('Chapga buriling');

      // Navbatga qo'yilsa haydovchi allaqachon o'tib ketgan burilish
      // haqida eshitib turardi.
      expect(tts.stopCount, 1);
      expect(tts.spoken, ['Chapga buriling']);
    });

    test('bo\'sh matn aytilmaydi', () async {
      final tts = FakeTtsEngine(['uz-UZ']);
      final guide = VoiceGuide(engine: tts);
      await guide.init();

      await guide.speak('');

      expect(tts.spoken, isEmpty);
    });

    test('init chaqirilmagan bo\'lsa jim qoladi', () async {
      final tts = FakeTtsEngine(['uz-UZ']);
      final guide = VoiceGuide(engine: tts);

      await guide.speak('Chapga buriling');

      expect(tts.spoken, isEmpty);
    });

    test('init faqat bir marta ishlaydi', () async {
      final tts = FakeTtsEngine(['uz-UZ']);
      final guide = VoiceGuide(engine: tts);

      await guide.init();
      tts.language = null;
      await guide.init();

      expect(tts.language, isNull);
    });
  });
}
