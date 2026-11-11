// Shaharlararo — tumanlar, aylanma va haydovchi bekatlar rejasi (backend 039).
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_publish_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_search_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_trip_run_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

final _now = DateTime.utc(2026, 10, 17, 5);

const _angren = {'id': 'p-angren', 'name': 'Angren', 'centerLat': 40.0956, 'centerLng': 70.9432, 'radiusKm': 12};
const _rohat = {
  'id': 'p-rohat',
  'name': 'Rohat krugi',
  'centerLat': 41.268028,
  'centerLng': 69.366806,
  'radiusKm': 1.5,
  'extension': {'maxKm': 30, 'pricePerKm': 2000, 'comfortPricePerKm': 2500},
  'zones': [
    {'id': 'z-yun', 'name': 'Yunusobod', 'centerLat': 41.365, 'centerLng': 69.288, 'radiusKm': 4},
    {'id': 'z-chi', 'name': 'Chilonzor', 'centerLat': 41.275, 'centerLng': 69.204, 'radiusKm': 4},
  ],
};

final _route = IntercityRoute.fromJson({
  'id': 'r-a-r',
  'origin': _angren,
  'destination': _rohat,
  'seatPrice': 25000,
  'wholeCarPrice': 100000,
  'comfort': null,
  'seatsDefault': 4,
});

IntercityTrip _trip(String id, {Map<String, dynamic>? fit, List<Map<String, String>> zones = const []}) =>
    IntercityTrip.fromJson({
      'id': id,
      'route': const {
        'id': 'r-a-r',
        'origin': {'id': 'p-angren', 'name': 'Angren'},
        'destination': {'id': 'p-rohat', 'name': 'Rohat krugi'},
      },
      'tripClass': 'start',
      'departureAt': _now.add(const Duration(hours: 3)).toIso8601String(),
      'status': 'open',
      'seatsTotal': 4,
      'seatsLeft': 3,
      'wholeCarAvailable': false,
      'seatPrice': 25000,
      'wholeCarPrice': 100000,
      'driver': {'firstName': 'Botir$id', 'rating': 4.9},
      'zones': {'origin': [], 'destination': zones},
      'fit': fit,
    });

DioException _coded(String code, Map<String, dynamic> details) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: 409,
        data: {'statusCode': 409, 'code': code, 'message': code, 'details': details},
      ),
    );

class _Repo extends IntercityRepository {
  final searches = <Map<String, Object?>>[];
  List<IntercityTrip> trips = const [];
  IntercityQuote? quoteResult;
  Object? bookError;
  final published = <Map<String, Object?>>[];
  IntercityRoutePlan? plan;
  List<IntercityDriverBooking> driverBookings = const [];
  IntercityTrip? current;

  @override
  Future<List<IntercityRoute>> routes() async => [_route];

  @override
  Future<List<IntercityTrip>> searchTrips({
    required String routeId,
    required String date,
    IntercityPlace? pickup,
    IntercityPlace? dropoff,
  }) async {
    searches.add({'pickup': pickup?.address, 'dropoff': dropoff?.address, 'dropoffLat': dropoff?.lat});
    return trips;
  }

