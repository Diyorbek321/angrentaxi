import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/trip/meter/live_meter_card.dart';
import 'package:angren_taxi/features/trip/meter/meter_reading.dart';
import 'package:angren_taxi/features/trip/meter/meter_service.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _NoApi extends Mock implements ApiClient {}

class _FakeMeter extends MeterService {
  _FakeMeter(this.readings) : super(_NoApi());

  final List<MeterReading?> readings;
  int calls = 0;

  @override
  Future<MeterReading> reading(String orderId) async {
    final r = readings[calls < readings.length ? calls : readings.length - 1];
    calls++;
    if (r == null) throw Exception('offline');
    return r;
  }
}

void main() {
  Future<void> pump(WidgetTester tester, _FakeMeter meter) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('uz'),
      home: Scaffold(
        body: LiveMeterCard(
          orderId: 'o-1',
          service: meter,
          minFare: 5000,
          refresh: const Duration(seconds: 10),
        ),
      ),
    ));
  }

  testWidgets('shows the running fare, distance and time, and refreshes', (tester) async {
    final meter = _FakeMeter(const [
      MeterReading(distanceKm: 1.2, durationMin: 3, waitingFare: 0, fare: 5400),
      MeterReading(distanceKm: 3.4, durationMin: 8, waitingFare: 0, fare: 9700),
    ]);
    await pump(tester, meter);
    await tester.pump();

    expect(find.textContaining(RegExp(r'5\s?400')), findsOneWidget);
    expect(find.textContaining('1.2 km'), findsOneWidget);

    await tester.pump(const Duration(seconds: 10));
    await tester.pump();
    expect(find.textContaining(RegExp(r'9\s?700')), findsOneWidget);
    expect(find.textContaining('3.4 km · 8'), findsOneWidget);
  });

  testWidgets('before the first answer it says "at least" the minimum', (tester) async {
    await pump(tester, _FakeMeter(const [null]));
    await tester.pump();
    expect(find.textContaining('kamida'), findsOneWidget);
  });

  testWidgets('a failed refresh keeps the last good number on screen', (tester) async {
    final meter = _FakeMeter(const [
      MeterReading(distanceKm: 2, durationMin: 5, waitingFare: 0, fare: 7000),
      null,
    ]);
    await pump(tester, meter);
    await tester.pump();
    await tester.pump(const Duration(seconds: 10));
    await tester.pump();
    expect(meter.calls, 2);
    expect(find.textContaining(RegExp(r'7\s?000')), findsOneWidget);
  });
}
