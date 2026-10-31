import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

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
// ⚠️ NEGA LOKAL SERVER. Offline yuklovchi uslubni faqat http(s) URL
// orqali oladi (`file://`, `asset://` va JSON satr qabul qilinmaydi), offline
// baza esa resurslarni URL bo'yicha saqlaydi. Ilgari MapTiler'ning
// `streets-v2` uslubi yuklanardi — uning tile manzili va shriftlari
// (`Roboto`) bizning uslubnikiga (tile shabloni, `Noto Sans`) mos emas edi,
// ya'ni bazaga tushgan narsa xaritada ishlatilmasdi. Endi BIZNING uslub
// yuklash davomida `localhost` da vaqtincha beriladi ([StyleHost]) — tile
// va shrift manzillari ta'rif bo'yicha bir xil.
//
// ⚠️ ZOOM 15 ATAYLAB YO'Q. U yolg'iz ~480 tile, ya'ni hajmning ~70%.
// Ko'cha darajasidagi tile'lar odatiy (ambient) keshga foydalanuvchi
// ko'rgan sari tushadi.
//
// O'zini hostlash (PMTiles) sozlangan bo'lsa yuklanmaydi: u boshqa
// manba va boshqa protokol.
// ============================================================================

/// Uslub hujjatini offline yuklovchiga http URL sifatida beradi.
abstract class StyleHost {
  Future<HostedStyle> serve(String styleJson);
}

class HostedStyle {
  const HostedStyle(this.url, this.close);

  final String url;
  final Future<void> Function() close;
}

/// Faqat qurilmaning o'zidan (`127.0.0.1`) ochiladigan, tasodifiy yo'lli
/// vaqtinchalik server. `localhost` ga ochiq HTTP Android'da
/// `network_security_config.xml` da ruxsat etilgan.
class LoopbackStyleHost implements StyleHost {
  const LoopbackStyleHost();

  @override
  Future<HostedStyle> serve(String styleJson) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final random = Random.secure();
    final token = List.generate(16, (_) => random.nextInt(16).toRadixString(16)).join();
    final path = '/$token/style.json';
    final body = utf8.encode(styleJson);

    server.listen((request) {
      final response = request.response;
      if (request.uri.path == path) {
        response.headers.contentType = ContentType.json;
        response.add(body);
      } else {
        response.statusCode = HttpStatus.notFound;
      }
      response.close();
    });

    return HostedStyle(
      'http://localhost:${server.port}$path',
      () => server.close(force: true),
    );
  }
}

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
  ///
  /// v2: `streets-v2` o'rniga bizning uslub — v1 dagi tile'lar boshqa
  /// manzilda saqlangan va ishlatilmaydi.
  static const String regionName = 'angren-v2';

  static final ml.LatLngBounds bounds = ml.LatLngBounds(
    southwest: const ml.LatLng(40.96, 70.00),
    northeast: const ml.LatLng(41.08, 70.20),
  );

  static const double minZoom = 10;
  static const double maxZoom = 14;

  /// Kalitsiz build'da yuklanadigan narsa yo'q; o'zini hostlash (PMTiles)
  /// boshqa manba va boshqa protokol.
  static bool shouldDownload({
    required String mapTilerKey,
    required bool selfHosted,
  }) =>
      mapTilerKey.isNotEmpty && !selfHosted;

  /// Hudud to'liq yuklangan bo'lsa hech narsa qilmaydi. Yarim qolgan
  /// (ilova yuklash paytida yopilgan) yoki eski versiyadagi hududni
  /// o'chirib, qaytadan yuklaydi. Xatolar ilovani to'xtatmaydi — xarita
  /// tarmoqdan ishlashda davom etadi.
  static Future<void> ensureDownloaded({
    OfflineMapApi api = const _MapLibreOfflineApi(),
    StyleHost styleHost = const LoopbackStyleHost(),
    Future<String> Function()? loadStyle,
    String? mapTilerKey,
    bool? selfHosted,
  }) async {
    final download = shouldDownload(
      mapTilerKey: mapTilerKey ?? AppConfig.mapTilerKey,
      selfHosted: selfHosted ?? MapStyleLoader.selfHostedIsComplete,
    );
    if (!download) return;

    HostedStyle? hosted;
    try {
      final regions = await api.listRegions();
      for (final region in regions) {
        final current = region.metadata['name'] == regionName;
        if (current && region.metadata['complete'] == true) return;
        // Bizning eski yoki yarim qolgan hududimiz — boshqasiga tegmaymiz.
        final ours = (region.metadata['name'] as String?)?.startsWith('angren-') ?? false;
        if (ours) await api.delete(region.id);
      }

      // Kunduzgi va tungi uslub bir xil tile va shriftlarni ishlatadi —
      // bittasini yuklash yetarli.
      final styleJson =
          await (loadStyle ?? () => MapStyleLoader.load(AppMapStyle.light))();
      hosted = await styleHost.serve(styleJson);

      // Native chaqiruv hudud YARATILGANDA qaytadi, yuklash esa keyin
      // tugaydi — natijani hodisadan kutamiz. Server shu vaqtgacha ochiq.
      final done = Completer<bool>();
      final region = await api.download(
        ml.OfflineRegionDefinition(
          bounds: bounds,
          mapStyleUrl: hosted.url,
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
    } finally {
      await hosted?.close();
    }
  }
}
