import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:angren_taxi/shared/widgets/connection_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late ValueNotifier<bool> offline;

  setUp(() => offline = ValueNotifier(false));

  Future<void> pump(WidgetTester tester) => tester.pumpWidget(
        MaterialApp(
          locale: const Locale('uz'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ConnectionBanner(
            offline: offline,
            child: const Scaffold(body: Text('xarita')),
          ),
        ),
      );

  testWidgets("qisqa uzilish (< 3 s) — belgi chiqmaydi", (tester) async {
    await pump(tester);
    offline.value = true;
    await tester.pump(const Duration(seconds: 2));
    offline.value = false;
    await tester.pump(const Duration(seconds: 5));

    expect(find.textContaining('qayta ulanmoqda'), findsNothing);
  });

  testWidgets('uzoq uzilish — belgi chiqadi, ulanganda yo\'qoladi',
      (tester) async {
    await pump(tester);
    offline.value = true;
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.textContaining('qayta ulanmoqda'), findsOneWidget);

    offline.value = false;
    await tester.pumpAndSettle();
    expect(find.textContaining('qayta ulanmoqda'), findsNothing);
    expect(find.text('xarita'), findsOneWidget);
  });
}
