import 'dart:convert';

import 'package:angren_taxi/shared/models/demand_zone.dart';
import 'package:flutter_test/flutter_test.dart';

// ============================================================================
// SIM KONTRAKTI — mobil parser backendning HAQIQIY javobini o'qiy oladimi?
//
// Quyidagi satr o'ylab topilmagan: u `GET /api/v1/surge/zones` ga real HTTP
// so'rov yuborib olingan (global ValidationPipe + ResponseInterceptor bilan,
// ya'ni main.ts dagi aynan o'sha sozlama). Qolgan testlar qo'lda yasalgan
// fikstura ishlatadi — fikstura backend bilan birga o'zgarmaydi, shuning
// uchun u koordinata tartibi almashib ketishini SEZMAYDI.
//
// Nega aynan shu uchta narsa qadab qo'yilgan:
//   1. Konvert — javob `{success, data}` ichida keladi, sof GeoJSON emas.
//   2. [lng, lat] tartibi — teskari bo'lsa Angren poligonlari Somali
//      qirg'oqlariga tushadi, lekin ilova xatolik bermaydi: xarita shunchaki
//      bo'sh ko'rinadi. Kompilyator ham, tiplar ham buni tutmaydi.
//   3. `level` satrlari — backend va mobil bir xil yozishi shart.
//
// Bu test yiqilsa: backend kontrakti o'zgargan. Testni "tuzatish" emas,
// ikkala tomonni qayta moslashtirish kerak.
// ============================================================================

/// `GET /api/v1/surge/zones?lat=41.0212&lng=70.0795&rings=4` javobi.
const _realBackendBody =
    '{"success":true,"data":{"type":"FeatureCollection","features":['
    '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[['
    '[70.07785117871343,41.02340583723354],'
    '[70.07894301628211,41.01824820860384],'
    '[70.08542918189596,41.01637305253191],'
    '[70.09082430318846,41.019655246014494],'
    '[70.0897334585616,41.024813022821725],'
    '[70.0832464996386,41.02668845800512],'
    '[70.07785117871343,41.02340583723354]]]},'
    '"properties":{"zone":"8820a1a8e5fffff","level":"high","multiplier":1.7}}'
    ']}}';

/// Angren markazi — poligonlar shu atrofda bo'lishi shart.
const _angrenLng = 70.08;
const _angrenLat = 41.02;

void main() {
  group('backendning haqiqiy javobi', () {
    late DemandZones zones;

    setUp(() => zones = DemandZones.fromResponse(jsonDecode(_realBackendBody)));

    test('{success, data} konverti ochiladi', () {
      // Konvert ochilmasa `features` topilmaydi va ro'yxat bo'sh qoladi —
      // ekran "talab yo'q" deb yolg'on ko'rsatardi.
      expect(zones.zones, hasLength(1));
      expect(zones.zones.single.zone, '8820a1a8e5fffff');
    });

    test('backenddagi "high" mobil DemandLevel.high ga tushadi', () {
      expect(zones.zones.single.level, DemandLevel.high);
      expect(zones.highCount, 1);
    });

    test('halqa [lng, lat] tartibida o\'qiladi, teskari emas', () {
      for (final point in zones.zones.single.ring) {
        expect(point[0], closeTo(_angrenLng, 0.05),
            reason: 'birinchi son — LNG (~70)');
        expect(point[1], closeTo(_angrenLat, 0.05),
            reason: 'ikkinchi son — LAT (~41)');
      }
    });

    test('yopiq halqa saqlanadi (GeoJSON talabi)', () {
      final ring = zones.zones.single.ring;
      expect(ring, hasLength(7));
      expect(ring.last, ring.first);
    });

    test('xaritaga ketadigan GeoJSON ham tartibni buzmaydi', () {
      final feature = (zones.mapGeoJson['features'] as List).single
          as Map<String, dynamic>;
      final geometry = feature['geometry'] as Map<String, dynamic>;
      final coordinates = geometry['coordinates'] as List;
      final ring = coordinates.first as List;
      final firstPoint = ring.first as List;

      expect(firstPoint[0], closeTo(_angrenLng, 0.05));
      expect(firstPoint[1], closeTo(_angrenLat, 0.05));

      // Mahsulot qarori: koeffitsiyent haydovchiga ko'rsatilmaydi.
      expect(feature['properties'], {'level': 'high'});
    });
  });
}
