// Shaharlararo — haydovchi qatnovini boshqarish ekrani: holat → tugmalar,
// jo'nash sharti, "Kelmadi" tasdig'i, eng yaqindan tartib, yakuniy naqd.
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_trip_run_screen.dart';
import 'package:angren_taxi/shared/widgets/ag_slide_action.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime.utc(2026, 10, 17, 5);

IntercityTrip _trip(String status, {int seatsLeft = 2, DateTime? departureAt}) =>
    IntercityTrip.fromJson({
      'id': 't1',
      'route': const {
        'id': 'r-a-r',
        'origin': {'id': 'p-a', 'name': 'Angren'},
        'destination': {'id': 'p-r', 'name': 'Rohat krugi'},
      },
      'tripClass': 'start',
      'departureAt':
          (departureAt ?? _now.add(const Duration(minutes: 30))).toIso8601String(),
      'status': status,
      'seatsTotal': 4,
      'seatsLeft': seatsLeft,
      'wholeCarAvailable': false,
      'wholeCarBooked': false,
      'seatPrice': 25000,
      'wholeCarPrice': 100000,
      'driver': null,
      'cancelReason': null,
    });

IntercityDriverBooking _b(
  String id,
  String status, {
  double? lat,
  double? lng,
  String? phone,
  double price = 25000,
}) =>
    IntercityDriverBooking(
      orderId: id,
      status: status,
      seats: 1,
      bookingKind: 'seat',
      price: price,
      passengerName: 'Yo\'lovchi $id',
      passengerPhone: phone,
      pickupAddress: 'Manzil $id',
      pickupLat: lat,
      pickupLng: lng,
      dropoffAddress: 'Rohat krugi',
    );

DioException _notAllowed(String reason) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: 409,
        data: {
          'statusCode': 409,
          'code': 'INTERCITY_TRIP_ACTION_NOT_ALLOWED',
          'message': 'x',
          'details': {'reason': reason},
        },
      ),
    );

class FakeRunRepository extends IntercityRepository {
  FakeRunRepository(this.current, this.bookings);

  IntercityTrip current;
  List<IntercityDriverBooking> bookings;
  final calls = <String>[];
  Object? startBoardingError;

  void _set(String id, String status) => bookings = [
        for (final b in bookings)
          if (b.orderId == id) _b(b.orderId, status, lat: b.pickupLat, lng: b.pickupLng, price: b.price) else b,
      ];

  @override
  Future<IntercityTrip> trip(String id) async => current;

  @override
  Future<List<IntercityDriverBooking>> tripBookings(String tripId) async => bookings;

  @override
  Future<IntercityTrip> startBoarding(String id) async {
    calls.add('startBoarding');
    if (startBoardingError != null) throw startBoardingError!;
    current = _trip('boarding');
    bookings = [for (final b in bookings) b.status == 'scheduled' ? _b(b.orderId, 'accepted', lat: b.pickupLat, lng: b.pickupLng) : b];
    return current;
  }

  @override
  Future<void> markArrived(String orderId) async {
    calls.add('arrived:$orderId');
    _set(orderId, 'arrived');
  }

  @override
  Future<IntercityTrip> noShow(String orderId) async {
    calls.add('noShow:$orderId');
    _set(orderId, 'cancelled');
    return current;
  }

  @override
  Future<IntercityTrip> depart(String id) async {
    calls.add('depart');
    current = _trip('in_progress');
    bookings = [for (final b in bookings) b.status == 'arrived' ? _b(b.orderId, 'in_progress', price: b.price) : b];
    return current;
  }

