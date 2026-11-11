import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/ad_banner.dart';
import 'package:flutter/foundation.dart';

/// Reklama bannerlari: ro'yxat va ko'rish/bosish hisoblagichlari.
class AdsService {
  AdsService(this._api);

  final ApiClient _api;

  /// Ilova SESSIYASI davomida hisoblangan ko'rishlar. Statik — bosh ekran
  /// qayta qurilganda (tab almashganda) yoki karusel aylanib qaytganda
  /// bitta banner qayta-qayta hisoblanib, reklama beruvchi hisobotini
  /// shishirmasin.
  static final Set<String> _impressionsThisSession = <String>{};

  @visibleForTesting
  static void resetSession() => _impressionsThisSession.clear();

  Future<List<AdBanner>> active() async {
    final response = await _api.get(ApiEndpoints.activeAds);
    final list = (response.data as Map<String, dynamic>)['data'] as List<dynamic>;
    return list.map((e) => AdBanner.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Sessiyada birinchi marta ko'rilganda bir marta yuboriladi.
  Future<void> recordImpression(String id) async {
    if (!_impressionsThisSession.add(id)) return;
    await _send(ApiEndpoints.adImpression(id));
  }

  Future<void> recordClick(String id) => _send(ApiEndpoints.adClick(id));

  /// Hisoblagich — foydalanuvchi uchun ikkinchi darajali: xato ekranga
  /// chiqmaydi va bosilgan havolaning ochilishini to'xtatmaydi.
  Future<void> _send(String path) async {
    try {
      await _api.post(path);
    } catch (e) {
      debugPrint('[Ads] $path failed: $e');
    }
  }
}
