import 'dart:convert';

import 'package:angren_taxi/core/config/map_style.dart';
import 'package:flutter_test/flutter_test.dart';

/// MapTiler'dan o'zini hostlangan PMTiles'ga o'tish uslubni to'g'ri
/// o'zgartirishini qulflaydi.
///
/// Nega muhim: yarim ko'chirilgan uslub — tile manbasi yangi, `glyphs`
/// eski — xaritani CHIZADI, lekin ko'cha nomlarisiz. Bunday nuqson
/// ekranga qaramasdan sezilmaydi, shuning uchun test bilan qulflanadi.
void main() {
  const styleJson = '''
{
  "version": 8,
  "glyphs": "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=K",
  "sources": {
    "openmaptiles": {
      "type": "vector",
      "url": "https://api.maptiler.com/tiles/v3/tiles.json?key=K"
    }
  },
  "layers": [{"id": "background", "type": "background"}]
}''';

  Map<String, dynamic> decode(String s) =>
      jsonDecode(s) as Map<String, dynamic>;

  group('applySelfHostedSource', () {
    test('ikkala manzil berilsa manba ham, shriftlar ham almashadi', () {
      final out = decode(
        MapStyleLoader.applySelfHostedSource(
          styleJson,
          tilesUrl: 'pmtiles://https://r2.example/uz.pmtiles',
          glyphsUrl: 'https://r2.example/fonts/{fontstack}/{range}.pbf',
        ),
      );

      final source = (out['sources'] as Map)['openmaptiles'] as Map;
      expect(source['url'], 'pmtiles://https://r2.example/uz.pmtiles');
      expect(out['glyphs'], 'https://r2.example/fonts/{fontstack}/{range}.pbf');
      // Qatlamlar TEGILMAYDI — ko'chirishning butun ma'nosi shunda.
      expect(out['layers'], hasLength(1));
      expect(source['type'], 'vector');
    });

    test('faqat tile manzili berilsa HECH NARSA o\'zgarmaydi', () {
      final out = MapStyleLoader.applySelfHostedSource(
        styleJson,
        tilesUrl: 'pmtiles://https://r2.example/uz.pmtiles',
        glyphsUrl: '',
      );
      expect(out, styleJson,
          reason: 'yarim sozlash yorliqsiz xarita beradi — MapTiler qolsin');
    });

    test('faqat shrift manzili berilsa ham hech narsa o\'zgarmaydi', () {
      final out = MapStyleLoader.applySelfHostedSource(
        styleJson,
        tilesUrl: '',
        glyphsUrl: 'https://r2.example/fonts/{fontstack}/{range}.pbf',
      );
      expect(out, styleJson);
    });

    test('ikkalasi ham bo\'sh — standart MapTiler yo\'li', () {
      final out = MapStyleLoader.applySelfHostedSource(
        styleJson,
        tilesUrl: '',
        glyphsUrl: '',
      );
      expect(out, styleJson);
    });

    test('kutilmagan tuzilmada hujjat BUZILMAYDI', () {
      const odd = '{"version": 8, "sources": {}, "layers": []}';
      final out = MapStyleLoader.applySelfHostedSource(
        odd,
        tilesUrl: 'pmtiles://x',
        glyphsUrl: 'https://y/{fontstack}/{range}.pbf',
      );
      expect(out, odd, reason: "bo'sh xaritadan ko'ra eski manba yaxshiroq");
    });
  });
}
