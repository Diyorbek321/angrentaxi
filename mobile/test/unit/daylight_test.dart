import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/location/daylight.dart';
import 'package:flutter_test/flutter_test.dart';

/// Angren, UTC+5. `DateTime` konstruktori testni ishga tushirgan mashinaning
/// mintaqasini oladi, shuning uchun bu yerda mintaqani aniq beramiz va
/// mahalliy vaqtga o'giramiz — test qaysi serverda ishlashidan qat'i nazar
/// bir xil natija bersin.
DateTime _angrenTime(int year, int month, int day, int hour, int minute) {
  final utc = DateTime.utc(year, month, day, hour - 5, minute);
  return utc.toLocal();
}

bool _isNightInAngren(DateTime at) => Daylight.isNight(
      at: at,
      latitude: AppConfig.defaultLat,
      longitude: AppConfig.defaultLng,
    );

void main() {
  group('Daylight.isNight — Angren', () {
    test('yozda soat 19:00 hali KUNDUZ', () {
      // Aynan shu holat uchun bu modul yozilgan: qat'iy "19:00 dan keyin tun"
      // qoidasi iyun oyida haydovchiga yorug' kunda qora xarita berardi.
      expect(_isNightInAngren(_angrenTime(2026, 6, 21, 19, 0)), isFalse);
    });

    test('yozda soat 22:00 — TUN', () {
      expect(_isNightInAngren(_angrenTime(2026, 6, 21, 22, 0)), isTrue);
    });

    test('qishda soat 18:00 allaqachon TUN', () {
      // Teskari holat: dekabrda 18:00 da qorong'i, lekin "19:00" qoidasi
      // xaritani hali oq holda ushlab turardi.
      expect(_isNightInAngren(_angrenTime(2026, 12, 21, 18, 0)), isTrue);
    });

    test('qishda soat 13:00 — KUNDUZ', () {
      expect(_isNightInAngren(_angrenTime(2026, 12, 21, 13, 0)), isFalse);
    });

    test('yarim tun har doim TUN — fasldan qat\'i nazar', () {
      expect(_isNightInAngren(_angrenTime(2026, 6, 21, 0, 30)), isTrue);
      expect(_isNightInAngren(_angrenTime(2026, 12, 21, 0, 30)), isTrue);
    });

    test('tush payti har doim KUNDUZ — fasldan qat\'i nazar', () {
      for (var month = 1; month <= 12; month++) {
        expect(
          _isNightInAngren(_angrenTime(2026, month, 15, 12, 0)),
          isFalse,
          reason: '$month-oy, soat 12:00 kunduz bo\'lishi kerak',
        );
      }
    });

    test('yozgi kun qishki kundan uzunroq', () {
      // Kun uzunligini soatma-soat sanab chiqamiz — bu quyosh
      // geometriyasining to'g'ri yo'nalishda ishlayotganini tekshiradi.
      int daylightHours(int month, int day) {
        var count = 0;
        for (var hour = 0; hour < 24; hour++) {
          if (!_isNightInAngren(_angrenTime(2026, month, day, hour, 0))) {
            count++;
          }
        }
        return count;
      }

      expect(daylightHours(6, 21), greaterThan(daylightHours(12, 21)));
    });
  });

  group('Daylight.isNight — qutb hududlari', () {
    // Longyearbyen (Svalbard), 78.2°N — quyosh yozda umuman botmaydi,
    // qishda umuman chiqmaydi. Formula bu yerda soat burchagini hisoblay
    // olmaydi, shuning uchun alohida tarmoq bor.
    test('qutb kuni — iyunda tun emas', () {
      expect(
        Daylight.isNight(
          at: DateTime(2026, 6, 21, 2),
          latitude: 78.2,
          longitude: 15.6,
        ),
        isFalse,
      );
    });

    test('qutb tuni — dekabrda kunduz emas', () {
      expect(
        Daylight.isNight(
          at: DateTime(2026, 12, 21, 12),
          latitude: 78.2,
          longitude: 15.6,
        ),
        isTrue,
      );
    });
  });
}
