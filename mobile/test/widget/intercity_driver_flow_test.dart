// Shaharlararo — haydovchi oqimi: bosh ekran kirish kartasi, e'lon qilish,
// qatnovlarim (bekor qilish bilan).
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/driver_intercity_trips_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_publish_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_trip_run_screen.dart';
import 'package:angren_taxi/features/intercity/widgets/intercity_driver_entry_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime.utc(2026, 10, 17, 5);

const _angren = {'id': 'p-a', 'name': 'Angren', 'centerLat': 41.0, 'centerLng': 70.1, 'radiusKm': 12};
const _rohat = {'id': 'p-r', 'name': 'Rohat krugi', 'centerLat': 41.3, 'centerLng': 69.3, 'radiusKm': 1.5};
const _olmaliq = {'id': 'p-o', 'name': 'Olmaliq', 'centerLat': 40.8, 'centerLng': 69.6, 'radiusKm': 10};

final _routes = [
  IntercityRoute.fromJson({
    'id': 'r-a-r',
    'origin': _angren,
    'destination': _rohat,
    'seatPrice': 25000,
    'wholeCarPrice': 100000,
    'comfort': {'seatPrice': 30000, 'wholeCarPrice': 120000},
    'seatsDefault': 4,
  }),
  IntercityRoute.fromJson({
    'id': 'r-a-o',
    'origin': _angren,
    'destination': _olmaliq,
    'seatPrice': 15000,
    'wholeCarPrice': 60000,
    'comfort': null,
    'seatsDefault': 4,
  }),
];

IntercityTrip _trip({
  String id = 't1',
  String status = 'open',
  DateTime? departureAt,
  int seatsLeft = 3,
}) =>
    IntercityTrip.fromJson({
      'id': id,
      'route': const {
        'id': 'r-a-r',
        'origin': {'id': 'p-a', 'name': 'Angren'},
        'destination': {'id': 'p-r', 'name': 'Rohat krugi'},
      },
      'tripClass': 'start',
      'departureAt': (departureAt ?? _now.add(const Duration(hours: 3))).toIso8601String(),
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

DioException _coded(String code) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: 409,
        data: {'statusCode': 409, 'code': code, 'message': code},
      ),
    );

class FakeDriverRepository extends IntercityRepository {
  IntercityPublicSettings settings = const IntercityPublicSettings(enabled: true);
  List<IntercityTrip> trips = [];
  Object? publishError;
  final published = <Map<String, Object?>>[];
  final cancelled = <String, String>{};

  @override
  Future<IntercityPublicSettings> publicSettings() async => settings;

  @override
  Future<List<IntercityRoute>> routes() async => _routes;

  @override
  Future<List<IntercityTrip>> myTrips() async => trips;

  @override
  Future<IntercityTrip> trip(String id) async =>
      trips.firstWhere((t) => t.id == id, orElse: () => _trip(id: id));

  @override
  Future<List<IntercityDriverBooking>> tripBookings(String tripId) async =>
      const [];

  @override
  Future<IntercityTrip> publishTrip({
    required String routeId,
    required DateTime departureAt,
    int? seatsTotal,
    required String tripClass,
  }) async {
    if (publishError != null) throw publishError!;
    published.add({
      'routeId': routeId,
      'departureAt': departureAt,
      'seatsTotal': seatsTotal,
      'tripClass': tripClass,
    });
    return _trip();
  }

  @override
  Future<IntercityTrip> cancelTrip(String id, {required String reason}) async {
    cancelled[id] = reason;
    trips = [
      for (final t in trips)
        if (t.id == id) _trip(id: id, status: 'cancelled') else t,
    ];
    return _trip(id: id, status: 'cancelled');
  }
}

Widget _app(Widget home) => MaterialApp(home: home);

