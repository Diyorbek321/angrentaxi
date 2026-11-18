import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/driver/screens/vehicle_change_screen.dart';
import 'package:angren_taxi/features/driver/vehicle_change_service.dart';
import 'package:angren_taxi/shared/models/vehicle_change_request.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _FakeService extends VehicleChangeService {
  _FakeService(this._latest) : super(_NoApi());

  VehicleChangeRequest? _latest;
  final submitted = <Map<String, Object?>>[];

  @override
  Future<VehicleChangeRequest?> latest() async => _latest;

  @override
  Future<VehicleChangeRequest> submit({
    required String carModel,
    required String carNumber,
    int? carYear,
  }) async {
    submitted.add({'carModel': carModel, 'carNumber': carNumber, 'carYear': carYear});
    return _latest = VehicleChangeRequest(
      id: 'req-1',
      status: VehicleChangeStatus.pending,
      carModel: carModel,
      carNumber: carNumber,
      carYear: carYear,
      createdAt: DateTime(2026, 9, 27),
    );
  }
}

class _NoApi extends Mock implements ApiClient {}

Widget _wrap(VehicleChangeService service) => MaterialApp(
      home: VehicleChangeScreen(current: null, service: service),
    );

void main() {
  testWidgets('sends the new car and then shows the pending state',
      (tester) async {
    final service = _FakeService(null);
    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'Chevrolet Onix');
    await tester.enterText(find.byType(TextFormField).at(1), '10 b 222 bb');
    await tester.enterText(find.byType(TextFormField).at(2), '2024');
    await tester.ensureVisible(find.text("So'rov yuborish"));
    await tester.tap(find.text("So'rov yuborish"));
    await tester.pumpAndSettle();

    // The plate is upper-cased as it is typed.
    expect(service.submitted.single,
        {'carModel': 'Chevrolet Onix', 'carNumber': '10 B 222 BB', 'carYear': 2024});
    expect(find.text("So'rov ko'rib chiqilmoqda"), findsOneWidget);
    // While a request is pending there is no second form to submit.
    expect(find.text("So'rov yuborish"), findsNothing);
  });

  testWidgets('does not send an empty form', (tester) async {
    final service = _FakeService(null);
    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text("So'rov yuborish"));
    await tester.tap(find.text("So'rov yuborish"));
    await tester.pumpAndSettle();

    expect(service.submitted, isEmpty);
    expect(find.text('Mashina rusumini kiriting'), findsOneWidget);
  });

  testWidgets('shows why the last request was rejected and allows a new one',
      (tester) async {
    final service = _FakeService(VehicleChangeRequest(
      id: 'req-0',
      status: VehicleChangeStatus.rejected,
      carModel: 'Nexia',
      carNumber: '10 C 333 CC',
      reviewNote: "Raqam o'qilmayapti",
      createdAt: DateTime(2026, 9, 20),
    ));
    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    expect(find.text('Rad etildi'), findsOneWidget);
    expect(find.text("Sabab: Raqam o'qilmayapti"), findsOneWidget);
    expect(find.text("So'rov yuborish"), findsOneWidget);
  });
}
