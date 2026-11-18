import 'dart:async';

import 'package:angren_taxi/core/location/voice_clip_player.dart';
import 'package:angren_taxi/l10n/l10n.dart';
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
  VoiceGuide({TtsEngine? engine, ClipPlayer? clips})
      : _engine = engine ?? FlutterTtsEngine(),
        _clips = clips ?? const AssetClipPlayer();

  final TtsEngine _engine;
  final ClipPlayer _clips;

  /// Joriy til uchun o'rnatilgan bo'laklar. Bo'sh — bo'laklar yaratilmagan
  /// (Azure kaliti hali yo'q) yoki ilova tili uchun yo'q: TTS ishlatiladi.
  Set<String> _installedClips = const {};

  /// Bo'lak ijro etilganmi — faqat shunda to'xtatish buyrug'i yuboriladi
  /// (har gapda ortiqcha platforma chaqiruvi bo'lmasin).
  bool _clipsStarted = false;

  /// Bo'lak papkasi: ilova tili ruscha bo'lsa `ru`, aks holda `uz`.
  static String get clipLanguage => AppL10n.localeName.startsWith('ru') ? 'ru' : 'uz';

  /// Afzal ko'rilgan tillar, tartib bo'yicha.
  ///
  /// uz-UZ ovozi O'zbekistonda sotiladigan telefonlarning ko'pida YO'Q —
  /// Google TTS uni hamma joyda tarqatmaydi. Ruscha ovoz esa deyarli har
  /// qanday qurilmada bor va o'zbekcha matnni kirill emas, lotin
  /// transliteratsiyasi sifatida o'qiydi — mukammal emas, lekin tushunarli
  /// va jimlikdan ancha yaxshi.
  ///
  /// Ilova tili ruscha bo'lsa ko'rsatmalar ham ruscha (kirill) — ularni
  /// faqat ruscha ovoz o'qiy oladi, shuning uchun uz-UZ tanlanmaydi.
  static List<String> get preferredLanguages =>
      AppL10n.localeName.startsWith('ru')
          ? const ['ru-RU']
          : const ['uz-UZ', 'ru-RU'];

  /// Navigatsiya uchun biroz sekinlashtirilgan tezlik.
  ///
  /// Standart tezlik ko'cha nomlarini tanib bo'lmaydigan qilib yuboradi;
  /// haydovchi esa bir vaqtning o'zida yo'lga qaraydi.
  static const double speechRate = 0.5;

  bool _available = false;
  bool _initialised = false;

  /// Biror ovoz bormi — yozib olingan bo'laklar YOKI TTS. `false` bo'lsa
  /// [speak] jimgina qaytadi.
  bool get isAvailable => _available || _installedClips.isNotEmpty;

  /// Mavjud tillarni tekshirib, eng mosini tanlaydi.
  ///
  /// Hech qanday mos til topilmasa ilova OVOZSIZ ishlaydi — bu KUTILGAN
  /// zaxira yo'l, xato emas: ekrandagi banner baribir ko'rsatmani ko'rsatib
  /// turadi va navigatsiya to'liq foydali qoladi.
  Future<void> init() async {
    if (_initialised) return;
    _initialised = true;

    // Bo'laklar TTS'dan MUSTAQIL: o'zbekcha ovozsiz telefonda aynan ular
    // gapiradi, shuning uchun TTS topilmasa ham ular yuklanadi.
    //
    // ⚠️ KUTILMAYDI: asset ro'yxatini o'qish sekin bo'lishi mumkin va
    // navigatsiya (birinchi ko'rsatma) uni kutib qolmasligi kerak. Ro'yxat
    // kelguncha aytilgan gap TTS bilan aytiladi — bu xavfsiz zaxira.
    unawaited(_clips.available(clipLanguage).then((ids) => _installedClips = ids));

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
  ///
  /// [clips] — xuddi shu gap yozib olingan bo'laklar sifatida. HAMMASI
  /// o'rnatilgan bo'lsa ular ijro etiladi; bittasi ham yo'q bo'lsa — TTS
  /// (yarim gap aytishdan ko'ra butun gapni sun'iy ovozda aytgan yaxshi).
  Future<void> speak(String text, {List<String> clips = const []}) async {
    if (text.isEmpty && clips.isEmpty) return;

    final useClips = clips.isNotEmpty && clips.every(_installedClips.contains);
    try {
      if (_available) await _engine.stop();
      if (_clipsStarted) await _clips.stop();
      if (useClips) {
        _clipsStarted = true;
        await _clips.play(clipLanguage, clips);
        return;
      }
      if (_available && text.isNotEmpty) await _engine.speak(text);
    } catch (_) {
      // Ovoz chiqmagani navigatsiyani to'xtatish uchun sabab emas.
    }
  }

  /// Ekran yopilganda gapirishni to'xtatadi.
  Future<void> stop() async {
    if (!_initialised) return;

    try {
      if (_clipsStarted) await _clips.stop();
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
