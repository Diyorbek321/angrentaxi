// Shaharlararo — yo'lovchi oqimi (features/intercity), backend
// modules/intercity bilan bir xil JSON shaklida soxta repozitoriy orqali.
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_detail_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_search_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _angren = {
  'id': 'p-angren',
  'name': 'Angren',
  'centerLat': 41.0167,
  'centerLng': 70.1436,
  'radiusKm': 12,
};
const _rohat = {
  'id': 'p-rohat',
  'name': 'Rohat krugi',
  'centerLat': 41.3111,
  'centerLng': 69.2797,
  'radiusKm': 1.5,
};
const _olmaliq = {
  'id': 'p-olmaliq',
  'name': 'Olmaliq',
  'centerLat': 40.8447,
  'centerLng': 69.5986,
  'radiusKm': 10,
};

Map<String, dynamic> _route(String id, Map<String, dynamic> o,
        Map<String, dynamic> d) =>
    {
      'id': id,
      'origin': o,
      'destination': d,
      'seatPrice': 25000,
      'wholeCarPrice': 100000,
      'comfort': {'seatPrice': 30000, 'wholeCarPrice': 120000},
      'seatsDefault': 4,
    };

final _routes = [
  IntercityRoute.fromJson(_route('r-a-r', _angren, _rohat)),
  IntercityRoute.fromJson(_route('r-r-a', _rohat, _angren)),
  IntercityRoute.fromJson(_route('r-a-o', _angren, _olmaliq)),
];

IntercityTrip _trip({
  String id = 't1',
  int seatsLeft = 3,
  bool wholeCar = false,
  String tripClass = 'comfort',
  String status = 'open',
  String departureAt = '2026-10-18T02:00:00.000Z',
}) =>
    IntercityTrip.fromJson({
      'id': id,
      'route': const {
        'id': 'r-a-r',
        'origin': {'id': 'p-angren', 'name': 'Angren'},
        'destination': {'id': 'p-rohat', 'name': 'Rohat krugi'},
      },
      'tripClass': tripClass,
      'departureAt': departureAt,
      'status': status,
      'seatsTotal': 4,
      'seatsLeft': seatsLeft,
      'wholeCarAvailable': wholeCar,
      'seatPrice': 30000,
      'wholeCarPrice': 120000,
      'driver': const {
        'firstName': 'Botir',
        'rating': 4.9,
        'carModel': 'Cobalt',
        'plate': '10A123BC',
      },
      'cancelReason': null,
    });

IntercityBooking _booking({String status = 'scheduled', String tripStatus = 'open'}) =>
    IntercityBooking(
      orderId: 'o1',
      status: status,
      bookingKind: 'seat',
      seats: 2,
      price: 60000,
      pickupAddress: 'Angren, Navoiy 12',
      dropoffAddress: 'Rohat krugi',
      trip: _trip(status: tripStatus),
    );

DioException _coded(int status, String code) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: status,
        data: {'statusCode': status, 'code': code, 'message': code},
      ),
    );

class FakeIntercityRepository extends IntercityRepository {
  List<IntercityTrip> Function(String routeId, String date) onSearch =
      (_, __) => const [];
  final searches = <String>[];
  Object? bookError;
  IntercityTrip? freshTrip;
  final bookCalls = <Map<String, dynamic>>[];
  int cancelCalls = 0;

  @override
  Future<List<IntercityRoute>> routes() async => _routes;

  @override
  Future<List<IntercityTrip>> searchTrips({
    required String routeId,
    required String date,
    IntercityPlace? pickup,
    IntercityPlace? dropoff,
  }) async {
    searches.add('$routeId@$date');
    return onSearch(routeId, date);
  }

  @override
  Future<IntercityTrip> trip(String id) async => freshTrip ?? _trip(id: id);

