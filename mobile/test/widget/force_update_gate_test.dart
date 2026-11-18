import 'package:angren_taxi/core/update/app_update.dart';
import 'package:angren_taxi/core/update/force_update_gate.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<void> pump(
    WidgetTester tester,
    UpdateRequirement requirement,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => ForceUpdateGate(
          check: () async => UpdateCheckResult(
            requirement,
            const AppVersionPolicy(
              minBuild: 10,
              latestBuild: 20,
              updateUrl: 'https://x.uz/a.apk',
            ),
          ),
          child: child!,
        ),
        home: const Scaffold(body: Text('ilova')),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('majburiy — ilova o\'rniga "yangilang" ekrani', (tester) async {
    await pump(tester, UpdateRequirement.required);
    expect(find.text('Ilovani yangilang'), findsOneWidget);
    expect(find.text('ilova'), findsNothing);
  });

  testWidgets('ixtiyoriy — ilova ishlaydi, taklif yopiladi', (tester) async {
    await pump(tester, UpdateRequirement.optional);
    expect(find.text('ilova'), findsOneWidget);
    expect(find.text('Ilovaning yangi versiyasi chiqdi'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pump();
    expect(find.text('Ilovaning yangi versiyasi chiqdi'), findsNothing);
  });

  testWidgets("yangilanish kerak emas — hech narsa ko'rinmaydi", (tester) async {
    await pump(tester, UpdateRequirement.none);
    expect(find.text('ilova'), findsOneWidget);
    expect(find.text('Ilovani yangilang'), findsNothing);
  });
}
