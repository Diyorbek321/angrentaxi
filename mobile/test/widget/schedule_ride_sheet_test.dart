// `ScheduleRideSheet` tanlagichi.
//
// Eng muhim shart: foydalanuvchi backend RAD ETADIGAN slotni tanlay
// olmasligi. Backend `SCHEDULED_MIN_LEAD_MINUTES` (30 daqiqa) dan yaqin
// vaqtni 400 bilan qaytaradi — tanlagich uni taklif qilsa, foydalanuvchi
// uchun bu sababsiz xato bo'lardi.
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/widgets/schedule_ride_sheet.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  // `Formatters.formatTime` `DateFormat(..., 'uz')` ni ishlatadi.
  setUpAll(() async => initializeDateFormatting('uz', null));

  // Soat 10:00 — kunning o'rtasi, ya'ni o'tgan va kelgusi slotlar ikkalasi
  // ham ro'yxatda bo'ladi.
  final now = DateTime(2026, 8, 19, 10, 0);

  Future<void> pumpSheet(WidgetTester tester, {DateTime? initialValue}) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ScheduleRideSheet(now: now, initialValue: initialValue),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// Berilgan matnli slot tugmasining `AppPressable` i.
  AppPressable pressableFor(WidgetTester tester, String label) {
    return tester.widget<AppPressable>(
      find.ancestor(
        of: find.text(label),
        matching: find.byType(AppPressable),
      ).first,
    );
  }

  testWidgets('kun chiplari "Bugun" va "Ertaga" bilan boshlanadi', (tester) async {
    await pumpSheet(tester);

    expect(find.text('Bugun'), findsOneWidget);
    expect(find.text('Ertaga'), findsOneWidget);
  });

  testWidgets('bugungi ro\'yxat eng erta yaroqli slotdan boshlanadi', (tester) async {
    await pumpSheet(tester);

    // 10:00 + 30 daqiqa = 10:30 eng erta ruxsat etilgan vaqt, va ro'yxat
    // aynan shundan boshlanadi.
    expect(find.text('10:30'), findsOneWidget);
    expect(pressableFor(tester, '10:30').onTap, isNotNull);
  });

  testWidgets('o\'tgan va juda yaqin slotlar UMUMAN taklif qilinmaydi', (tester) async {
    await pumpSheet(tester);

    // Backend bularni 400 bilan rad etadi — ularni ko'rsatish
    // foydalanuvchini rad etiladigan tanlovga yetaklardi.
    expect(find.text('00:00'), findsNothing);
    expect(find.text('08:00'), findsNothing);
    expect(find.text('10:00'), findsNothing);
    expect(find.text('10:15'), findsNothing);
  });

  testWidgets('hech narsa tanlanmaguncha CTA o\'chiq turadi', (tester) async {
    await pumpSheet(tester);

    expect(find.text('Vaqtni tanlang'), findsOneWidget);
    final cta = pressableFor(tester, 'Vaqtni tanlang');
    expect(cta.onTap, isNull);
  });

  testWidgets('kech tunda bugungi kun uchun tushuntirish ko\'rsatiladi', (tester) async {
    // 23:50 + 30 daqiqa = ertangi 00:20 — bugun uchun slot qolmadi.
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ScheduleRideSheet(now: DateTime(2026, 8, 19, 23, 50)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text("Bu kun uchun vaqt qolmadi — keyingi kunni tanlang."),
      findsOneWidget,
    );
  });

  testWidgets('yaroqli slot tanlanib, CTA tanlangan vaqtni ko\'rsatadi', (tester) async {
    await pumpSheet(tester);

    await tester.tap(find.text('11:00'));
    await tester.pumpAndSettle();

    expect(find.text('Bugun, 11:00'), findsOneWidget);
    expect(find.text('Vaqtni tanlang'), findsNothing);
  });

  testWidgets('tasdiqlash tanlangan DateTime ni qaytaradi', (tester) async {
    DateTime? result;
    var popped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await ScheduleRideSheet.show(context, now: now);
                popped = true;
              },
              child: const Text('ochish'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('ochish'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('14:30'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bugun, 14:30'));
    await tester.pumpAndSettle();

    expect(popped, isTrue);
    expect(result, DateTime(2026, 8, 19, 14, 30));
  });

  testWidgets('"Hozir buyurtma qilaman" null qaytaradi', (tester) async {
    DateTime? result;
    var popped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () async {
                result = await ScheduleRideSheet.show(
                  context,
                  now: now,
                  initialValue: DateTime(2026, 8, 19, 14, 30),
                );
                popped = true;
              },
              child: const Text('ochish'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('ochish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hozir buyurtma qilaman'));
    await tester.pumpAndSettle();

    expect(popped, isTrue);
    expect(result, isNull);
  });

  testWidgets('kun almashtirilganda ertangi butun kun ochiladi', (tester) async {
    await pumpSheet(tester);

    // Bugun 00:00 umuman yo'q edi; ertaga — ro'yxat boshidan.
    await tester.tap(find.text('Ertaga'));
    await tester.pumpAndSettle();

    expect(find.text('00:00'), findsOneWidget);
    expect(pressableFor(tester, '00:00').onTap, isNotNull);
  });

  testWidgets('barcha slot tugmalari kamida kMinTapTarget balandlikda', (tester) async {
    await pumpSheet(tester);

    final slotTiles = find.ancestor(
      of: find.text('11:00'),
      matching: find.byType(AppPressable),
    );
    final size = tester.getSize(slotTiles.first);

    expect(size.height, greaterThanOrEqualTo(kMinTapTarget));
  });

  testWidgets('mijoz chegarasi backend chegarasi bilan mos', (tester) async {
    // Ikkisi ohista bir-biridan uzoqlashsa, tanlagich server rad etadigan
    // slotni taklif qila boshlaydi.
    expect(kScheduleMinLeadMinutes, 30);
    expect(kScheduleMaxAheadDays, 14);
  });
}
