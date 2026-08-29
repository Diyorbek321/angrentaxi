import 'dart:convert';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/location/daylight.dart';
import 'package:flutter/services.dart' show rootBundle;

/// Xarita uslubining ikki varianti.
///
/// [light] — kunduzgi, ilovaning asosiy temasi.
/// [dark] — tungi navigatsiya. Haydovchi kechasi soatlab xaritaga qaraydi;
/// oq fon qorong'ida ko'zni qamashtiradi va yo'lni ko'rishga xalaqit beradi.
enum AppMapStyle { light, dark }

/// Angren Taxi'ning O'Z xarita uslubi.
///
/// Nega tayyor `streets-v2` emas: MapTiler'ning tayyor uslubi umumiy
/// maqsadli xarita — ko'k yo'llar, sariq magistrallar, o'nlab POI ikonasi.
/// U turizm xaritasi uchun to'g'ri, taksi uchun emas. Taksida xarita FON
/// bo'lishi kerak: ekrandagi eng yorqin element — marshrut chizig'i va
/// haydovchi markeri, xarita esa ular ortida jim turishi lozim.
///
/// Shuning uchun uslub qo'lda yozilgan (`assets/map/style_*.json`) va
/// ranglari `app_theme.dart` tokenlaridan olingan — xarita ham, interfeys
/// ham bitta palitrada.
class MapStyleLoader {
  MapStyleLoader._();

  /// Uslub JSON'i o'zgarmaydi, lekin har xarita ochilishida assetdan o'qish
  /// va satr almashtirish ortiqcha ish — bir marta o'qib saqlaymiz.
  static final Map<AppMapStyle, String> _cache = {};

  static const Map<AppMapStyle, String> _assets = {
    AppMapStyle.light: 'assets/map/style_light.json',
    AppMapStyle.dark: 'assets/map/style_dark.json',
  };

  /// Uslub hujjatini tayyor holda qaytaradi.
  ///
  /// MapLibre `styleString` ga URL ham, to'liq JSON hujjat ham berish
  /// mumkin — biz ikkinchisini beramiz, chunki uslub bizniki.
  static Future<String> load(AppMapStyle style) async {
    final cached = _cache[style];
    if (cached != null) return cached;

    final raw = await rootBundle.loadString(_assets[style]!);

    // Faqat `{MAPTILER_KEY}` ni almashtiramiz. JSON'dagi `{fontstack}` va
    // `{range}` — MapLibre'ning o'z shablonlari, ularga tegilmaydi.
    final withKey = raw.replaceAll('{MAPTILER_KEY}', AppConfig.mapTilerKey);

    final resolved = _applySelfHostedSource(withKey);

    _cache[style] = resolved;
    return resolved;
  }

  /// O'zini hostlash sozlangan bo'lsa, uslubdagi tile va shrift manbasini
  /// almashtiradi.
  ///
  /// ⚠️ NEGA JSON PARS QILINADI, satr almashtirish emas. Manba URL'i
  /// uslubda ikki joyda uchraydi (`sources` va `glyphs`) va ularning
  /// formati bir xil emas — ko'r-ko'rona `replaceAll` `glyphs` dagi
  /// `{fontstack}` shablonini ham buzib qo'yardi. Hujjat kichik, pars
  /// qilish arzon va tuzilma xatosi darhol ko'rinadi.
  ///
  /// Sozlanmagan bo'lsa hujjat O'ZGARMASDAN qaytadi — MapTiler yo'li
  /// standart bo'lib qoladi.
  static String _applySelfHostedSource(String styleJson) =>
      applySelfHostedSource(
        styleJson,
        tilesUrl: AppConfig.mapTilesUrl,
        glyphsUrl: AppConfig.mapGlyphsUrl,
      );

  /// Sof (pure) variant — testdan chaqirish uchun ochiq.
  ///
  /// ⚠️ NEGA PARAMETRLI. `AppConfig.mapTilesUrl` — `String.fromEnvironment`,
  /// ya'ni KOMPILYATSIYA vaqtidagi konstanta. Uni testda o'zgartirib
  /// bo'lmaydi, shuning uchun mantiq qiymatlarni argument sifatida oladi va
  /// sozlamani o'qish yupqa o'ram (`_applySelfHostedSource`) zimmasida
  /// qoladi. Aks holda bu almashtirish umuman testlanmasdi.
  static String applySelfHostedSource(
    String styleJson, {
    required String tilesUrl,
    required String glyphsUrl,
  }) {
    // Yarim sozlangan holatda MapTiler yo'lida qolamiz — u ishlaydi.
    if (tilesUrl.isEmpty || glyphsUrl.isEmpty) return styleJson;

    final doc = jsonDecode(styleJson) as Map<String, dynamic>;

    final sources = doc['sources'] as Map<String, dynamic>?;
    final openmaptiles = sources?['openmaptiles'] as Map<String, dynamic>?;
    // Uslub kutilgan tuzilmada bo'lmasa hujjatni BUZMAYMIZ — o'zgarishsiz
    // qaytaramiz. Bo'sh xaritadan ko'ra eski manba yaxshiroq.
    if (openmaptiles == null) return styleJson;

    // PMTiles bitta fayl — `tiles.json` emas, shuning uchun `url` o'rniga
    // to'g'ridan-to'g'ri manba beriladi.
    openmaptiles['url'] = tilesUrl;
    doc['glyphs'] = glyphsUrl;

    return jsonEncode(doc);
  }

  /// O'zini hostlash TO'LIQ sozlanganmi.
  ///
  /// Ataylab "ikkalasi ham" shart: faqat tile manbasini bergan build
  /// yorliqsiz xarita chizadi va bu prodda sezilmay qolishi mumkin.
  /// Yarim sozlangan holatda MapTiler yo'lida qolamiz — u ishlaydi.
  static bool get selfHostedIsComplete =>
      AppConfig.mapTilesUrl.isNotEmpty && AppConfig.mapGlyphsUrl.isNotEmpty;

  /// Hozirgi vaqtga mos uslub: quyosh botganidan keyin tungi, aks holda
  /// kunduzgi.
  ///
  /// Koordinata sifatida shahar markazi olinadi — bitta shahar ichida
  /// quyosh botishi soniyalar bilan farq qiladi, haydovchining aniq
  /// joylashuvini kutib o'tirishning ma'nosi yo'q.
  static AppMapStyle styleForNow({DateTime? now}) {
    final night = Daylight.isNight(
      at: now ?? DateTime.now(),
      latitude: AppConfig.defaultLat,
      longitude: AppConfig.defaultLng,
    );
    return night ? AppMapStyle.dark : AppMapStyle.light;
  }

  /// Testlar uchun keshni tozalash.
  static void resetCacheForTest() => _cache.clear();
}
