import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A keystore that refuses every write — models a device where
/// flutter_secure_storage is unavailable.
class _FailingSecureStore implements SecureTokenStore {
  final List<String> deleted = [];

  @override
  Future<String?> read(String key) async => null;

  @override
  Future<bool> write(String key, String value) async => false;

  @override
  Future<void> delete(String key) async => deleted.add(key);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<SharedPreferences> prefsWith(Map<String, Object> initial) async {
    SharedPreferences.setMockInitialValues(initial);
    return SharedPreferences.getInstance();
  }

  group('LocalStorage token storage', () {
    test('saveTokens writes both tokens to the secure store only', () async {
      final prefs = await prefsWith({});
      final secure = InMemorySecureTokenStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.saveTokens(accessToken: 'access-1', refreshToken: 'ref-1');

      expect(storage.getToken(), 'access-1');
      expect(storage.getRefreshToken(), 'ref-1');
      expect(secure.values['auth_token'], 'access-1');
      expect(secure.values['refresh_token'], 'ref-1');
      // Nothing leaked into plaintext prefs.
      expect(prefs.getString('auth_token'), isNull);
      expect(prefs.getString('refresh_token'), isNull);
    });

    test('saveTokens with a null refreshToken keeps the stored one', () async {
      final prefs = await prefsWith({});
      final secure = InMemorySecureTokenStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.saveTokens(accessToken: 'access-1', refreshToken: 'ref-1');
      await storage.saveTokens(accessToken: 'access-2');

      expect(storage.getToken(), 'access-2');
      expect(storage.getRefreshToken(), 'ref-1');
    });

    test('clearTokens wipes cache, secure store and legacy prefs', () async {
      final prefs = await prefsWith({});
      final secure = InMemorySecureTokenStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.saveTokens(accessToken: 'a', refreshToken: 'r');
      await storage.clearTokens();

      expect(storage.getToken(), isNull);
      expect(storage.getRefreshToken(), isNull);
      expect(storage.isLoggedIn, isFalse);
      expect(secure.values, isEmpty);
    });
  });

  group('SharedPreferences -> secure storage migration', () {
    test('moves a legacy plaintext token and deletes the old copy', () async {
      final prefs = await prefsWith({
        'auth_token': 'legacy-access',
        'refresh_token': 'legacy-refresh',
      });
      final secure = InMemorySecureTokenStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.initTokens();

      expect(storage.getToken(), 'legacy-access');
      expect(storage.getRefreshToken(), 'legacy-refresh');
      expect(secure.values['auth_token'], 'legacy-access');
      expect(secure.values['refresh_token'], 'legacy-refresh');
      expect(prefs.getString('auth_token'), isNull);
      expect(prefs.getString('refresh_token'), isNull);
    });

    test('migrates an access token even without a legacy refresh token',
        () async {
      final prefs = await prefsWith({'auth_token': 'legacy-access'});
      final secure = InMemorySecureTokenStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.initTokens();

      expect(storage.getToken(), 'legacy-access');
      expect(storage.getRefreshToken(), isNull);
      expect(prefs.getString('auth_token'), isNull);
    });

    test('keeps the plaintext copy when the secure write fails', () async {
      final prefs = await prefsWith({'auth_token': 'legacy-access'});
      final secure = _FailingSecureStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.initTokens();

      // Session must not be destroyed just because the keystore is broken.
      expect(prefs.getString('auth_token'), 'legacy-access');
    });

    test('secure store wins over a stale plaintext leftover', () async {
      final prefs = await prefsWith({'auth_token': 'stale'});
      final secure = InMemorySecureTokenStore({'auth_token': 'fresh'});
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.initTokens();

      expect(storage.getToken(), 'fresh');
      expect(prefs.getString('auth_token'), isNull);
    });

    test('initTokens is idempotent and does not clobber newer tokens',
        () async {
      final prefs = await prefsWith({'auth_token': 'legacy-access'});
      final secure = InMemorySecureTokenStore();
      final storage = LocalStorage(prefs, secureStore: secure);

      await storage.initTokens();
      await storage.saveToken('brand-new');
      await storage.initTokens();

      expect(storage.getToken(), 'brand-new');
    });

    test('non-token preferences are untouched by the migration', () async {
      final prefs = await prefsWith({
        'auth_token': 'legacy-access',
        'driver_mode': true,
      });
      final storage = LocalStorage(prefs, secureStore: InMemorySecureTokenStore());

      await storage.initTokens();

      expect(prefs.getBool('driver_mode'), isTrue);
      expect(storage.getDriverOnlineStatus(), isTrue);
    });
  });
}
