import 'package:angren_taxi/features/driver/widgets/interrupt_trip_sheet.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets("safar uzildi varag'i: sabab va izoh qaytadi (INCIDENT-POLICY §5)", (tester) async {
    InterruptChoice? result;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('uz'),
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () async => result = await showInterruptTripSheet(context),
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('interrupt_reason_accident')));
    await tester.enterText(find.byType(TextField), '  urildi ');
    await tester.pump();
    await tester.tap(find.byKey(InterruptTripSheet.confirmKey));
    await tester.pumpAndSettle();

    expect(result?.reason, 'accident');
    expect(result?.note, 'urildi');
  });
}