  @override
  Future<void> completeBooking(String orderId) async {
    calls.add('complete:$orderId');
    _set(orderId, 'completed');
    if (bookings.every((b) => !b.isLive)) current = _trip('completed');
  }
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Future<FakeRunRepository> _pump(
  WidgetTester tester,
  IntercityTrip trip,
  List<IntercityDriverBooking> bookings, {
  ({double lat, double lng})? here,
}) async {
  tester.view.physicalSize = const Size(400, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final repo = FakeRunRepository(trip, bookings);
  await tester.pumpWidget(MaterialApp(
    home: IntercityTripRunScreen(
      trip: trip,
      repository: repo,
      locate: () async => here,
      now: () => _now,
      subscribeRealtime: false,
    ),
  ));
  await _settle(tester);
  return repo;
}

AgSlideAction _slide(WidgetTester tester) =>
    tester.widget<AgSlideAction>(find.byType(AgSlideAction));

void main() {
  testWidgets("open: «Yig'ishni boshlash» — bosilsa server chaqiriladi", (tester) async {
    final repo = await _pump(tester, _trip('open'), [_b('a', 'scheduled')]);

    expect(find.text('Yetib keldim'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('ic_run_start_boarding')));
    await _settle(tester);

    expect(repo.calls, ['startBoarding']);
    expect(find.text('Yetib keldim'), findsOneWidget);
  });

  testWidgets("open, lekin hali erta — tugma o'chiq", (tester) async {
    await _pump(
      tester,
      _trip('open', departureAt: _now.add(const Duration(hours: 3))),
      [_b('a', 'scheduled')],
    );
    final button = tester.widget<FilledButton>(find.descendant(
      of: find.byKey(const ValueKey('ic_run_start_boarding')),
      matching: find.byType(FilledButton),
    ));
    expect(button.onPressed, isNull);
  });

  testWidgets("server TOO_EARLY qaytarsa tushunarli xabar", (tester) async {
    final repo = await _pump(tester, _trip('full', seatsLeft: 0), [_b('a', 'scheduled')]);
    repo.startBoardingError = _notAllowed('TOO_EARLY');

    await tester.tap(find.byKey(const ValueKey('ic_run_start_boarding')));
    await _settle(tester);

    expect(
      find.descendant(
        of: find.byType(SnackBar),
        matching: find.textContaining('60 daqiqa'),
      ),
      findsOneWidget,
    );
  });

  testWidgets("boarding: hamma olinmaguncha jo'nash o'chiq, olingach yoqiladi",
      (tester) async {
    final repo = await _pump(tester, _trip('boarding'), [
      _b('a', 'accepted'),
      _b('b', 'accepted'),
    ]);

    expect(_slide(tester).enabled, isFalse);
    await tester.tap(find.byKey(const ValueKey('ic_run_arrived_a')));
    await _settle(tester);
    expect(_slide(tester).enabled, isFalse);
    await tester.tap(find.byKey(const ValueKey('ic_run_arrived_b')));
    await _settle(tester);

    expect(repo.calls, ['arrived:a', 'arrived:b']);
    expect(_slide(tester).enabled, isTrue);
    _slide(tester).onCompleted();
    await _settle(tester);
    expect(repo.calls.last, 'depart');
    expect(find.text('Tushirdim'), findsNWidgets(2));
  });

  testWidgets("«Kelmadi» tasdiqsiz yuborilmaydi; tasdiqlansa band bekor",
      (tester) async {
    final repo = await _pump(tester, _trip('boarding'), [
      _b('a', 'accepted'),
      _b('b', 'arrived'),
    ]);

    await tester.tap(find.byKey(const ValueKey('ic_run_noshow_a')));
    await _settle(tester);
    expect(find.text("Yo'lovchi kelmadimi?"), findsOneWidget);
    await tester.tap(find.text('Yopish'));
    await _settle(tester);
    expect(repo.calls, isEmpty);

    await tester.tap(find.byKey(const ValueKey('ic_run_noshow_a')));
    await _settle(tester);
    await tester.tap(find.text('Ha, kelmadi'));
    await _settle(tester);
    expect(repo.calls, ['noShow:a']);
    // Qolgan yagona tirik yo'lovchi olingan — jo'nash ochiladi.
    expect(_slide(tester).enabled, isTrue);
  });

  testWidgets("yo'lovchilar haydovchidan eng yaqinidan boshlab", (tester) async {
    await _pump(
      tester,
      _trip('boarding'),
      [
        _b('far', 'accepted', lat: 40.30, lng: 70.90),
        _b('near', 'accepted', lat: 40.10, lng: 70.90),
      ],
      here: (lat: 40.09, lng: 70.90),
    );

    final nearY = tester.getTopLeft(find.text("Yo'lovchi near")).dy;
    final farY = tester.getTopLeft(find.text("Yo'lovchi far")).dy;
    expect(nearY, lessThan(farY));
  });

  testWidgets("telefon bo'lsa qo'ng'iroq tugmasi, bo'lmasa yo'q", (tester) async {
    await _pump(tester, _trip('boarding'), [
      _b('a', 'accepted', phone: '+998901112233'),
      _b('b', 'accepted'),
    ]);
    expect(find.byKey(const ValueKey('ic_run_call_a')), findsOneWidget);
    expect(find.byKey(const ValueKey('ic_run_call_b')), findsNothing);
  });

  testWidgets("yo'lda: «Naqd oling», oxirgisi tushirilgach jami naqd", (tester) async {
    final repo = await _pump(tester, _trip('in_progress'), [
      _b('a', 'in_progress', price: 25000),
      _b('b', 'in_progress', price: 50000),
    ]);

    expect(find.textContaining('Naqd oling'), findsNWidgets(2));
    await tester.tap(find.byKey(const ValueKey('ic_run_dropoff_a')));
    await _settle(tester);
    await tester.tap(find.byKey(const ValueKey('ic_run_dropoff_b')));
    await _settle(tester);

    expect(repo.calls, ['complete:a', 'complete:b']);
    expect(find.text('Qatnov yakunlandi'), findsOneWidget);
    // Narx formati guruhlashda bo'linmas bo'shliq ishlatishi mumkin.
    expect(find.textContaining(RegExp(r'Jami naqd: 75\s000')), findsOneWidget);
  });

  testWidgets("bekor qilingan qatnov — faqat o'qish", (tester) async {
    await _pump(tester, _trip('cancelled'), [_b('a', 'cancelled')]);
    expect(find.byKey(const ValueKey('ic_run_start_boarding')), findsNothing);
    expect(find.byType(AgSlideAction), findsNothing);
    expect(find.text('Yetib keldim'), findsNothing);
  });
}