  @override
  Future<IntercityBooking> book({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async {
    bookCalls.add({
      'kind': kind,
      'seats': seats,
      'pickup': pickup.address,
      'dropoff': dropoff.address,
    });
    if (bookError != null) throw bookError!;
    return _booking();
  }

  @override
  Future<List<IntercityBooking>> myBookings() async => [_booking()];

  @override
  Future<IntercityBooking> cancelBooking(String orderId) async {
    cancelCalls++;
    return _booking(status: 'cancelled');
  }
}

Future<OrderLocation?> Function(BuildContext, {required String title, required IntercityPoint area})
    _pickerReturning(OrderLocation location) =>
        (context, {required title, required area}) async => location;

const _insideAngren =
    OrderLocation(address: 'Angren, Navoiy 12', lat: 41.02, lng: 70.14);
const _farAway =
    OrderLocation(address: 'Samarqand', lat: 39.65, lng: 66.97);

void main() {
  late FakeIntercityRepository repo;
  // 2026-10-17 22:00 UTC = Toshkentda 18-oktyabr 03:00.
  DateTime now() => DateTime.utc(2026, 10, 17, 22);

  setUp(() => repo = FakeIntercityRepository());

  group('Qidiruv', () {
    testWidgets("qatnov kartasi: Toshkent vaqti, klass, joy va narx",
        (tester) async {
      repo.onSearch = (_, __) => [_trip(wholeCar: true)];
      await tester.pumpWidget(MaterialApp(
        home: IntercitySearchScreen(repository: repo, now: now),
      ));
      await tester.pumpAndSettle();

      expect(find.text('07:00'), findsOneWidget);
      expect(find.text('Comfort'), findsOneWidget);
      expect(find.text("3 ta joy bo'sh"), findsOneWidget);
      expect(find.text('Botir'), findsOneWidget);
      expect(find.text('Cobalt · 10A123BC'), findsOneWidget);
      expect(find.text('1 joy — ${Formatters.formatPrice(30000)}'),
          findsOneWidget);
      expect(
          find.text('Butun mashina — ${Formatters.formatPrice(120000)}'),
          findsOneWidget);
      // Birinchi so'rov — bugungi Toshkent kuni (UTC bo'yicha hali 17-si).
      expect(repo.searches.first, 'r-a-r@2026-10-18');
    });

    testWidgets("qatnov bo'lmasa bo'sh holat va maslahat", (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercitySearchScreen(repository: repo, now: now),
      ));
      await tester.pumpAndSettle();

      expect(find.text("Bu kunga qatnov yo'q"), findsOneWidget);
      expect(find.text("Boshqa kunni tanlang yoki so'rov qoldiring"), findsOneWidget);
      // Qatnov yo'q — so'rov qoldirish taklifi.
      expect(find.byKey(const ValueKey('ic_request_cta')), findsOneWidget);
    });

    testWidgets("almashtirish teskari yo'nalishni, kun chipi sanani so'raydi",
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercitySearchScreen(repository: repo, now: now),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip("Yo'nalishni almashtirish"));
      await tester.pumpAndSettle();
      expect(repo.searches.last, 'r-r-a@2026-10-18');

      await tester.tap(find.text('Ertaga'));
      await tester.pumpAndSettle();
      expect(repo.searches.last, 'r-r-a@2026-10-19');
    });

