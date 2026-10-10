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
    await MapOfflineRegion.ensureDownloaded(api: noKey, mapTilerKey: '', selfHosted: false);
    final selfHosted = _FakeApi();
    await MapOfflineRegion.ensureDownloaded(api: selfHosted, mapTilerKey: 'k', selfHosted: true);

    expect(noKey.downloads, isEmpty);
    expect(selfHosted.downloads, isEmpty);
  });

  test('to\'liq yuklangan hudud bor — qayta yuklanmaydi', () async {
    final api = _FakeApi(regions: [
      _region(1, {'name': MapOfflineRegion.regionName, 'complete': true}),
    ]);
    await MapOfflineRegion.ensureDownloaded(api: api, mapTilerKey: 'k', selfHosted: false);

    expect(api.downloads, isEmpty);
    expect(api.deleted, isEmpty);
  });

  test('yarim qolgan va eski hudud o\'chiriladi, begonasiga tegilmaydi', () async {
    final api = _FakeApi(
      regions: [
        _region(1, {'name': MapOfflineRegion.regionName}),
        _region(2, {'name': 'angren-v0', 'complete': true}),
        _region(3, {'name': 'boshqa'}),
      ],
      event: ml.Success(),
    );
    await MapOfflineRegion.ensureDownloaded(api: api, mapTilerKey: 'k', selfHosted: false);

    expect(api.deleted, [1, 2]);
    expect(api.downloads, hasLength(1));
    expect(api.downloads.single.maxZoom, MapOfflineRegion.maxZoom);
    expect(api.downloads.single.mapStyleUrl, contains('streets-v2'));
  });

  test('muvaffaqiyatli yuklash "complete" deb belgilanadi', () async {
    final api = _FakeApi(event: ml.Success());
    await MapOfflineRegion.ensureDownloaded(api: api, mapTilerKey: 'k', selfHosted: false);

    expect(api.metadataUpdates.single['complete'], isTrue);
  });

  test('xato bilan tugasa "complete" belgilanmaydi — keyingi safar qayta', () async {
    final api = _FakeApi(event: ml.Error(PlatformException(code: 'net')));
    await MapOfflineRegion.ensureDownloaded(api: api, mapTilerKey: 'k', selfHosted: false);

    expect(api.downloads, hasLength(1));
    expect(api.metadataUpdates, isEmpty);
  });
}
