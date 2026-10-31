import 'package:angren_taxi/features/driver/widgets/trip_options_badges.dart';
import 'package:angren_taxi/features/passenger/widgets/trip_options_sheet.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/trip_option.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TripOption parsing', () {
    test('unknown and duplicate values are dropped, order kept', () {
      expect(
        TripOption.listFromApi(['pet', 'jacuzzi', 'child_seat', 'pet']),
        [TripOption.pet, TripOption.childSeat],
      );
      expect(TripOption.listFromApi(null), isEmpty);
    });

    test('Order.fromJson reads options', () {
      final order = Order.fromJson(const {
        'id': 'o1',
        'passengerId': 'p1',
        'pickup': {'address': 'A', 'lat': 41.0, 'lng': 70.1},
        'dropoff': {'address': 'B', 'lat': 41.1, 'lng': 70.2},
        'status': 'searching',
        'estimatedPrice': 10000,
        'createdAt': '2026-09-27T10:00:00Z',
        'options': ['child_seat'],
      });
      expect(order.options, [TripOption.childSeat]);
    });
  });

  testWidgets('sheet returns the ticked options in a stable order',
      (tester) async {
    List<TripOption>? result;
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            result = await TripOptionsSheet.show(context, initial: const []);
          },
          child: const Text('open'),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('trip-option-pet')));
    await tester.tap(find.byKey(const ValueKey('trip-option-child_seat')));
    await tester.pump();
    await tester.tap(find.text('Tayyor'));
    await tester.pumpAndSettle();

    expect(result, [TripOption.childSeat, TripOption.pet]);
  });

  testWidgets('driver sees what the passenger asked for', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: TripOptionsBadges(options: [TripOption.childSeat, TripOption.pet]),
      ),
    ));
    expect(find.text("Bola o'rindig'i"), findsOneWidget);
    expect(find.text('Hayvon bilan'), findsOneWidget);
  });

  testWidgets('no options → nothing rendered', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: TripOptionsBadges(options: [])),
    ));
    expect(find.byType(Wrap), findsNothing);
  });
}
