import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Minimal key/value contract for storing credentials in the platform keystore.
///
/// Kept as an interface (rather than using [FlutterSecureStorage] directly) so
/// unit tests can swap in [InMemorySecureTokenStore] — the real plugin needs a
/// platform channel that does not exist in `flutter test`.
abstract class SecureTokenStore {
  Future<String?> read(String key);

  /// Returns `true` only when the value was durably written. Callers rely on
  /// this before deleting a legacy plaintext copy (see LocalStorage migration).
  Future<bool> write(String key, String value);

  Future<void> delete(String key);
}

/// Keystore-backed implementation (Android EncryptedSharedPreferences / iOS
/// Keychain).
///
/// Every call is guarded: on a device where the keystore is unavailable we
/// degrade to "no persisted token" rather than crashing the app. We never fall
/// back to plaintext SharedPreferences — that is exactly what this class exists
/// to remove.
class FlutterSecureTokenStore implements SecureTokenStore {
  const FlutterSecureTokenStore([this._storage = _defaultStorage]);

  static const FlutterSecureStorage _defaultStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (e) {
      debugPrint('SecureTokenStore.read($key) failed: $e');
      return null;
    }
  }

  @override
  Future<bool> write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
      return true;
    } catch (e) {
      debugPrint('SecureTokenStore.write($key) failed: $e');
      return false;
    }
  }

  @override
  Future<void> delete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (e) {
      debugPrint('SecureTokenStore.delete($key) failed: $e');
    }
  }
}

/// Test/dev double. Also used implicitly by widget tests that build a
/// `LocalStorage` without a real keystore.
class InMemorySecureTokenStore implements SecureTokenStore {
  InMemorySecureTokenStore([Map<String, String>? initial])
      : _values = {...?initial};

  final Map<String, String> _values;

  Map<String, String> get values => Map.unmodifiable(_values);

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<bool> write(String key, String value) async {
    _values[key] = value;
    return true;
  }

  @override
  Future<void> delete(String key) async {
    _values.remove(key);
  }
}