  @override
  Future<IntercityQuote> quote({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async =>
      quoteResult!;

  @override
  Future<IntercityBooking> book({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async =>
      throw bookError!;

  @override
  Future<IntercityTrip> publishTrip({
    required String routeId,
    required DateTime departureAt,
    int? seatsTotal,
    required String tripClass,
    List<String> originDistrictIds = const [],
    List<String> destinationDistrictIds = const [],
  }) async {
    published.add({'origin': originDistrictIds, 'destination': destinationDistrictIds});
    return _trip('new');
  }

  @override
  Future<IntercityTrip> trip(String id) async => current ?? _trip(id);

  @override
  Future<List<IntercityDriverBooking>> tripBookings(String tripId) async => driverBookings;

  @override
  Future<IntercityRoutePlan> routePlan(String tripId, {double? fromLat, double? fromLng}) async =>
      plan ?? (throw StateError('no plan'));
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

const _yunusobodHome = OrderLocation(address: 'Yunusobod 4-kvartal', lat: 41.366, lng: 69.289);
const _angrenHome = OrderLocation(address: 'Angren, Navoiy 12', lat: 40.1, lng: 70.95);

IntercityLocationPicker _picker(OrderLocation location) =>
    (context, {required title, required area}) async => location;

void _tallView(WidgetTester tester) {
  tester.view.physicalSize = const Size(420, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  late _Repo repo;
  setUp(() => repo = _Repo());

  group('qidiruv — manzil bilan moslik', () {
    testWidgets("manzil tanlansa qidiruvga yuboriladi va qatnovlar belgilanadi", (tester) async {
      _tallView(tester);
      repo.trips = [
        _trip('1', fit: {'fit': 'ok', 'addedMinutes': 0, 'detourChecked': true, 'zoneNames': []}, zones: const [
          {'id': 'z-yun', 'name': 'Yunusobod'},
        ]),
        _trip('2', fit: {'fit': 'out_of_zone', 'detourChecked': true, 'zoneNames': ['Chilonzor']}),
        _trip('3', fit: {'fit': 'detour', 'addedMinutes': 24, 'detourChecked': true, 'zoneNames': []}),
      ];
      await tester.pumpWidget(MaterialApp(
        home: IntercitySearchScreen(repository: repo, now: () => _now, pickLocation: _picker(_yunusobodHome)),
      ));
      await _settle(tester);

      // Manzilsiz birinchi qidiruv.
      expect(repo.searches.first['dropoff'], isNull);
      await tester.tap(find.byKey(const ValueKey('intercity_address_filter')));
      await _settle(tester);

      expect(repo.searches.last['dropoff'], 'Yunusobod 4-kvartal');
      expect(find.text('Yunusobod 4-kvartal'), findsOneWidget);
      expect(find.text('Sizning tomonga'), findsOneWidget);
      expect(find.text('Boshqa tumanga'), findsOneWidget);
      expect(find.text('+24 daq aylanma'), findsOneWidget);
      expect(find.text('Tumanlar: Yunusobod'), findsOneWidget);
      // Mos bo'lmaganlari xiralashgan.
      final faded = tester.widgetList<Opacity>(find.byType(Opacity)).where((o) => o.opacity < 1);
      expect(faded.length, 2);

      // Manzilni tozalash — qayta qidiruv manzilsiz.
      await tester.tap(find.byTooltip('Manzilni tozalash'));
      await _settle(tester);
      expect(repo.searches.last['dropoff'], isNull);
    });
  });

  group("band — tuman va aylanma ogohlantirishi", () {
    testWidgets("quote: boshqa tuman — ogohlantirish, tasdiqlash o'chiq", (tester) async {
      _tallView(tester);
      repo.quoteResult = IntercityQuote.fromJson({
        'basePrice': 25000,
        'extensions': [
          {'side': 'dropoff', 'pointName': 'Rohat krugi', 'km': 12.4, 'pricePerKm': 2000, 'fare': 25000},
        ],
        'total': 50000,
        'zoneOk': false,
        'outOfZone': {'side': 'destination', 'zoneNames': ['Chilonzor']},
        'detourChecked': true,
        'detourTooLong': false,
        'maxDetourMinutes': 15,
      });
      await tester.pumpWidget(MaterialApp(
        home: IntercityBookingScreen(
          trip: _trip('1'),
          route: _route,
          repository: repo,
          settings: const IntercityPublicSettings(enabled: true),
          initialPickup: _angrenHome,
          initialDropoff: _yunusobodHome,
        ),
      ));
      await _settle(tester);

      expect(find.byKey(const ValueKey('intercity_fit_warning')), findsOneWidget);
      expect(find.textContaining('Chilonzor'), findsOneWidget);
      final confirm = tester.widget<ElevatedButton>(
        find.descendant(of: find.byType(Scaffold), matching: find.byType(ElevatedButton)).last,
      );
      expect(confirm.onPressed, isNull);
    });

    testWidgets("band: server aylanma sabab rad etsa — tushunarli xabar", (tester) async {
      _tallView(tester);
      repo.quoteResult = IntercityQuote.fromJson({
        'basePrice': 25000,
        'extensions': [],
        'total': 25000,
        'zoneOk': true,
        'detourMinutes': 5,
        'detourTooLong': false,
        'maxDetourMinutes': 15,
      });
      repo.bookError = _coded('INTERCITY_DETOUR_TOO_LONG', {'addedMinutes': 22, 'limit': 15});
      await tester.pumpWidget(MaterialApp(
        home: IntercityBookingScreen(
          trip: _trip('1'),
          route: _route,
          repository: repo,
          settings: const IntercityPublicSettings(enabled: true),
          initialPickup: _angrenHome,
          initialDropoff: _yunusobodHome,
        ),
      ));
      await _settle(tester);
      expect(find.byKey(const ValueKey('intercity_fit_warning')), findsNothing);

      await tester.tap(find.text('Band qilish'));
      await _settle(tester);
      expect(find.textContaining('+22 daq'), findsOneWidget);
    });
  });

  group("haydovchi e'loni — tumanlar", () {
    testWidgets("standart «Hamma tumanlar»; tanlangan tuman yuboriladi", (tester) async {
      _tallView(tester);
      await tester.pumpWidget(MaterialApp(
        home: IntercityPublishScreen(
          repository: repo,
          settings: const IntercityPublicSettings(enabled: true),
          now: () => _now,
          pickDeparture: (_, __) async => _now.add(const Duration(hours: 3)),
        ),
      ));
      await _settle(tester);

      // Angrenda davom/tuman yo'q — faqat tushirish tomoni chiziladi.
      expect(find.byKey(const ValueKey('ic_publish_origin_all')), findsNothing);
      final all = tester.widget<FilterChip>(find.byKey(const ValueKey('ic_publish_destination_all')));
      expect(all.selected, isTrue);

      await tester.tap(find.byKey(const ValueKey('ic_publish_destination_z-yun')));
      await tester.pump();
      expect(tester.widget<FilterChip>(find.byKey(const ValueKey('ic_publish_destination_all'))).selected, isFalse);

      await tester.tap(find.byKey(const ValueKey('ic_publish_departure')));
      await _settle(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('ic_publish_submit')));
      await tester.tap(find.byKey(const ValueKey('ic_publish_submit')));
      await _settle(tester);

      expect(repo.published.single, {'origin': <String>[], 'destination': ['z-yun']});
    });
  });

  group('haydovchi — bekatlar rejasi', () {
    IntercityDriverBooking b(String id) => IntercityDriverBooking(
          orderId: id,
          status: 'in_progress',
          seats: 1,
          bookingKind: 'seat',
          price: 25000,
          passengerName: 'Yo‘lovchi $id',
          dropoffAddress: 'Manzil $id',
          dropoffLat: 41.3,
          dropoffLng: 69.3,
        );

    testWidgets("kartalar reja tartibida, raqam va vaqt bilan; navigatsiya keyingi bekatda", (tester) async {
      _tallView(tester);
      repo
        ..current = IntercityTrip.fromJson({
          'id': 't1',
          'route': const {
            'id': 'r-a-r',
            'origin': {'name': 'Angren'},
            'destination': {'name': 'Rohat krugi'},
          },
          'tripClass': 'start',
          'departureAt': _now.toIso8601String(),
          'status': 'in_progress',
          'seatsTotal': 4,
          'seatsLeft': 1,
          'seatPrice': 25000,
          'wholeCarPrice': 100000,
        })
        ..driverBookings = [b('a'), b('b'), b('c')]
        ..plan = const IntercityRoutePlan(
          phase: 'dropoff',
          pointName: 'Rohat krugi',
          totalMinutes: 27,
          stops: [
            IntercityRouteStop(sequence: 1, orderId: 'c', kind: 'dropoff', lat: 41.33, lng: 69.33, etaMinutesFromPrev: 9),
            IntercityRouteStop(sequence: 2, orderId: 'a', kind: 'dropoff', lat: 41.36, lng: 69.29, etaMinutesFromPrev: 7),
            IntercityRouteStop(sequence: 3, orderId: 'b', kind: 'dropoff', lat: 41.37, lng: 69.25, etaMinutesFromPrev: 11),
          ],
        );
      final navigated = <String>[];
      await tester.pumpWidget(MaterialApp(
        home: IntercityTripRunScreen(
          trip: repo.current!,
          repository: repo,
          locate: () async => null,
          now: () => _now,
          subscribeRealtime: false,
          navigate: (_, lat, lng) async => navigated.add('$lat,$lng'),
        ),
      ));
      await _settle(tester);

      double top(String id) => tester.getTopLeft(find.byKey(ValueKey('ic_run_passenger_$id'))).dy;
      expect(top('c') < top('a') && top('a') < top('b'), isTrue);
      expect(find.text('~9 daq'), findsOneWidget);
      expect(find.text("Eng qisqa yo'l tartibi · jami ~27 daq"), findsOneWidget);

      // Navigatsiya faqat keyingi bekatda (c).
      expect(find.byKey(const ValueKey('ic_run_navigate_c')), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_run_navigate_a')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('ic_run_navigate_c')));
      await tester.pump();
      expect(navigated, ['41.33,69.33']);
    });

    testWidgets("reja yuklanmasa — eng yaqindan tartib, raqamsiz", (tester) async {
      _tallView(tester);
      repo
        ..current = IntercityTrip.fromJson({
          'id': 't1',
          'departureAt': _now.toIso8601String(),
          'status': 'in_progress',
          'seatsTotal': 4,
          'seatsLeft': 2,
          'seatPrice': 1,
          'wholeCarPrice': 1,
        })
        ..driverBookings = [b('a'), b('b')];
      await tester.pumpWidget(MaterialApp(
        home: IntercityTripRunScreen(
          trip: repo.current!,
          repository: repo,
          locate: () async => null,
          now: () => _now,
          subscribeRealtime: false,
        ),
      ));
      await _settle(tester);
      expect(find.byKey(const ValueKey('ic_run_passenger_a')), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_run_plan_line')), findsNothing);
      expect(find.byKey(const ValueKey('ic_run_navigate_a')), findsNothing);
    });
  });
}