    testWidgets("Olmaliqdan teskari yo'nalish yo'q — almashtirish o'chiq",
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercitySearchScreen(repository: repo, now: now),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Olmaliq'));
      await tester.pumpAndSettle();
      expect(repo.searches.last, 'r-a-o@2026-10-18');

      final swap = tester.widget<IconButton>(
        find.ancestor(
          of: find.byIcon(Icons.swap_vert_rounded),
          matching: find.byType(IconButton),
        ),
      );
      expect(swap.onPressed, isNull);
    });
  });

  group('Band qilish', () {
    Future<void> pumpBooking(
      WidgetTester tester, {
      IntercityTrip? trip,
      OrderLocation pickup = _insideAngren,
      int maxSeats = 4,
    }) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercityBookingScreen(
          trip: trip ?? _trip(),
          route: _routes.first,
          settings: IntercityPublicSettings(
            enabled: true,
            maxSeatsPerBooking: maxSeats,
          ),
          repository: repo,
          pickLocation: _pickerReturning(pickup),
        ),
      ));
      await tester.pumpAndSettle();
    }

    Future<void> choosePickup(WidgetTester tester) async {
      await tester.tap(find.text('Olib ketish manzili'));
      await tester.pumpAndSettle();
    }

    testWidgets("joy band bo'lsa butun mashina tanlab bo'lmaydi",
        (tester) async {
      await pumpBooking(tester, trip: _trip(wholeCar: false));

      final chip = tester.widget<ChoiceChip>(
          find.byKey(const ValueKey('intercity_whole_car_chip')));
      expect(chip.onSelected, isNull);
      expect(find.text('Butun mashina: joylar allaqachon band'),
          findsOneWidget);
    });

    testWidgets("joylar soni min(bo'sh joy, sozlama) bilan cheklanadi",
        (tester) async {
      await pumpBooking(tester, trip: _trip(seatsLeft: 3), maxSeats: 2);

      await tester.tap(find.byTooltip("Joyni ko'paytirish"));
      await tester.pump();
      await tester.tap(find.byTooltip("Joyni ko'paytirish"));
      await tester.pump();

      expect(
        tester.widget<Text>(find.byKey(const ValueKey('intercity_seat_count'))).data,
        '2',
      );
      expect(
        tester.widget<Text>(find.byKey(const ValueKey('intercity_total'))).data,
        Formatters.formatPrice(60000),
      );
    });

    testWidgets("Rohat krugi — tushish joyi qat'iy, olib ketish hududdan "
        "tashqarida bo'lsa band qilinmaydi", (tester) async {
      await pumpBooking(tester, pickup: _farAway);

      expect(
        find.textContaining("qat'iy to'xtash joyi"),
        findsOneWidget,
      );
      await choosePickup(tester);
      expect(find.text('Manzil Angren hududidan tashqarida'), findsOneWidget);

      await tester.tap(find.text('Band qilish'));
      await tester.pump();
      expect(repo.bookCalls, isEmpty);
    });

    testWidgets("to'g'ri manzil bilan band qilinadi, tushish — nuqta markazi",
        (tester) async {
      await pumpBooking(tester);
      await choosePickup(tester);

      await tester.tap(find.text('Band qilish'));
      await tester.pumpAndSettle();

      expect(repo.bookCalls.single, {
        'kind': 'seat',
        'seats': 1,
        'pickup': 'Angren, Navoiy 12',
        'dropoff': 'Rohat krugi',
      });
    });

    testWidgets("409 — qatnov yangilanadi, tanlov moslashadi, xabar chiqadi",
        (tester) async {
      repo.bookError = _coded(409, 'INTERCITY_SEATS_UNAVAILABLE');
      repo.freshTrip = _trip(seatsLeft: 1);
      await pumpBooking(tester, trip: _trip(seatsLeft: 3));
      await choosePickup(tester);
      await tester.tap(find.byTooltip("Joyni ko'paytirish"));
      await tester.pump();

      await tester.tap(find.text('Band qilish'));
      await tester.pumpAndSettle();

      expect(
        find.text("Afsus, bu joylar band bo'lib qoldi. Ma'lumot yangilandi."),
        findsOneWidget,
      );
      expect(
        tester.widget<Text>(find.byKey(const ValueKey('intercity_seat_count'))).data,
        '1',
      );
    });
  });

  group('Bandni bekor qilish', () {
    Future<void> pumpDetail(WidgetTester tester, DateTime Function() clock) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercityBookingDetailScreen(
          booking: _booking(),
          settings: const IntercityPublicSettings(
            enabled: true,
            freeCancelMinutes: 60,
          ),
          repository: repo,
          now: clock,
        ),
      ));
      await tester.pump();
    }

    testWidgets("bepul muddat ichida — vaqt ko'rsatiladi, bekor qilinadi",
        (tester) async {
      await pumpDetail(tester, now);

      // Jo'nash 07:00 (Toshkent), bepul bekor qilish 06:00 gacha.
      expect(find.text('18.10 · 06:00 gacha bepul bekor qilish mumkin'),
          findsOneWidget);

      await tester.ensureVisible(find.text('Bandni bekor qilish'));
      await tester.tap(find.text('Bandni bekor qilish'));
      await tester.pumpAndSettle();
      expect(find.text('Bandni bekor qilasizmi?'), findsOneWidget);

      await tester.tap(find.text('Ha, bekor qilish'));
      await tester.pumpAndSettle();

      expect(repo.cancelCalls, 1);
      expect(find.text('Band bekor qilindi'), findsOneWidget);
      expect(find.text('Bandni bekor qilish'), findsNothing);
    });

    testWidgets("bepul muddat o'tgan — ogohlantirish ko'rsatiladi",
        (tester) async {
      // Jo'nashdan 30 daqiqa oldin.
      await pumpDetail(tester, () => DateTime.utc(2026, 10, 18, 1, 30));

      expect(find.textContaining("Bepul bekor qilish muddati o'tgan"),
          findsOneWidget);
    });

    testWidgets("yig'ish boshlangan bandda bekor qilish tugmasi yo'q",
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercityBookingDetailScreen(
          booking: _booking(status: 'accepted', tripStatus: 'boarding'),
          repository: repo,
          now: now,
        ),
      ));
      await tester.pump();

      expect(find.text('Bandni bekor qilish'), findsNothing);
    });
  });
}
