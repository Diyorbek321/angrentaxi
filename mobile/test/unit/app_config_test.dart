import 'package:flutter_test/flutter_test.dart';
import 'package:angren_taxi/core/config/app_config.dart';

// Pure string assertions — no network access, no widget pump needed.
// These guard against the default (no --dart-define) build silently
// pointing at a non-resolving domain again.
void main() {
  group('AppConfig defaults', () {
    const railwayHost = 'angrentaxi-production.up.railway.app';

    test('apiBaseUrl default points at the live Railway backend', () {
      expect(
        AppConfig.apiBaseUrl,
        'https://angrentaxi-production.up.railway.app/api/v1',
      );
      expect(AppConfig.apiBaseUrl, contains(railwayHost));
      expect(AppConfig.apiBaseUrl, startsWith('https://'));
      expect(AppConfig.apiBaseUrl, isNot(contains('api.angren-taxi.uz')));
    });

    test('wsUrl default points at the live Railway backend', () {
      expect(
        AppConfig.wsUrl,
        'wss://angrentaxi-production.up.railway.app',
      );
      expect(AppConfig.wsUrl, contains(railwayHost));
      expect(AppConfig.wsUrl, startsWith('wss://'));
      expect(AppConfig.wsUrl, isNot(contains('api.angren-taxi.uz')));
    });

    test('wsUrl combined with the /ws namespace used by SocketService '
        'matches the backend gateway path', () {
      // socket_service.dart connects to '${AppConfig.wsUrl}/ws', and the
      // backend's realtime gateway is registered on namespace /ws.
      expect(
        '${AppConfig.wsUrl}/ws',
        'wss://angrentaxi-production.up.railway.app/ws',
      );
    });
  });
}
