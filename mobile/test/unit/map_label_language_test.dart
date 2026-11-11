import 'dart:convert';

import 'package:angren_taxi/core/config/map_style.dart';
import 'package:flutter_test/flutter_test.dart';

/// Xarita yorliqlari ilova tiliga mos yozuvda chiqishini qulflaydi.
///
/// Angren OSM ma'lumotida ko'chalarning ~60% `name` i ruscha kirill,
/// qolgani o'zbekcha lotin — `name:ru` esa ~65% da bor. Ruscha ilovada
/// `name:ru` birinchi olinsa ro'yxat deyarli butunlay kirillga o'tadi.
void main() {
  const uzExpr = [
    'coalesce',
    ['get', 'name:uz'],
    ['get', 'name'],
    ['get', 'name:latin'],
  ];
  final styleJson = jsonEncode({
    'version': 8,
    'layers': [
      {'id': 'background', 'type': 'background'},
      {
        'id': 'label-road',
        'type': 'symbol',
        'layout': {'text-field': uzExpr},
      },
      {
        'id': 'label-housenumber',
        'type': 'symbol',
        'layout': {
          'text-field': ['get', 'housenumber'],
        },
      },
    ],
  });

  List<dynamic> textField(String doc, String id) {
    final layers = (jsonDecode(doc) as Map<String, dynamic>)['layers'] as List;
    final layer = layers.firstWhere((l) => (l as Map)['id'] == id) as Map;
    return (layer['layout'] as Map)['text-field'] as List;
  }

  test("ruscha ilovada avval name:ru, keyin name", () {
    final doc = MapStyleLoader.localizeLabels(styleJson, 'ru');
    expect(textField(doc, 'label-road'), [
      'coalesce',
      ['get', 'name:ru'],
      ['get', 'name'],
      ['get', 'name:latin'],
    ]);
  });

  test("o'zbekcha ilovada uslub o'zgarmaydi", () {
    expect(MapStyleLoader.localizeLabels(styleJson, 'uz'), styleJson);
  });

  test('nom bo\'lmagan yorliqqa tegilmaydi', () {
    final doc = MapStyleLoader.localizeLabels(styleJson, 'ru');
    expect(textField(doc, 'label-housenumber'), ['get', 'housenumber']);
  });

  test("noma'lum til o'zbekcha uslubda qoladi", () {
    expect(MapStyleLoader.localizeLabels(styleJson, 'en'), styleJson);
  });
}
