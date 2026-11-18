import 'package:angren_taxi/shared/models/uz_region.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test("14 hudud, kodlar takrorlanmaydi va backend bilan bir xil", () {
    expect(UzRegion.values.map((r) => r.code).toSet(), {
      'UZ-AN', 'UZ-BU', 'UZ-FA', 'UZ-JI', 'UZ-NG', 'UZ-NW', 'UZ-QA',
      'UZ-QR', 'UZ-SA', 'UZ-SI', 'UZ-SU', 'UZ-TK', 'UZ-TO', 'UZ-XO',
    });
  });

  test('kod → hudud; eski erkin matn yoki null → null', () {
    expect(UzRegion.fromCode('UZ-TO'), UzRegion.toshkentViloyati);
    expect(UzRegion.fromCode('Toshkent viloyati'), isNull);
    expect(UzRegion.fromCode(null), isNull);
  });

  test('nom tilga qarab', () {
    expect(UzRegion.toshkentShahri.label(ru: false), 'Toshkent shahri');
    expect(UzRegion.toshkentShahri.label(ru: true), 'город Ташкент');
  });
}