/// Uzun formadagi boshqaruvni ko'rinadigan joyga aylantirib bosadi
/// (test ekrani 800×600, ListView pastki qismini quradi faqat aylantirilsa).
Future<void> _tapKey(WidgetTester tester, String key) async {
  final target = find.byKey(ValueKey(key));
  await tester.scrollUntilVisible(target, 120,
      scrollable: find.byType(Scrollable).first);
  await tester.tap(target);
  await _settle(tester);
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  late FakeDriverRepository repo;

  setUp(() => repo = FakeDriverRepository());

  group('bosh ekran kartasi', () {
    testWidgets("flag o'chiq — umuman chizilmaydi", (tester) async {
      repo.settings = IntercityPublicSettings.disabled;
      await tester.pumpWidget(_app(Scaffold(
        body: IntercityDriverEntryCard(repository: repo, now: () => _now),
      )));
      await _settle(tester);

      expect(find.text('Shaharlararo qatnovlarim'), findsNothing);
    });

    testWidgets("yoqilgan — keyingi qatnov va band joylar", (tester) async {
      repo.trips = [_trip(seatsLeft: 3)];
      await tester.pumpWidget(_app(Scaffold(
        body: IntercityDriverEntryCard(repository: repo, now: () => _now),
      )));
      await _settle(tester);

      expect(find.text('Shaharlararo qatnovlarim'), findsOneWidget);
      expect(find.textContaining('Angren → Rohat krugi'), findsOneWidget);
      expect(find.text('1/4 joy band'), findsOneWidget);
    });
  });

  group("e'lon qilish", () {
    Future<void> pumpPublish(WidgetTester tester, {DateTime? pick}) async {
      await tester.pumpWidget(_app(IntercityPublishScreen(
        repository: repo,
        settings: const IntercityPublicSettings(enabled: true),
        now: () => _now,
        pickDeparture: (_, __) async => pick,
      )));
      await _settle(tester);
    }

    testWidgets("vaqt tanlanmasa yuborilmaydi", (tester) async {
      await pumpPublish(tester);

      await _tapKey(tester, 'ic_publish_submit');

      expect(find.text('Sana va vaqtni tanlang'), findsWidgets);
      expect(repo.published, isEmpty);
    });

    testWidgets("juda erta vaqt — mahalliy xato, so'rov yo'q", (tester) async {
      await pumpPublish(tester, pick: _now.add(const Duration(minutes: 10)));

      await _tapKey(tester, 'ic_publish_departure');
      await _tapKey(tester, 'ic_publish_submit');

      expect(find.textContaining('30 daqiqadan keyin'), findsOneWidget);
      expect(repo.published, isEmpty);
    });

    testWidgets("Comfort narxi yo'q yo'nalishda Comfort tanlanmaydi",
        (tester) async {
      await pumpPublish(tester);

      await tester.tap(find.text('Angren → Olmaliq'));
      await _settle(tester);

      final comfort = tester.widget<ChoiceChip>(
          find.byKey(const ValueKey('ic_publish_class_comfort')));
      expect(comfort.onSelected, isNull);
      expect(find.text("Bu yo'nalishda Comfort narxi yo'q"), findsOneWidget);
    });

    testWidgets("to'g'ri ma'lumot — yo'nalish, joy va klass yuboriladi",
        (tester) async {
      final departure = _now.add(const Duration(hours: 4));
      await pumpPublish(tester, pick: departure);

      await _tapKey(tester, 'ic_publish_departure');
      await _tapKey(tester, 'ic_publish_seats_dec');
      await _tapKey(tester, 'ic_publish_class_comfort');
      await _tapKey(tester, 'ic_publish_submit');

      expect(repo.published.single, {
        'routeId': 'r-a-r',
        'departureAt': departure,
        'seatsTotal': 3,
        'tripClass': 'comfort',
      });
    });

    testWidgets("server kesishuv xatosi tushunarli ko'rsatiladi",
        (tester) async {
      repo.publishError = _coded('INTERCITY_TRIP_OVERLAP');
      await pumpPublish(tester, pick: _now.add(const Duration(hours: 4)));

      await _tapKey(tester, 'ic_publish_departure');
      await _tapKey(tester, 'ic_publish_submit');

      expect(find.textContaining('±3 soat'), findsOneWidget);
    });
  });

  group('qatnovlarim', () {
    testWidgets("kelgusi va o'tgan bo'limlar", (tester) async {
      repo.trips = [
        _trip(id: 'a'),
        _trip(
          id: 'b',
          status: 'completed',
          departureAt: _now.subtract(const Duration(days: 1)),
        ),
      ];
      await tester.pumpWidget(_app(DriverIntercityTripsScreen(
        repository: repo,
        now: () => _now,
      )));
      await _settle(tester);

      expect(find.text('Kelgusi'), findsOneWidget);
      expect(find.text("O'tgan"), findsOneWidget);
      expect(find.text('Ochiq'), findsOneWidget);
      expect(find.text('Yakunlangan'), findsOneWidget);
    });

    testWidgets("bekor qilish sababsiz o'tmaydi, sabab bilan yuboriladi",
        (tester) async {
      repo.trips = [_trip(id: 'a')];
      await tester.pumpWidget(_app(DriverIntercityTripsScreen(
        repository: repo,
        now: () => _now,
      )));
      await _settle(tester);

      await tester.tap(find.byKey(const ValueKey('ic_trip_cancel_a')));
      await _settle(tester);
      await tester.tap(find.byKey(const ValueKey('ic_trip_cancel_confirm')));
      await _settle(tester);
      expect(find.text('Sababni yozing'), findsOneWidget);
      expect(repo.cancelled, isEmpty);

      await tester.enterText(
          find.byKey(const ValueKey('ic_trip_cancel_reason')), 'Mashina buzildi');
      await tester.tap(find.byKey(const ValueKey('ic_trip_cancel_confirm')));
      await _settle(tester);

      expect(repo.cancelled, {'a': 'Mashina buzildi'});
      expect(find.text('Bekor qilingan'), findsOneWidget);
    });

    testWidgets("yo'ldagi qatnovda bekor qilish tugmasi yo'q", (tester) async {
      repo.trips = [_trip(id: 'run', status: 'in_progress')];
      await tester.pumpWidget(_app(DriverIntercityTripsScreen(
        repository: repo,
        now: () => _now,
      )));
      await _settle(tester);

      expect(find.byKey(const ValueKey('ic_trip_cancel_run')), findsNothing);
    });

    testWidgets('qatorni bosish qatnov ekranini ochadi', (tester) async {
      repo.trips = [_trip(id: 'a')];
      await tester.pumpWidget(_app(DriverIntercityTripsScreen(
        repository: repo,
        now: () => _now,
      )));
      await _settle(tester);

      await tester.tap(find.byKey(const ValueKey('ic_trip_open_a')));
      await _settle(tester);

      expect(find.byType(IntercityTripRunScreen), findsOneWidget);
    });
  });

  group('bosh ekran kartasi — yo\'ldagi qatnov', () {
    testWidgets("yig'ish boshlangan qatnov — to'g'ri qatnov ekraniga", (tester) async {
      repo.trips = [_trip(id: 'b', status: 'boarding')];
      await tester.pumpWidget(_app(Scaffold(
        body: IntercityDriverEntryCard(repository: repo, now: () => _now),
      )));
      await _settle(tester);

      await tester.tap(find.byKey(const ValueKey('ic_driver_entry')));
      await _settle(tester);

      expect(find.byType(IntercityTripRunScreen), findsOneWidget);
      expect(find.byType(DriverIntercityTripsScreen), findsNothing);
    });

    testWidgets("faqat kutilayotgan qatnov — ro'yxat ekraniga", (tester) async {
      repo.trips = [_trip(id: 'o')];
      await tester.pumpWidget(_app(Scaffold(
        body: IntercityDriverEntryCard(repository: repo, now: () => _now),
      )));
      await _settle(tester);

      await tester.tap(find.byKey(const ValueKey('ic_driver_entry')));
      await _settle(tester);

      expect(find.byType(DriverIntercityTripsScreen), findsOneWidget);
    });
  });
}
