import 'package:flutter_tts/flutter_tts.dart';

// ============================================================================
// OVOZLI KO'RSATMA
//
// Navigatsiya ko'rsatmalarini ovoz bilan aytadi. Haydovchi telefonga
// qaramasligi kerak — ovoz shu ekranning butun ma'nosi.
//
// ⚠️ TAKRORLANISHDAN HIMOYA BU YERDA EMAS. Bu sinf o'ziga berilgan gapni
// so'zsiz aytadi. "Nimani qachon aytish kerak" qarori — butunlay
// [NavigationEngine] da va o'sha yerda test qilingan. Ikkalasi aralashsa
// mantiq ikki joyga bo'linib, qaysi biri takrorlanishga yo'l qo'yganini
// topib bo'lmay qolardi.
// ============================================================================

/// TTS dvigateli ustidagi yupqa qatlam.
///
/// NEGA interfeys: `FlutterTts` platforma kanaliga bog'langan va oddiy
/// `flutter test` da ishlamaydi. Shu seam tufayli til tanlash mantig'i
/// qurilmasiz test qilinadi.
abstract class TtsEngine {
  Future<List<String>> languages();
  Future<void> setLanguage(String language);
  Future<void> setSpeechRate(double rate);
  Future<void> speak(String text);
  Future<void> stop();
}

/// Haqiqiy `flutter_tts` ustidagi amalga oshirish.
class FlutterTtsEngine implements TtsEngine {
  FlutterTtsEngine([FlutterTts? tts]) : _tts = tts ?? FlutterTts();

  final FlutterTts _tts;

  @override
  Future<List<String>> languages() async {
    final raw = await _tts.getLanguages;
    if (raw is! List) return const [];

    return raw.map((e) => e.toString()).toList();
  }

  @override
  Future<void> setLanguage(String language) => _tts.setLanguage(language);

  @override
  Future<void> setSpeechRate(double rate) => _tts.setSpeechRate(rate);

  @override
  Future<void> speak(String text) => _tts.speak(text);

  @override
  Future<void> stop() => _tts.stop();
}

/// Navigatsiya ko'rsatmalarini ovozda aytadi.
class VoiceGuide {
  VoiceGuide({TtsEngine? engine}) : _engine = engine ?? FlutterTtsEngine();

  final TtsEngine _engine;

  /// Afzal ko'rilgan tillar, tartib bo'yicha.
  ///
  /// uz-UZ ovozi O'zbekistonda sotiladigan telefonlarning ko'pida YO'Q —
  /// Google TTS uni hamma joyda tarqatmaydi. Ruscha ovoz esa deyarli har
  /// qanday qurilmada bor va o'zbekcha matnni kirill emas, lotin
  /// transliteratsiyasi sifatida o'qiydi — mukammal emas, lekin tushunarli
  /// va jimlikdan ancha yaxshi.
  static const List<String> preferredLanguages = ['uz-UZ', 'ru-RU'];

  /// Navigatsiya uchun biroz sekinlashtirilgan tezlik.
  ///
  /// Standart tezlik ko'cha nomlarini tanib bo'lmaydigan qilib yuboradi;
  /// haydovchi esa bir vaqtning o'zida yo'lga qaraydi.
  static const double speechRate = 0.5;

  bool _available = false;
  bool _initialised = false;

  /// TTS umuman gapira oladimi. `false` bo'lsa [speak] jimgina qaytadi.
  bool get isAvailable => _available;

  /// Mavjud tillarni tekshirib, eng mosini tanlaydi.
  ///
  /// Hech qanday mos til topilmasa ilova OVOZSIZ ishlaydi — bu KUTILGAN
  /// zaxira yo'l, xato emas: ekrandagi banner baribir ko'rsatmani ko'rsatib
  /// turadi va navigatsiya to'liq foydali qoladi.
  Future<void> init() async {
    if (_initialised) return;
    _initialised = true;

    try {
      final available = await _engine.languages();

      // Qurilmalar tilni turlicha yozadi: "uz-UZ", "uz_UZ", ba'zan faqat
      // "uz". Qat'iy tenglik bilan solishtirilsa mavjud ovoz topilmay
      // qolardi, shuning uchun normallashtirib taqqoslanadi.
      final normalised = {
        for (final language in available) _normalise(language): language,
      };

      for (final preferred in preferredLanguages) {
        final match = normalised[_normalise(preferred)] ??
            normalised[_languageOnly(preferred)];
        if (match == null) continue;

        await _engine.setLanguage(match);
        await _engine.setSpeechRate(speechRate);
        _available = true;
        return;
      }
    } catch (_) {
      // TTS dvigateli umuman o'rnatilmagan qurilma ham bor. Navigatsiya
      // shu sababdan yiqilmasligi kerak.
      _available = false;
    }
  }

  /// Bitta ko'rsatmani aytadi.
  ///
  /// Oldingi gap TO'XTATILADI: navigatsiyada eng yangi ko'rsatma eng
  /// muhimi. Navbatga qo'yilsa haydovchi allaqachon o'tib ketgan burilish
  /// haqida eshitib turardi.
  Future<void> speak(String text) async {
    if (!_available || text.isEmpty) return;

    try {
      await _engine.stop();
      await _engine.speak(text);
    } catch (_) {
      // Ovoz chiqmagani navigatsiyani to'xtatish uchun sabab emas.
    }
  }

  /// Ekran yopilganda gapirishni to'xtatadi.
  Future<void> stop() async {
    if (!_initialised) return;

    try {
      await _engine.stop();
    } catch (_) {
      // Ekran yopilyapti — bu yerda qiladigan ish qolmadi.
    }
  }

  /// "uz_UZ", "uz-uz", "UZ-UZ" — hammasi bitta ko'rinishga keladi.
  static String _normalise(String language) =>
      language.replaceAll('_', '-').toLowerCase();

  /// "uz-UZ" → "uz" — mintaqasiz mos kelishni tekshirish uchun.
  static String _languageOnly(String language) =>
      _normalise(language).split('-').first;
}
