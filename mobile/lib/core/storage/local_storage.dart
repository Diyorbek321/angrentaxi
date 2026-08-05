import 'dart:convert';

import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:angren_taxi/shared/models/user.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App-local persistence.
///
/// Auth credentials (access + refresh token) live in the platform keystore via
/// [SecureTokenStore]; everything else (profile cache, driver mode, prefs)
/// stays in [SharedPreferences] where plaintext is harmless.
///
/// The keystore API is async, but `getToken()` is called synchronously from the
/// Dio request interceptor and from `isLoggedIn` checks all over the app.
/// Rather than making the whole call graph async, tokens are read **once** at
/// startup ([initTokens]) and mirrored in memory; writes update the cache
/// synchronously and the keystore asynchronously. The cache is the source of
/// truth for reads, so callers keep their synchronous API.
class LocalStorage {
  static const String _tokenKey = 'auth_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'current_user';
  static const String _driverModeKey = 'driver_mode';

  final SharedPreferences _prefs;
  final SecureTokenStore _secureStore;

  String? _accessToken;
  String? _refreshToken;
  bool _tokensLoaded = false;

  LocalStorage(this._prefs, {SecureTokenStore? secureStore})
    : _secureStore = secureStore ?? const FlutterSecureTokenStore();

  /// Loads tokens from the keystore into memory, migrating any legacy
  /// plaintext tokens left in SharedPreferences by older app versions.
  ///
  /// Must be awaited during bootstrap, before the first authenticated request.
  /// Idempotent.
  Future<void> initTokens() async {
    if (_tokensLoaded) return;
    _accessToken = await _secureStore.read(_tokenKey);
    _refreshToken = await _secureStore.read(_refreshTokenKey);
    await _migrateLegacyTokens();
    _tokensLoaded = true;
  }

  /// One-way move of pre-secure-storage tokens. Without this every existing
  /// user would be logged out by the upgrade.
  ///
  /// The plaintext copy is only deleted once the keystore write is confirmed,
  /// so a failing keystore degrades to "still on the old storage" instead of
  /// "session destroyed".
  Future<void> _migrateLegacyTokens() async {
    final legacyAccess = _prefs.getString(_tokenKey);
    final legacyRefresh = _prefs.getString(_refreshTokenKey);
    if (legacyAccess == null && legacyRefresh == null) return;

    if (legacyAccess != null) {
      if (_accessToken == null) {
        if (await _secureStore.write(_tokenKey, legacyAccess)) {
          _accessToken = legacyAccess;
          await _prefs.remove(_tokenKey);
        }
      } else {
        // Keystore is already authoritative — drop the stale plaintext copy.
        await _prefs.remove(_tokenKey);
      }
    }

    if (legacyRefresh != null) {
      if (_refreshToken == null) {
        if (await _secureStore.write(_refreshTokenKey, legacyRefresh)) {
          _refreshToken = legacyRefresh;
          await _prefs.remove(_refreshTokenKey);
        }
      } else {
        await _prefs.remove(_refreshTokenKey);
      }
    }
  }

  // Token management
  Future<void> saveToken(String token) async {
    _accessToken = token;
    _tokensLoaded = true;
    await _secureStore.write(_tokenKey, token);
  }

  Future<void> saveRefreshToken(String token) async {
    _refreshToken = token;
    _tokensLoaded = true;
    await _secureStore.write(_refreshTokenKey, token);
  }

  /// Persists a token pair. A null/empty [refreshToken] leaves the stored
  /// refresh token untouched — the backend only returns one when rotation is
  /// enabled, and older builds answer `/auth/refresh` with `{ accessToken }`
  /// alone.
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await saveToken(accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await saveRefreshToken(refreshToken);
    }
  }

  String? getToken() => _accessToken;

  String? getRefreshToken() => _refreshToken;

  Future<void> clearToken() async {
    _accessToken = null;
    await _secureStore.delete(_tokenKey);
    await _prefs.remove(_tokenKey);
  }

  Future<void> clearRefreshToken() async {
    _refreshToken = null;
    await _secureStore.delete(_refreshTokenKey);
    await _prefs.remove(_refreshTokenKey);
  }

  Future<void> clearTokens() async {
    await clearToken();
    await clearRefreshToken();
  }

  // User management
  Future<void> saveUser(Map<String, dynamic> userJson) async {
    await _prefs.setString(_userKey, jsonEncode(userJson));
  }

  User? getUser() {
    final json = _prefs.getString(_userKey);
    if (json == null) return null;
    try {
      return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearUser() async {
    await _prefs.remove(_userKey);
  }

  // Driver online status
  Future<void> saveDriverOnlineStatus(bool isOnline) async {
    await _prefs.setBool(_driverModeKey, isOnline);
  }

  bool getDriverOnlineStatus() {
    return _prefs.getBool(_driverModeKey) ?? false;
  }

  // Clear all
  Future<void> clearAll() async {
    await _prefs.clear();
    await clearTokens();
  }

  bool get isLoggedIn => getToken() != null;
}
