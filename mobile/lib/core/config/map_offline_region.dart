import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/map_style.dart';
import 'package:flutter/foundation.dart';
import 'package:maplibre_gl/maplibre_gl.dart' as ml;

// ============================================================================
// ANGREN XARITASINI OLDINDAN YUKLASH.
//
// Xarita odatda har ochilishda tile'larni tarmoqdan tortadi: birinchi
// ishga tushishda va sekin 3G'da xarita bo'sh fonda turib qoladi. Shahar
// kichik — zoom 10–14 da ~200 ta tile (bir necha MB) — shuning uchun uni
// bir marta MapLibre'ning offline bazasiga yuklab qo'yamiz.
//
// ⚠️ NEGA `streets-v2` USLUBI, BIZNIKI EMAS. Offline yuklovchi uslubni
// faqat http(s) URL orqali oladi (`file://` va JSON satr qabul
// qilinmaydi). `streets-v2` bizning uslub bilan BIR XIL tile manbasini
// ishlatadi (`api.maptiler.com/tiles/v3/tiles.json`), offline baza esa
// tile'larni URL bo'yicha saqlaydi — ya'ni bizning uslub ham shu
// tile'larni bazadan oladi.
//
// ⚠️ ZOOM 15 ATAYLAB YO'Q. U yolg'iz ~480 tile, ya'ni hajmning ~70%.
// Ko'cha darajasidagi tile'lar odatiy (ambient) keshga foydalanuvchi
// ko'rgan sari tushadi.
//
// O'zini hostlash (PMTiles) sozlangan bo'lsa yuklanmaydi: u boshqa
// manba va boshqa protokol.
// ============================================================================

/// Platforma chaqiruvlari — testda soxta bilan almashtiriladi.
abstract class OfflineMapApi {
  Future<List<ml.OfflineRegion>> listRegions();

  Future<ml.OfflineRegion> download(
    ml.OfflineRegionDefinition definition, {
    required Map<String, dynamic> metadata,
    required void Function(ml.DownloadRegionStatus event) onEvent,
  });

  Future<void> delete(int id);

  Future<void> updateMetadata(int id, Map<String, dynamic> metadata);
}

class _MapLibreOfflineApi implements OfflineMapApi {
  const _MapLibreOfflineApi();

  @override
  Future<List<ml.OfflineRegion>> listRegions() => ml.getListOfRegions();

  @override
  Future<ml.OfflineRegion> download(
    ml.OfflineRegionDefinition definition, {
    required Map<String, dynamic> metadata,
    required void Function(ml.DownloadRegionStatus event) onEvent,
  }) =>
      ml.downloadOfflineRegion(definition, metadata: metadata, onEvent: onEvent);

  @override
  Future<void> delete(int id) => ml.deleteOfflineRegion(id);

  @override
  Future<void> updateMetadata(int id, Map<String, dynamic> metadata) =>
      ml.updateOfflineRegionMetadata(id, metadata);
}

class MapOfflineRegion {
  MapOfflineRegion._();

  /// Hudud yoki zoom o'zgarsa versiyani oshiring — eski hudud o'chirilib,
  /// yangisi yuklanadi.
  static const String regionName = 'angren-v1';

  static final ml.LatLngBounds bounds = ml.LatLngBounds(
    southwest: const ml.LatLng(40.96, 70.00),
    northeast: const ml.LatLng(41.08, 70.20),
  );

  static const double minZoom = 10;
  static const double maxZoom = 14;

  /// Yuklash uchun uslub URL'i yoki `null` — yuklash kerak emas.
  static String? styleUrl({
    required String mapTilerKey,
    required bool selfHosted,
  }) {
    if (mapTilerKey.isEmpty || selfHosted) return null;
    return 'https://api.maptiler.com/maps/streets-v2/style.json?key=$mapTilerKey';
  }

  /// Hudud to'liq yuklangan bo'lsa hech narsa qilmaydi. Yarim qolgan
  /// (ilova yuklash paytida yopilgan) yoki eski versiyadagi hududni
  /// o'chirib, qaytadan yuklaydi. Xatolar ilovani to'xtatmaydi — xarita
  /// tarmoqdan ishlashda davom etadi.
  static Future<void> ensureDownloaded({
    OfflineMapApi api = const _MapLibreOfflineApi(),
    String? mapTilerKey,
    bool? selfHosted,
  }) async {
    final url = styleUrl(
      mapTilerKey: mapTilerKey ?? AppConfig.mapTilerKey,
      selfHosted: selfHosted ?? MapStyleLoader.selfHostedIsComplete,
    );
    if (url == null) return;

    try {
      final regions = await api.listRegions();
      for (final region in regions) {
        final current = region.metadata['name'] == regionName;
        if (current && region.metadata['complete'] == true) return;
        // Bizning eski yoki yarim qolgan hududimiz — boshqasiga tegmaymiz.
        final ours = (region.metadata['name'] as String?)?.startsWith('angren-') ?? false;
        if (ours) await api.delete(region.id);
      }

      // Native chaqiruv hudud YARATILGANDA qaytadi, yuklash esa keyin
      // tugaydi — natijani hodisadan kutamiz.
      final done = Completer<bool>();
      final region = await api.download(
        ml.OfflineRegionDefinition(
          bounds: bounds,
          mapStyleUrl: url,
          minZoom: minZoom,
          maxZoom: maxZoom,
        ),
        metadata: const {'name': regionName},
        onEvent: (event) {
          if (done.isCompleted) return;
          if (event is ml.Success) {
            done.complete(true);
          } else if (event is ml.Error) {
            debugPrint('[MapOffline] download failed: ${event.cause.message}');
            done.complete(false);
          }
        },
      );
      if (await done.future) {
        await api.updateMetadata(
          region.id,
          const {'name': regionName, 'complete': true},
        );
      }
    } catch (e) {
      debugPrint('[MapOffline] skipped: $e');
    }
  }
}
