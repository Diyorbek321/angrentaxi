import 'dart:convert';
import 'dart:io';

import 'package:angren_taxi/core/config/map_offline_region.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:maplibre_gl/maplibre_gl.dart' as ml;

class _FakeApi implements OfflineMapApi {
  _FakeApi({this.regions = const [], this.event});

  final List<ml.OfflineRegion> regions;
  final ml.DownloadRegionStatus? event;
  final deleted = <int>[];
  final downloads = <ml.OfflineRegionDefinition>[];
  final metadataUpdates = <Map<String, dynamic>>[];

  @override
  Future<List<ml.OfflineRegion>> listRegions() async => regions;

  @override
  Future<ml.OfflineRegion> download(
    ml.OfflineRegionDefinition definition, {
    required Map<String, dynamic> metadata,
    required void Function(ml.DownloadRegionStatus event) onEvent,
  }) async {
    downloads.add(definition);
    final created = ml.OfflineRegion(id: 42, definition: definition, metadata: metadata);
    // Haqiqiy plagindagidek: natija qaytgandan KEYIN hodisa keladi.
    final e = event;
    if (e != null) Future<void>.microtask(() => onEvent(e));
    return created;
  }

  @override
  Future<void> delete(int id) async => deleted.add(id);

  @override
  Future<void> updateMetadata(int id, Map<String, dynamic> metadata) async =>
      metadataUpdates.add(metadata);
}

class _FakeHost implements StyleHost {
  String? served;
  var closed = false;

  @override
  Future<HostedStyle> serve(String styleJson) async {
    served = styleJson;
    return HostedStyle('http://localhost:1/t/style.json', () async => closed = true);
  }
}

Future<String> _style() async => '{"version":8}';

ml.OfflineRegion _region(int id, Map<String, dynamic> metadata) => ml.OfflineRegion(
      id: id,
      definition: ml.OfflineRegionDefinition(
        bounds: MapOfflineRegion.bounds,
        mapStyleUrl: 'https://example.com/style.json',
        minZoom: 10,
        maxZoom: 14,
      ),
      metadata: metadata,
    );

void main() {
  test('kalit yo\'q yoki o\'zini hostlash — yuklanmaydi', () async {
    final noKey = _FakeApi();
    await MapOfflineRegion.ensureDownloaded(api: noKey, styleHost: _FakeHost(), loadStyle: _style, mapTilerKey: '', selfHosted: false);
    final selfHosted = _FakeApi();
    await MapOfflineRegion.ensureDownloaded(api: selfHosted, styleHost: _FakeHost(), loadStyle: _style, mapTilerKey: 'k', selfHosted: true);

    expect(noKey.downloads, isEmpty);
    expect(selfHosted.downloads, isEmpty);
  });

  test('to\'liq yuklangan hudud bor — qayta yuklanmaydi', () async {
    final host = _FakeHost();
    final api = _FakeApi(regions: [
      _region(1, {'name': MapOfflineRegion.regionName, 'complete': true}),
    ]);
    await MapOfflineRegion.ensureDownloaded(api: api, styleHost: host, loadStyle: _style, mapTilerKey: 'k', selfHosted: false);

    expect(api.downloads, isEmpty);
    expect(api.deleted, isEmpty);
  });

  test('yarim qolgan va eski hudud o\'chiriladi, begonasiga tegilmaydi', () async {
    final host = _FakeHost();
    final api = _FakeApi(
      regions: [
        _region(1, {'name': MapOfflineRegion.regionName}),
        _region(2, {'name': 'angren-v0', 'complete': true}),
        _region(3, {'name': 'boshqa'}),
      ],
      event: ml.Success(),
    );
    await MapOfflineRegion.ensureDownloaded(api: api, styleHost: host, loadStyle: _style, mapTilerKey: 'k', selfHosted: false);

    expect(api.deleted, [1, 2]);
    expect(api.downloads, hasLength(1));
    expect(api.downloads.single.maxZoom, MapOfflineRegion.maxZoom);
    // Bizning uslub — streets-v2 emas — lokal serverdan.
    expect(api.downloads.single.mapStyleUrl, 'http://localhost:1/t/style.json');
    expect(host.served, '{"version":8}');
    expect(host.closed, isTrue);
  });

  test('muvaffaqiyatli yuklash "complete" deb belgilanadi', () async {
    final host = _FakeHost();
    final api = _FakeApi(event: ml.Success());
    await MapOfflineRegion.ensureDownloaded(api: api, styleHost: host, loadStyle: _style, mapTilerKey: 'k', selfHosted: false);

    expect(api.metadataUpdates.single['complete'], isTrue);
  });

  test('xato bilan tugasa "complete" belgilanmaydi — keyingi safar qayta', () async {
    final host = _FakeHost();
    final api = _FakeApi(event: ml.Error(PlatformException(code: 'net')));
    await MapOfflineRegion.ensureDownloaded(api: api, styleHost: host, loadStyle: _style, mapTilerKey: 'k', selfHosted: false);

    expect(api.downloads, hasLength(1));
    expect(api.metadataUpdates, isEmpty);
    expect(host.closed, isTrue);
  });

  group('LoopbackStyleHost', () {
    test('uslubni localhost da beradi, yopilgach javob bermaydi', () async {
      final hosted = await const LoopbackStyleHost().serve('{"version":8}');
      final uri = Uri.parse(hosted.url);
      expect(uri.host, 'localhost');

      final client = HttpClient();
      final local = uri.replace(host: '127.0.0.1');
      final res = await (await client.getUrl(local)).close();
      expect(res.statusCode, 200);
      expect(await res.transform(utf8.decoder).join(), '{"version":8}');

      // Boshqa yo'l — 404 (tasodifiy token bilmagan so'rovga hech narsa).
      final other = await (await client.getUrl(local.replace(path: '/style.json'))).close();
      expect(other.statusCode, 404);
      await other.drain<void>();

      await hosted.close();
      await expectLater(client.getUrl(local).then((r) => r.close()), throwsA(isA<IOException>()));
      client.close(force: true);
    });
  });
}
