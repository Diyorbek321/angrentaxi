import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:angren_taxi/shared/models/user.dart';

class LocalStorage {
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'current_user';
  static const String _driverModeKey = 'driver_mode';

  final SharedPreferences _prefs;

  LocalStorage(this._prefs);

  // Token management
  Future<void> saveToken(String token) async {
    await _prefs.setString(_tokenKey, token);
  }

  String? getToken() {
    return _prefs.getString(_tokenKey);
  }

  Future<void> clearToken() async {
    await _prefs.remove(_tokenKey);
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
  }

  bool get isLoggedIn => getToken() != null;
}
