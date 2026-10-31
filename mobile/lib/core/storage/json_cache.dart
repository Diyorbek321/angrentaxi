import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Server javoblarining oxirgi nusxasi — ekranni darhol ko'rsatish uchun.
///
/// Naqsh "avval keshdan, keyin tarmoqdan": provayder ekranni saqlangan
/// nusxa bilan DARHOL chizadi, fonda serverdan yangisini so'raydi va
/// kelganda almashtiradi. Foydalanuvchi skeleton o'rniga mazmunni ko'radi,
/// ayniqsa server "uyg'onayotgan" (Railway sovuq start) yoki tarmoq sekin
/// bo'lganda.
///
/// ⚠️ FAQAT KAM O'ZGARADIGAN, KO'RSATISH UCHUN MA'LUMOT. Narxi tez
/// o'zgaradigan (tariflar — surge koeffitsienti) yoki shaxsiy (buyurtmalar,
/// hamyon) javoblarni bu yerga qo'ymang: eski nusxa foydalanuvchini
/// chalg'itadi. Yakuniy narxni baribir server hisoblaydi.
///
/// [maxAge] dan eski nusxa yo'q deb hisoblanadi — bir hafta ochilmagan
/// ilova yopilgan restoranni ko'rsatmasin.
class JsonCache {
  JsonCache(this._prefs, {this.maxAge = const Duration(days: 3), DateTime Function()? now})
      : _now = now ?? DateTime.now;

  final SharedPreferences _prefs;
  final Duration maxAge;
  final DateTime Function() _now;

  /// Tuzilma o'zgarsa versiyani oshiring — eski yozuvlar o'qilmaydi.
  static const String _prefix = 'json_cache.v1.';

  /// Saqlangan nusxa yoki `null` (yo'q, eskirgan yoki buzilgan).
  Object? read(String key) {
    final raw = _prefs.getString('$_prefix$key');
    if (raw == null) return null;
    try {
      final entry = jsonDecode(raw) as Map<String, dynamic>;
      final savedAt = DateTime.fromMillisecondsSinceEpoch(entry['t'] as int);
      if (_now().difference(savedAt) > maxAge) return null;
      return entry['d'];
    } catch (e) {
      debugPrint('[JsonCache] corrupt entry $key: $e');
      return null;
    }
  }

  Future<void> write(String key, Object? data) async {
    try {
      await _prefs.setString(
        '$_prefix$key',
        jsonEncode({'t': _now().millisecondsSinceEpoch, 'd': data}),
      );
    } catch (e) {
      // Kesh — tezlik uchun; yozilmasa ilova baribir ishlaydi.
      debugPrint('[JsonCache] write failed $key: $e');
    }
  }
}
