import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/lost_items/lost_items_service.dart';
import 'package:angren_taxi/features/lost_items/screens/lost_items_screen.dart';
import 'package:angren_taxi/shared/models/lost_item_report.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';

class _NoApi extends Mock implements ApiClient {}

class _FakeService extends LostItemsService {
  _FakeService(this.items) : super(_NoApi());

  List<LostItemReport> items;
  final responses = <Map<String, Object?>>[];

  @override
  Future<List<LostItemReport>> mine() async => items;

  @override
  Future<LostItemReport> driverRespond(String id, {required bool found, String? note}) async {
    responses.add({'id': id, 'found': found, 'note': note});
    final old = items.firstWhere((i) => i.id == id);
    return LostItemReport(
      id: old.id,
      orderId: old.orderId,
      description: old.description,
      status: found ? LostItemStatus.found : LostItemStatus.notFound,
      createdAt: old.createdAt,
      driverNote: note,
    );
  }
}

LostItemReport _open() => LostItemReport(
      id: 'rep-1',
      orderId: 'order-1',
      description: 'Qora hamyon',
      status: LostItemStatus.open,
      createdAt: DateTime(2026, 9, 27, 10),
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('uz');
  });

  testWidgets('driver answers "not found" and the card updates', (tester) async {
    final service = _FakeService([_open()]);
    await tester.pumpWidget(MaterialApp(
      home: LostItemsScreen(isDriver: true, service: service),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Qora hamyon'), findsOneWidget);
    await tester.tap(find.text('Topmadim'));
    await tester.pumpAndSettle();

    expect(service.responses.single, {'id': 'rep-1', 'found': false, 'note': null});
    expect(find.text('Mashinadan topilmadi'), findsOneWidget);
    expect(find.text('Topdim'), findsNothing);
  });

  testWidgets('driver answers "found" with where it is', (tester) async {
    final service = _FakeService([_open()]);
    await tester.pumpWidget(MaterialApp(
      home: LostItemsScreen(isDriver: true, service: service),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Topdim'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Bagajda');
    await tester.tap(find.text('Yuborish'));
    await tester.pumpAndSettle();

    expect(service.responses.single['note'], 'Bagajda');
    expect(find.text('Haydovchi: Bagajda'), findsOneWidget);
  });

  testWidgets('passenger sees status but has no answer buttons', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: LostItemsScreen(isDriver: false, service: _FakeService([_open()])),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Haydovchi tekshirmoqda'), findsOneWidget);
    expect(find.text('Topdim'), findsNothing);
  });
}
