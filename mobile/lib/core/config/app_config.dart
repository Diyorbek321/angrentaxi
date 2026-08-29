enum AppFlavor { passenger, driver }

class AppConfig {
  AppConfig._();

  // Overridable at build time so the same source can target prod or a local
  // dev backend, e.g.:
  //   --dart-define=API_BASE_URL=http://192.168.x.x:3000/api/v1
  //   --dart-define=WS_URL=http://192.168.x.x:3000
  // Defaults to the production endpoints when no override is supplied.
  //
  // NOTE: api.angren-taxi.uz is a future custom domain that has not been
  // launched yet (does not resolve / no live server). Until it's live, the
  // default points at the real production backend hosted on Railway.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://angrentaxi-production.up.railway.app/api/v1',
  );
  static const String wsUrl = String.fromEnvironment(
    'WS_URL',
    defaultValue: 'wss://angrentaxi-production.up.railway.app',
  );

  /// Offline demo mode. Built with `--dart-define=DEMO_MODE=true`, it makes the
  /// app run fully standalone with canned data and a scripted trip lifecycle —
  /// no backend or internet required. Defaults to false for real builds.
  static const bool demoMode =
      bool.fromEnvironment('DEMO_MODE', defaultValue: false);

  /// Displayed app version. Keep in step with `version:` in pubspec.yaml —
  /// the settings screen used to hardcode an unrelated '2.4.0' while the
  /// about dialog said '1.0.0'.
  static const String appVersion = '1.0.0';

  static const Duration otpResendDuration = Duration(seconds: 60);
  static const Duration orderOfferTimeout = Duration(seconds: 15);
  static const int locationUpdateDistanceFilter = 10; // meters

  /// Angren shahar markazi — GPS hali kelmaganda xarita shu yerdan ochiladi.
  ///
  /// ⚠️ Ilgari bu yerda `40.1392, 69.1225` turardi va izohda "Angren city
  /// center" deb yozilgandi. Aslida u nuqta Tojikistonning Istaravshan
  /// tumanida, Angrendan ~130 km narida — ya'ni joylashuvga ruxsat
  /// berilmagan yoki GPS hali ulgurmagan har bir foydalanuvchi xaritani
  /// boshqa davlatdagi tog'lardan ochardi.
  ///
  /// Qiymat OSM/Nominatim bo'yicha tekshirilgan: "Angren shahri, Toshkent
  /// Viloyati, O'zbekiston".
  static const double defaultLat = 41.0212;
  static const double defaultLng = 70.0795;

  // ===== Xarita (MapTiler) =====
  // MapTiler'dan faqat VEKTOR PLITKALAR va shriftlar olinadi. Uslubning
  // o'zi bizniki: `assets/map/style_light.json` va `style_dark.json`,
  // ranglari `app_theme.dart` tokenlaridan. Yuklash — `MapStyleLoader`.
  //
  // Ilgari bu yerda `MAP_STYLE=streets-v2` bo'lib, MapTiler'ning tayyor
  // uslubi ishlatilardi. U umumiy maqsadli xarita — ko'k yo'llar, sariq
  // magistrallar, o'nlab POI ikonasi — va marshrut chizig'i uning ichida
  // yo'qolib ketardi.
  //
  // Kalitni build vaqtida almashtirish mumkin:
  //   --dart-define=MAPTILER_KEY=xxxx
  // ⚠️ STANDART QIYMAT YO'Q — ATAYLAB.
  //
  // Ilgari bu yerda haqiqiy kalit turardi. MapTiler klient kaliti tabiatan
  // ochiq (u APK ichida baribir yetkaziladi), lekin repoda turgan kalit
  // botlar tomonidan skrap qilinadi va kvotani begona odam sarflaydi —
  // APK dan chiqarib olishdan ancha oson.
  //
  // Build vaqtida beriladi:
  //   flutter build apk --dart-define=MAPTILER_KEY=xxxx
  //
  // Bo'sh qolsa xarita plitkalari yuklanmaydi (interfeys ishlaydi).
  static const String mapTilerKey = String.fromEnvironment('MAPTILER_KEY');

  // ===== O'ZINI HOSTLASH (PMTiles) — ixtiyoriy =====
  //
  // Bo'sh bo'lsa ilova MapTiler'dan o'qiydi (yuqoridagi kalit bilan) —
  // ya'ni bu maydonlar HECH NARSANI buzmaydi va standart xulq o'zgarmaydi.
  //
  // To'ldirilsa, uslubdagi manba shu manzilga almashadi:
  //   --dart-define=MAP_TILES_URL=pmtiles://https://<r2>/uzbekistan.pmtiles
  //   --dart-define=MAP_GLYPHS_URL=https://<r2>/fonts/{fontstack}/{range}.pbf
  //
  // ⚠️ IKKALASI BIRGA to'ldirilishi kerak. Faqat tile manbasini almashtirsa,
  // `glyphs` hamon MapTiler'ga ishora qiladi va yorliqlar yo'qoladi —
  // xarita chiziladi, lekin ko'cha nomlarisiz. Buni tekshirish uchun
  // `MapStyleLoader.selfHostedIsComplete` bor.
  //
  // Tile'larni qurish: `scripts/tiles-build.sh` (Planetiler, OpenMapTiles
  // profili — uslubimiz shu sxemada yozilgani uchun 21 qatlam o'zgarmaydi).
  static const String mapTilesUrl = String.fromEnvironment('MAP_TILES_URL');
  static const String mapGlyphsUrl = String.fromEnvironment('MAP_GLYPHS_URL');

  // ===== Marshrut (OSRM) =====
  // Standart qiymat — OSRM'ning ommaviy demo serveri: rate-limit ostida, SLA
  // yo'q va ishlab chiqarish trafigi uchun mo'ljallanmagan. Prod build'da
  // o'z serveringizni ko'rsating:
  //   --dart-define=OSRM_URL=https://osrm.angren-taxi.uz
  // Serverni ko'tarish uchun: scripts/osrm-prepare.sh
  static const String osrmUrl = String.fromEnvironment(
    'OSRM_URL',
    defaultValue: 'https://router.project-osrm.org',
  );

  // ===== Joylashuv yuborish tezligi =====
  // Sanoat amaliyoti: faol holatda har 2–5 soniyada. Faqat masofa filtri
  // yetarli emas — tirbandlikda mashina 10 m yurmasdan turadi va yo'lovchi
  // ekranida marker "muzlab qoladi".
  static const Duration locationPingInterval = Duration(seconds: 4);

  /// Mashina turganda (yoki juda sekin ketayotganda) yuborish oralig'i —
  /// batareyani tejaydi, chunki yangilanadigan narsa yo'q.
  static const Duration locationIdlePingInterval = Duration(seconds: 15);

  /// Shu tezlikdan past bo'lsa (m/s), haydovchi turgan deb hisoblanadi.
  /// 1.5 m/s ≈ 5.4 km/soat — piyoda yurish tezligi.
  static const double locationIdleSpeedThreshold = 1.5;
}
