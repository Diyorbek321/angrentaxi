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

  static const double defaultLat = 40.1392; // Angren city center
  static const double defaultLng = 69.1225;
}
