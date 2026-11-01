// Tayyorlik oynasi (2026-11-01): zakaz kanali, full-screen va autostart
// qatorlari; telefonga tegishli bo'lmagan band ko'rinmaydi; dastur
// tekshira olmaydigan autostart uchun ko'rsatma chiqadi.
import 'package:angren_taxi/features/driver/readiness/driver_readiness.dart';
import 'package:angren_taxi/features/driver/readiness/driver_readiness_sheet.dart';
import 'package:angren_taxi/features/driver/readiness/readiness_checker.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _Fake implements ReadinessChecker {
  _Fake(this.readiness);

  DriverReadiness readiness;
  final fixed = <ReadinessItem>[];

  @override
  Future<DriverReadiness> check() async => readiness;

  @override
  Future<void> fix(ReadinessItem item) async => fixed.add(item);
}

DriverReadiness _r(
  Set<ReadinessItem> missing, {
  Set<ReadinessItem> hidden = const {},
  bool unverifiable = false,
}) =>
    DriverReadiness(
      {for (final i in ReadinessItem.values) i: !missing.contains(i)},
      hidden: hidden,
      autostartUnverifiable: unverifiable,
    );

Future<void> _pump(WidgetTester tester, _Fake checker) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('uz'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: DriverReadinessSheet(checker: checker, initial: checker.readiness),
    ),
  ));
}

void main() {
  testWidgets('jim qilingan zakaz kanali — qizil, onlayn bo‘lish o‘chiq, Sozlamalar ochiladi',
      (tester) async {
    final checker = _Fake(_r({ReadinessItem.offerAlerts}));
    await _pump(tester, checker);

    expect(find.text('Buyurtma ovozi'), findsOneWidget);
    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton).last);
    expect(button.onPressed, isNull);

    await tester.tap(find.text('Sozlamalar'));
    await tester.pump();
    expect(checker.fixed, [ReadinessItem.offerAlerts]);
  });

  testWidgets('full-screen va autostart — tavsiya, onlayn bo‘lish mumkin', (tester) async {
    final checker = _Fake(_r({ReadinessItem.fullScreen, ReadinessItem.autostart}));
    await _pump(tester, checker);

    expect(find.text('Qulflangan ekranda ochilish'), findsOneWidget);
    expect(find.text('Avtozapusk'), findsOneWidget);
    final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton).last);
    expect(button.onPressed, isNotNull);
  });

  testWidgets('autostart sahifasi yo‘q telefon (Samsung) — qator ko‘rinmaydi', (tester) async {
    await _pump(tester, _Fake(_r({}, hidden: {ReadinessItem.autostart})));

    expect(find.text('Avtozapusk'), findsNothing);
    expect(find.text('Buyurtma ovozi'), findsOneWidget);
  });

  testWidgets('tekshirib bo‘lmaydigan autostart — ko‘rsatma bajarilgandan keyin ham turadi',
      (tester) async {
    await _pump(tester, _Fake(_r({}, unverifiable: true)));

    expect(find.textContaining('tekshirishga ruxsat bermaydi'), findsOneWidget);
  });
}
