import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Uslubdagi har `icon-image` nomiga asset bor-yo'qligini qulflaydi.
///
/// Ikonalar sprite'dan emas, `AppVectorMap` dagi `addImage` dan keladi.
/// Nom adashsa MapLibre xato bermaydi — ikona shunchaki chizilmaydi,
/// buni ekranga qaramasdan sezib bo'lmaydi.
void main() {
  /// `poi-health` → `poi_health.png`; `oneway` uslubga qarab tanlanadi.
  String assetFor(String name, String variant) => name == 'oneway'
      ? 'assets/map/oneway_$variant.png'
      : 'assets/map/${name.replaceAll('-', '_')}.png';

  Iterable<String> iconNames(Object? expr) sync* {
    if (expr is String) {
      if (expr.startsWith('poi-') || expr == 'oneway') yield expr;
    } else if (expr is List) {
      for (final e in expr) {
        yield* iconNames(e);
      }
    }
  }

  for (final variant in ['light', 'dark']) {
    test('style_$variant: har icon-image uchun asset bor', () {
      final doc = jsonDecode(File('assets/map/style_$variant.json').readAsStringSync())
          as Map<String, dynamic>;
      final names = <String>{
        for (final layer in doc['layers'] as List)
          ...iconNames(((layer as Map)['layout'] as Map?)?['icon-image']),
      };

      expect(names, containsAll(<String>['oneway', 'poi-health', 'poi-civic']));
      for (final name in names) {
        expect(File(assetFor(name, variant)).existsSync(), isTrue, reason: name);
      }
    });
  }
}
