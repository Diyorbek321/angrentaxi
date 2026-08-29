// `CityCoverage` va `ServiceCity` uchun sof birlik testlari — tarmoq ham,
// vidjet daraxti ham kerak emas.
//
// Bu yerda TEKSHIRILADIGAN eng muhim narsa qamrov qoidasining O'ZI emas,
// balki uning IKKI HIMOYASI: ro'yxat bo'sh bo'lsa (server hech qanday
// shahar sozlamagan yoki `GET /cities` yiqilgan) hech narsa rad
// etilmasligi kerak. "Ma'lumot yo'q" hech qachon "xizmat yo'q" degani
// emas — aks holda bitta yiqilgan so'rov butun ilovani to'xtatib qo'yardi.
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/location/city_coverage.dart';
import 'package:angren_taxi/shared/models/service_city.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

const _angren = ServiceCity(
  id: 'city-angren',
  name: 'Angren',
  centerLat: 40.0956,
  centerLng: 70.9432,
  radiusKm: 25,
);

const _toshkent = ServiceCity(
  id: 'city-toshkent',
  name: 'Toshkent',
  centerLat: 41.2995,
  centerLng: 69.2401,
  radiusKm: 30,
);

/// Toshkent markazi — Angren doirasidan ancha uzoq, ya'ni "hudud
/// tashqarisi" uchun ishonchli namuna.
const double _toshkentLat = 41.2995;
const double _toshkentLng = 69.2401;

