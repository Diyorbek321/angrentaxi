// Smena taqqoslash matni va model — docs/LEGAL-COMPLIANCE.md §8, §10.
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/shared/models/shift_pass.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('shiftPassComparisonText', () {
    test("komissiya va smena narxi so'mda aytiladi", () {
      const c = ShiftPassComparison(
        periodDays: 7,
        commissionPaid: 84000,
        workingDays: 3,
        passCost: 75000,
        cheaperOption: ShiftPassCheaperOption.shiftPass,
        savings: 9000,
      );
      expect(
        shiftPassComparisonText(c),
        "So'nggi 7 kunda komissiyaga ${Formatters.formatPrice(84000)} "
        "to'ladingiz, smena bilan ${Formatters.formatPrice(75000)} bo'lardi.",
      );
      expect(
        shiftPassVerdictText(c),
        'Smena ${Formatters.formatPrice(9000)} tejardi',
      );
    });

    test('komissiya arzonroq bo\'lsa — shuni aytadi', () {
      const c = ShiftPassComparison(
        commissionPaid: 10000,
        workingDays: 2,
        passCost: 50000,
        cheaperOption: ShiftPassCheaperOption.commission,
        savings: 40000,
      );
      expect(
        shiftPassVerdictText(c),
        'Komissiya ${Formatters.formatPrice(40000)} arzonroq tushdi',
      );
    });

    test('safar bo\'lmagan bo\'lsa taqqoslash yo\'q', () {
      const c = ShiftPassComparison(workingDays: 0);
      expect(shiftPassComparisonText(c), contains("safar bo'lmadi"));
      expect(shiftPassVerdictText(c), isNull);
    });
  });

  group('ShiftPassInfo.fromJson', () {
    test('faol smena va qolgan vaqt', () {
      final info = ShiftPassInfo.fromJson(const {
        'enabled': true,
        'price': 25000,
        'durationHours': 24,
        'serviceTypes': ['taxi'],
        'current': {
          'id': 'p1',
          'driverId': 'u1',
          'startsAt': '2026-10-15T06:00:00.000Z',
          'endsAt': '2026-10-16T06:00:00.000Z',
          'price': 25000,
          'status': 'active',
          'serviceTypes': ['taxi'],
        },
        'comparison': {
          'periodDays': 7,
          'commissionPaid': 30000,
          'workingDays': 1,
          'passCost': 25000,
          'cheaperOption': 'shift_pass',
          'savings': 5000,
        },
      });
      expect(info.enabled, isTrue);
      final pass = info.current!;
      final now = DateTime.utc(2026, 10, 15, 10, 30).toLocal();
      expect(pass.isActiveAt(now), isTrue);
      expect(pass.remainingAt(now), const Duration(hours: 19, minutes: 30));
      expect(formatShiftRemaining(pass.remainingAt(now)), '19 soat 30 daqiqa');
      expect(pass.isActiveAt(DateTime.utc(2026, 10, 16, 7).toLocal()), isFalse);
      expect(info.comparison.cheaperOption, ShiftPassCheaperOption.shiftPass);
    });

    test("o'chiq smena — standart qiymatlar", () {
      final info = ShiftPassInfo.fromJson(const {'enabled': false});
      expect(info.enabled, isFalse);
      expect(info.current, isNull);
      expect(formatShiftRemaining(const Duration(minutes: 40)), '40 daqiqa');
    });
  });
}
