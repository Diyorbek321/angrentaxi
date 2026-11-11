// GET /surge/zones javobini o'qish testi.
//
// Eng muhim ikki qoida shu yerda qulflanadi:
//   1. `multiplier` xaritaga uzatiladigan GeoJSON'ga TUSHMAYDI (mahsulot
//      qarori — haydovchi aniq koeffitsiyentni ko'rmasligi kerak).
//   2. `normal` zonalar tashlab yuboriladi — ular xaritada chizilmaydi.
import 'package:angren_taxi/shared/models/demand_zone.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _feature({
  required String zone,
  required String level,
  double multiplier = 1.0,
}) =>
    {
      'type': 'Feature',
      'geometry': {
        'type': 'Polygon',
        'coordinates': [
          [
            [70.07, 41.02],
            [70.08, 41.02],
            [70.08, 41.03],
            [70.07, 41.02],
          ],
        ],
      },
      'properties': {
        'zone': zone,
        'level': level,
        'multiplier': multiplier,
      },
    };

Map<String, dynamic> _collection(List<Map<String, dynamic>> features) => {
      'type': 'FeatureCollection',
      'features': features,
    };

void main() {
  group('DemandZones.fromResponse', () {
    test('kontrakt bo\'yicha FeatureCollection o\'qiladi', () {
      final zones = DemandZones.fromResponse(
        _collection([
          _feature(zone: 'h3-a', level: 'high', multiplier: 1.8),
          _feature(zone: 'h3-b', level: 'elevated', multiplier: 1.3),
        ]),
      );

      expect(zones.zones.length, 2);
      expect(zones.highCount, 1);
      expect(zones.elevatedCount, 1);
      expect(zones.isEmpty, isFalse);
      expect(zones.zones.first.zone, 'h3-a');
      expect(zones.zones.first.level, DemandLevel.high);
      expect(zones.zones.first.ring.first, [70.07, 41.02]);
    });

    test('normal zonalar chiqarib tashlanadi', () {
      final zones = DemandZones.fromResponse(
        _collection([
          _feature(zone: 'h3-a', level: 'normal', multiplier: 1.0),
          _feature(zone: 'h3-b', level: 'normal', multiplier: 1.1),
        ]),
      );

      expect(zones.zones, isEmpty);
      expect(zones.isEmpty, isTrue);
      expect(zones.mapGeoJson['features'], isEmpty);
    });

    test('xaritaga beriladigan GeoJSON multiplier saqlamaydi', () {
      final zones = DemandZones.fromResponse(
        _collection([_feature(zone: 'h3-a', level: 'high', multiplier: 2.4)]),
      );

      final features = zones.mapGeoJson['features'] as List<dynamic>;
      final properties =
          (features.single as Map<String, dynamic>)['properties']
              as Map<String, dynamic>;

      expect(properties.containsKey('multiplier'), isFalse);
      expect(properties['level'], 'high');
      expect(zones.mapGeoJson.toString().contains('multiplier'), isFalse);
    });

    test('mapGeoJson bir xil obyekt bo\'lib qoladi (identical tekshiruvi)', () {
      final zones = DemandZones.fromResponse(
        _collection([_feature(zone: 'h3-a', level: 'high')]),
      );

      expect(identical(zones.mapGeoJson, zones.mapGeoJson), isTrue);
    });

    test('buzuq feature butun javobni yiqitmaydi', () {
      final zones = DemandZones.fromResponse(
        _collection([
          _feature(zone: 'h3-ok', level: 'high'),
          {'type': 'Feature'},
          {
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': <double>[70.0, 41.0]},
            'properties': {'zone': 'h3-point', 'level': 'high'},
          },
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Polygon',
              'coordinates': [
                [
                  [70.0, 41.0],
                ],
              ],
            },
            'properties': {'zone': 'h3-short', 'level': 'high'},
          },
        ]),
      );

      expect(zones.zones.length, 1);
      expect(zones.zones.single.zone, 'h3-ok');
    });

    test('noma\'lum level normal deb o\'qiladi va ko\'rsatilmaydi', () {
      final zones = DemandZones.fromResponse(
        _collection([_feature(zone: 'h3-a', level: 'insane')]),
      );

      expect(zones.zones, isEmpty);
    });

    test('backend konverti ({data: ...}) ham qabul qilinadi', () {
      final zones = DemandZones.fromResponse({
        'success': true,
        'data': _collection([_feature(zone: 'h3-a', level: 'elevated')]),
      });

      expect(zones.elevatedCount, 1);
    });

    test('bo\'sh yoki noto\'g\'ri javob bo\'sh to\'plam beradi', () {
      expect(DemandZones.fromResponse(null).isEmpty, isTrue);
      expect(DemandZones.fromResponse('salom').isEmpty, isTrue);
      expect(DemandZones.fromResponse(_collection([])).isEmpty, isTrue);
    });
  });
}