void main() {
  group('ServiceCity doirasi', () {
    test('markazning o\'zi va yaqin nuqta doira ichida', () {
      expect(_angren.contains(_angren.centerLat, _angren.centerLng), isTrue);
      // Markazdan ~10 km shimolda.
      final near = const Distance().offset(_angren.center, 10000, 0);
      expect(_angren.contains(near.latitude, near.longitude), isTrue);
    });

    test('radiusdan uzoq nuqta doira tashqarisida', () {
      expect(_angren.contains(_toshkentLat, _toshkentLng), isFalse);
    });

    test('chegara nuqtasi ICHKARI hisoblanadi', () {
      // Chekkadagi uy tufayli buyurtma rad etilmasligi kerak, ya'ni
      // taqqoslash `<=` bo'lishi SHART. Sinov nuqtasining masofasi
      // o'lchab olinadi va aynan shu masofa radius qilib beriladi —
      // shunda tekshiruv geodeziya modeliga emas, `<=` belgisiga bog'liq
      // bo'ladi.
      final probe = const Distance().offset(_angren.center, 25000, 90);
      final measuredKm = _angren.distanceKmTo(probe.latitude, probe.longitude);

      final exactly = ServiceCity(
        id: 'chegara',
        name: 'Chegara',
        centerLat: _angren.centerLat,
        centerLng: _angren.centerLng,
        radiusKm: measuredKm,
      );
      final justSmaller = ServiceCity(
        id: 'chegara-kichik',
        name: 'Chegara',
        centerLat: _angren.centerLat,
        centerLng: _angren.centerLng,
        radiusKm: measuredKm - 0.05,
      );

      expect(exactly.contains(probe.latitude, probe.longitude), isTrue);
      expect(justSmaller.contains(probe.latitude, probe.longitude), isFalse);
    });

    test('distanceKmTo haqiqiy masofani km da qaytaradi', () {
      final tenKm = const Distance().offset(_angren.center, 10000, 180);
      expect(
        _angren.distanceKmTo(tenKm.latitude, tenKm.longitude),
        closeTo(10, 0.1),
      );
    });
  });

  group('CityCoverage — ma\'lumot bor holati', () {
    const coverage = CityCoverage([_angren, _toshkent]);

    test('shahar ichidagi nuqta xizmat hududida', () {
      expect(coverage.isServiceable(_angren.centerLat, _angren.centerLng), isTrue);
      expect(coverage.isOutside(_angren.centerLat, _angren.centerLng), isFalse);
    });

    test('ikkala doiradan tashqaridagi nuqta xizmat hududida emas', () {
      // Namangan atrofi — ikkala shahardan ham uzoq.
      expect(coverage.isServiceable(40.9983, 71.6726), isFalse);
      expect(coverage.isOutside(40.9983, 71.6726), isTrue);
    });

    test('nearestTo eng yaqin shaharni topadi', () {
      // Namangan Angrenga yaqinroq, Qozog\'iston chegarasi Toshkentga.
      expect(coverage.nearestTo(40.9983, 71.6726)?.name, 'Angren');
      expect(coverage.nearestTo(41.9000, 68.5000)?.name, 'Toshkent');
    });

    test('fallbackCenter — ro\'yxatdagi BIRINCHI shahar markazi', () {
      // Tartib serverdan keladi (`sortOrder`), mobil tomon qayta
      // saralamaydi — ya'ni "asosiy shahar" serverning qarori.
      expect(coverage.fallbackCenter, _angren.center);
      expect(coverage.primary?.name, 'Angren');
    });
  });

  group('CityCoverage — MA\'LUMOT YO\'Q holati (himoya)', () {
    test('bo\'sh ro\'yxat hech narsani bloklamaydi', () {
      // Sozlama bo'sh = cheklov yo'q. Bu qoida buzilsa, birorta shahar
      // sozlanmagan serverda ilova umuman buyurtma qabul qilmasdi.
      expect(CityCoverage.empty.hasData, isFalse);
      expect(CityCoverage.empty.isServiceable(_toshkentLat, _toshkentLng), isTrue);
      expect(CityCoverage.empty.isServiceable(0, 0), isTrue);
      expect(CityCoverage.empty.isOutside(0, 0), isFalse);
    });

    test('bo\'sh ro\'yxatda eng yaqin shahar yo\'q', () {
      expect(CityCoverage.empty.nearestTo(0, 0), isNull);
      expect(CityCoverage.empty.primary, isNull);
    });

    test('bo\'sh ro\'yxatda zaxira markaz AppConfig qiymatida qoladi', () {
      // Ilova koordinatasiz xaritani ocha olmaydi, shuning uchun zaxira
      // hech qachon `null` bo'lmaydi.
      expect(
        CityCoverage.empty.fallbackCenter,
        const LatLng(AppConfig.defaultLat, AppConfig.defaultLng),
      );
    });
  });

  group('CityCoverage.fromResponse', () {
    const angrenJson = {
      'id': 'city-angren',
      'name': 'Angren',
      'centerLat': 40.0956,
      'centerLng': 70.9432,
      'radiusKm': 25,
    };

    test('o\'ralgan javobni ({success, data}) o\'qiydi', () {
      final coverage = CityCoverage.fromResponse(const {
        'success': true,
        'data': [angrenJson],
      });
      expect(coverage.cities.single.name, 'Angren');
      expect(coverage.cities.single.radiusKm, 25);
    });

    test('sof massivni ham o\'qiydi', () {
      final coverage = CityCoverage.fromResponse(const [angrenJson]);
      expect(coverage.cities.single.id, 'city-angren');
    });

    test('kutilmagan shakl bo\'sh qamrovga aylanadi, xatoga emas', () {
      expect(CityCoverage.fromResponse(null).hasData, isFalse);
      expect(CityCoverage.fromResponse('nimadir').hasData, isFalse);
      expect(CityCoverage.fromResponse(const {'data': null}).hasData, isFalse);
    });

    test('faol emas shahar qamrovga kirmaydi', () {
      final coverage = CityCoverage.fromResponse(const {
        'data': [
          {...angrenJson, 'isActive': false},
        ],
      });
      expect(coverage.hasData, isFalse);
    });

    test('buzuq element tashlanadi, qolganlari saqlanadi', () {
      // Bitta yaroqsiz yozuv butun qamrovni yo'q qilmasligi kerak — aks
      // holda serverdagi bitta xato ilovani to'liq to'xtatib qo'yardi.
      final coverage = CityCoverage.fromResponse(const {
        'data': [
          {'id': 'buzuq', 'name': 'Radiussiz'},
          angrenJson,
          'satr',
        ],
      });
      expect(coverage.cities.map((c) => c.name), ['Angren']);
    });

    test('tartib serverdagidek saqlanadi', () {
      final coverage = CityCoverage.fromResponse(const {
        'data': [
          {
            'id': 'city-toshkent',
            'name': 'Toshkent',
            'centerLat': 41.2995,
            'centerLng': 69.2401,
            'radiusKm': 30,
          },
          angrenJson,
        ],
      });
      expect(coverage.primary?.name, 'Toshkent');
    });
  });
}
