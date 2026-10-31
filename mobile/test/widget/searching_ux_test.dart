// 4-bosqich (2026-10-31): qidiruv holati va "topilmadi" — dizayn qatlami.
//   · qidiruv kartasi: o'tgan vaqt, matching bosqichiga mos izoh, bo'sh
//     haydovchilar soni (noma'lum bo'lsa — yashirin, yolg'on "0" yo'q);
//   · "topilmadi" oynasi: qayta izlash / boshqa tarif / yopish.
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/features/passenger/widgets/no_drivers_sheet.dart';
import 'package:angren_taxi/features/passenger/widgets/searching_status.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child) => MaterialApp(
      locale: const Locale('uz'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

void main() {
  setUp(() => AppHaptics.enabled = false);

  group('SearchingStatusCard', () {
    late DateTime now;
    final start = DateTime(2026, 10, 31, 10);

    Future<void> pump(WidgetTester tester, {int? nearby, VoidCallback? onRefresh}) =>
        tester.pumpWidget(_app(SearchingStatusCard(
          startedAt: start,
          nearbyFreeDrivers: nearby,
          onRefreshNearby: onRefresh,
          clock: () => now,
        )));

    testWidgets('boshida — yaqin haydovchilar tekshirilmoqda, 0:05', (tester) async {
      now = start.add(const Duration(seconds: 5));
      await pump(tester);

      expect(find.text('Yaqin atrofdagi haydovchilar tekshirilmoqda'), findsOneWidget);
      expect(find.text('Izlanmoqda · 0:05'), findsOneWidget);
    });

    testWidgets('20 s dan keyin — hudud kengaytirilmoqda', (tester) async {
      now = start.add(const Duration(seconds: 25));
      await pump(tester);

      expect(find.text('Qidiruv hududi kengaytirilmoqda'), findsOneWidget);
    });

    testWidgets('1 daqiqadan keyin — rostini aytadi: hamma band', (tester) async {
      now = start.add(const Duration(seconds: 75));
      await pump(tester);

      expect(find.text('Hozircha hamma band — izlashda davom etamiz'), findsOneWidget);
      expect(find.text('Izlanmoqda · 1:15'), findsOneWidget);
    });

    testWidgets('vaqt o‘z-o‘zidan yuradi', (tester) async {
      now = start.add(const Duration(seconds: 5));
      await pump(tester);
      now = now.add(const Duration(seconds: 2));
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Izlanmoqda · 0:07'), findsOneWidget);
    });

    testWidgets('son noma’lum — qator yo‘q (yolg‘on "0" emas)', (tester) async {
      now = start;
      await pump(tester);

      expect(find.byKey(const ValueKey('searching-nearby')), findsNothing);
    });

    testWidgets('0 — "yaqinda bo‘sh haydovchi yo‘q"', (tester) async {
      now = start;
      await pump(tester, nearby: 0);

      expect(find.text("Hozir yaqinda bo'sh haydovchi yo'q"), findsOneWidget);
    });

    testWidgets('3 — "Yaqinda 3 ta bo‘sh haydovchi"; 10 — "10 dan ortiq"', (tester) async {
      now = start;
      await pump(tester, nearby: 3);
      expect(find.text("Yaqinda 3 ta bo'sh haydovchi"), findsOneWidget);

      await pump(tester, nearby: 10);
      expect(find.text("Yaqinda 10 dan ortiq bo'sh haydovchi"), findsOneWidget);
    });

    testWidgets('son darhol va har 15 s da yangilanadi', (tester) async {
      now = start;
      var calls = 0;
      await pump(tester, onRefresh: () => calls++);
      expect(calls, 1);

      await tester.pump(SearchingStatusCard.nearbyRefreshInterval);
      expect(calls, 2);
    });
  });

  group('showNoDriversSheet', () {
    Future<NoDriversChoice?> open(WidgetTester tester, {required bool canRetry}) async {
      NoDriversChoice? result;
      await tester.pumpWidget(_app(Builder(
        builder: (context) => ElevatedButton(
          onPressed: () async => result = await showNoDriversSheet(context, canRetry: canRetry),
          child: const Text('OPEN'),
        ),
      )));
      await tester.tap(find.text('OPEN'));
      await tester.pumpAndSettle();
      return result;
    }

    testWidgets('sarlavha va uchta yo‘l', (tester) async {
      await open(tester, canRetry: true);

      expect(find.text('Haydovchi topilmadi'), findsOneWidget);
      expect(find.text('Qayta izlash'), findsOneWidget);
      expect(find.text('Boshqa tarif'), findsOneWidget);
      expect(find.text('Yopish'), findsOneWidget);
    });

    testWidgets('qayta izlash tanlovi qaytariladi', (tester) async {
      NoDriversChoice? result;
      await tester.pumpWidget(_app(Builder(
        builder: (context) => ElevatedButton(
          onPressed: () async => result = await showNoDriversSheet(context, canRetry: true),
          child: const Text('OPEN'),
        ),
      )));
      await tester.tap(find.text('OPEN'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('no-drivers-retry')));
      await tester.pumpAndSettle();

      expect(result, NoDriversChoice.retry);
    });

    testWidgets('qayta yuboriladigan buyurtma yo‘q — "Qayta izlash" ko‘rinmaydi', (tester) async {
      await open(tester, canRetry: false);

      expect(find.byKey(const ValueKey('no-drivers-retry')), findsNothing);
      expect(find.text('Boshqa tarif'), findsOneWidget);
    });
  });
}
