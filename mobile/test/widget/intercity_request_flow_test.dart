// Yo'lovchi so'rovlari doskasi (10-qadam): yo'lovchi so'rov qoldiradi va
// narxini oshiradi, haydovchi doskadan qabul qiladi. Soxta repozitoriy
// backend `intercity-request-view.ts` bilan bir xil JSON shaklida.
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';
import 'package:angren_taxi/features/intercity/screens/driver_intercity_trips_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_request_board_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_request_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_requests_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// 09:00 UTC = Toshkentda 14:00.
final _now = DateTime.utc(2026, 10, 18, 9);
DateTime _clock() => _now;

const _angren = {'id': 'p-a', 'name': 'Angren', 'centerLat': 41.0167, 'centerLng': 70.1436, 'radiusKm': 12};
const _rohat = {'id': 'p-r', 'name': 'Rohat krugi', 'centerLat': 41.3111, 'centerLng': 69.2797, 'radiusKm': 1.5};

final _route = IntercityRoute.fromJson(const {
  'id': 'r-a-r',
  'origin': _angren,
  'destination': _rohat,
  'seatPrice': 25000,
  'wholeCarPrice': 100000,
  'comfort': null,
  'seatsDefault': 4,
});

const _settings = IntercityPublicSettings(enabled: true);

const _insideAngren = OrderLocation(address: 'Angren, Navoiy 12', lat: 41.02, lng: 70.14);

IntercityRequest _request({
  String id = 'q1',
  String status = 'open',
  num bonus = 0,
  DateTime? start,
  DateTime? end,
}) =>
    IntercityRequest.fromJson({
      'id': id,
      'status': status,
      'routeId': 'r-a-r',
      'originName': 'Angren',
      'destinationName': 'Rohat krugi',
      'tripClass': 'start',
      'kind': 'seat',
      'seats': 2,
      'pickup': const {'lat': 41.02, 'lng': 70.14, 'address': 'Angren, Navoiy 12'},
      'dropoff': const {'lat': 41.3111, 'lng': 69.2797, 'address': 'Rohat krugi'},
      'windowStart': (start ?? _now.add(const Duration(hours: 1))).toIso8601String(),
      'windowEnd': (end ?? _now.add(const Duration(hours: 3))).toIso8601String(),
      'basePrice': 50000,
      'extensions': const [],
      'bonus': bonus,
      'total': 50000 + bonus,
      'maxBonus': 50000,
      'bonusStep': 1000,
      'tripId': status == 'accepted' ? 't1' : null,
      'orderId': status == 'accepted' ? 'o1' : null,
    });

IntercityTrip _trip({String id = 't1', required DateTime departureAt, int seatsLeft = 3}) => IntercityTrip.fromJson({
      'id': id,
      'route': const {
        'id': 'r-a-r',
        'origin': {'id': 'p-a', 'name': 'Angren'},
        'destination': {'id': 'p-r', 'name': 'Rohat krugi'},
      },
      'tripClass': 'start',
      'departureAt': departureAt.toIso8601String(),
      'status': 'open',
      'seatsTotal': 4,
      'seatsLeft': seatsLeft,
      'wholeCarAvailable': false,
      'seatPrice': 25000,
      'wholeCarPrice': 100000,
    });

DioException _coded(int status, String code) => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: status,
        data: {'statusCode': status, 'code': code, 'message': code},
      ),
    );

class FakeRequestRepository extends IntercityRepository {
  final quotes = <Map<String, Object?>>[];
  final created = <Map<String, Object?>>[];
  Object? createError;
  List<IntercityRequest> mine = [];
  final raised = <int>[];
  Object? raiseError;
  int cancelCalls = 0;
  int myRequestsCalls = 0;

  List<IntercityRequest> board = [];
  List<IntercityTrip> trips = [];
  final accepts = <Map<String, Object?>>[];
  Object? acceptError;
  int boardCalls = 0;

  @override
  Future<IntercityPublicSettings> publicSettings() async => _settings;

  @override
  Future<IntercityRequestQuote> requestQuote({
    required String routeId,
    required String tripClass,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
    required DateTime windowStart,
    required DateTime windowEnd,
    int bonus = 0,
  }) async {
    quotes.add({'seats': seats, 'kind': kind});
    final base = kind == IntercityBookingKind.wholeCar ? 100000.0 : 25000.0 * (seats ?? 1);
    return IntercityRequestQuote(seats: seats ?? 1, basePrice: base, bonus: 0, total: base, maxBonus: base);
  }

  @override
  Future<IntercityRequest> createRequest({
    required String routeId,
    required String tripClass,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
    required DateTime windowStart,
    required DateTime windowEnd,
    int bonus = 0,
  }) async {
    created.add({
      'routeId': routeId,
      'seats': seats,
      'pickup': pickup.address,
      'dropoff': dropoff.address,
      'windowStart': windowStart,
      'windowEnd': windowEnd,
      'bonus': bonus,
    });
    if (createError != null) throw createError!;
    return _request(bonus: bonus, start: windowStart, end: windowEnd);
  }

  @override
  Future<List<IntercityRequest>> myRequests() async {
    myRequestsCalls++;
    return mine;
  }

  @override
  Future<IntercityRequest> raiseRequestBonus(String id, int bonus) async {
    raised.add(bonus);
    if (raiseError != null) throw raiseError!;
    return _request(id: id, bonus: bonus);
  }

  @override
  Future<IntercityRequest> cancelRequest(String id) async {
    cancelCalls++;
    return _request(id: id, status: 'cancelled');
  }

  @override
  Future<List<IntercityRequest>> requestBoard({String? routeId}) async {
    boardCalls++;
    return board;
  }

  @override
  Future<List<IntercityTrip>> myTrips() async => trips;

  @override
  Future<IntercityRequestAcceptance> acceptRequest(String id, {String? tripId, DateTime? departureAt}) async {
    accepts.add({'id': id, 'tripId': tripId, 'departureAt': departureAt});
    if (acceptError != null) throw acceptError!;
    return IntercityRequestAcceptance(
      request: _request(id: id, status: 'accepted'),
      tripId: tripId ?? 't-new',
      orderId: 'o1',
      tripCreated: tripId == null,
    );
  }
}

Future<OrderLocation?> _picker(BuildContext context, {required String title, required IntercityPoint area}) async =>
    _insideAngren;

void main() {
  late FakeRequestRepository repo;
  setUp(() => repo = FakeRequestRepository());

  group("Yo'lovchi: so'rov qoldirish", () {
    /// Ekranni tugma orqali ochadi — `pop(request)` natijasini ushlash uchun.
    Future<List<Object?>> pumpRequest(WidgetTester tester) async {
      final results = <Object?>[];
      // Forma uzun: manzil kartalari standart 800×600 oynadan pastda qoladi.
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async => results.add(await Navigator.of(context).push<IntercityRequest>(
              MaterialPageRoute(
                builder: (_) => IntercityRequestScreen(
                  route: _route,
                  settings: _settings,
                  repository: repo,
                  pickLocation: _picker,
                  now: _clock,
                ),
              ),
            )),
            child: const Text('open'),
          ),
        ),
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      return results;
    }

    Future<void> choosePickup(WidgetTester tester) async {
      await tester.tap(find.byIcon(Icons.trip_origin_rounded));
      await tester.pumpAndSettle();
    }

    testWidgets("standart oraliq: eng yaqin yarim soat + 2 soat (Toshkent vaqti)", (tester) async {
      await pumpRequest(tester);
      expect(find.text('14:30'), findsOneWidget);
      expect(find.text('16:30'), findsOneWidget);
      // Olish manzili tanlanmagan — narx so'ralmaydi, yuborib bo'lmaydi.
      expect(repo.quotes, isEmpty);
      final submit = tester.widget<ElevatedButton>(
        find.descendant(of: find.byKey(const ValueKey('ic_req_submit')), matching: find.byType(ElevatedButton)),
      );
      expect(submit.onPressed, isNull);
    });

    testWidgets("narx serverdan, oshirish jamiga qo'shiladi va yuboriladi", (tester) async {
      final results = await pumpRequest(tester);
      await choosePickup(tester);
      expect(repo.quotes, isNotEmpty);
      expect(find.text(Formatters.formatPrice(25000)), findsOneWidget);

      await tester.tap(find.byTooltip("Joyni ko'paytirish"));
      await tester.pumpAndSettle();
      expect(repo.quotes.last['seats'], 2);
      expect(find.text(Formatters.formatPrice(50000)), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('ic_bonus_plus')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('ic_bonus_plus')));
      await tester.pumpAndSettle();
      expect(find.text(Formatters.formatPrice(52000)), findsOneWidget);
      // Oshirish tarmoqqa bormaydi (narx so'rovi takrorlanmaydi).
      final quotesBefore = repo.quotes.length;

      await tester.tap(find.byKey(const ValueKey('ic_req_submit')));
      await tester.pumpAndSettle();
      expect(repo.quotes.length, quotesBefore);
      final body = repo.created.single;
      expect(body['seats'], 2);
      expect(body['bonus'], 2000);
      expect(body['pickup'], 'Angren, Navoiy 12');
      expect(body['dropoff'], 'Rohat krugi');
      expect(body['windowStart'], DateTime.utc(2026, 10, 18, 9, 30));
      expect(body['windowEnd'], DateTime.utc(2026, 10, 18, 11, 30));
      expect(results.single, isA<IntercityRequest>());
    });

    testWidgets("ochiq so'rov allaqachon bor — so'rovlarim ekraniga o'tadi", (tester) async {
      repo.createError = _coded(409, 'INTERCITY_REQUEST_ALREADY_OPEN');
      repo.mine = [_request()];
      await pumpRequest(tester);
      await choosePickup(tester);
      await tester.tap(find.byKey(const ValueKey('ic_req_submit')));
      await tester.pumpAndSettle();

      expect(find.textContaining('allaqachon ochiq so\'rov bor'), findsOneWidget);
      expect(find.text("Mening so'rovlarim"), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_req_tile_q1')), findsOneWidget);
    });
  });

  group("Yo'lovchi: mening so'rovlarim", () {
    Future<void> pumpMine(WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercityRequestsScreen(settings: _settings, repository: repo, now: _clock),
      ));
      await tester.pumpAndSettle();
    }

    testWidgets("ochiq so'rov: holat, oraliq, narx; qabul qilingani — bandga havola", (tester) async {
      repo.mine = [_request(bonus: 3000), _request(id: 'q2', status: 'accepted')];
      await pumpMine(tester);

      expect(find.text('Haydovchi kutilmoqda'), findsOneWidget);
      expect(find.textContaining('18.10 · 15:00–17:00'), findsNWidgets(2));
      expect(find.text(Formatters.formatPrice(53000)), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_req_raise_q1')), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_req_raise_q2')), findsNothing);
      expect(find.text("Bandni ko'rish"), findsOneWidget);
    });

    testWidgets("narxni oshirish: kamida bir qadam, yangi jami yuboriladi", (tester) async {
      repo.mine = [_request(bonus: 3000)];
      await pumpMine(tester);

      await tester.tap(find.byKey(const ValueKey('ic_req_raise_q1')));
      await tester.pumpAndSettle();
      // Joriy 3 000 — pastki chegara 4 000, kamaytirib bo'lmaydi.
      expect(find.text(Formatters.formatPrice(54000)), findsOneWidget);
      final minus = tester.widget<IconButton>(find.byKey(const ValueKey('ic_bonus_minus')));
      expect(minus.onPressed, isNull);

      await tester.tap(find.byKey(const ValueKey('ic_bonus_plus')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('ic_req_raise_confirm')));
      await tester.pumpAndSettle();

      expect(repo.raised, [5000]);
      expect(find.text('Narx oshirildi'), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_req_tile_total_q1')), findsOneWidget);
      expect(find.text(Formatters.formatPrice(55000)), findsOneWidget);
    });

    testWidgets("oshirish paytida haydovchi olib bo'lgan — ro'yxat yangilanadi", (tester) async {
      repo.mine = [_request()];
      repo.raiseError = _coded(409, 'INTERCITY_REQUEST_CLOSED');
      await pumpMine(tester);
      repo.mine = [_request(status: 'accepted')];

      await tester.tap(find.byKey(const ValueKey('ic_req_raise_q1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('ic_req_raise_confirm')));
      await tester.pumpAndSettle();

      expect(find.textContaining('boshqa haydovchi oldi'), findsOneWidget);
      expect(repo.myRequestsCalls, 2);
      expect(find.text('Qabul qilindi'), findsOneWidget);
    });

    testWidgets("bekor qilish tasdiq bilan", (tester) async {
      repo.mine = [_request()];
      await pumpMine(tester);

      await tester.tap(find.byKey(const ValueKey('ic_req_cancel_q1')));
      await tester.pumpAndSettle();
      expect(repo.cancelCalls, 0);
      await tester.tap(find.byKey(const ValueKey('ic_req_cancel_confirm')));
      await tester.pumpAndSettle();

      expect(repo.cancelCalls, 1);
      expect(find.text('Bekor qilindi'), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_req_cancel_q1')), findsNothing);
    });
  });

  group('Haydovchi: so\'rovlar doskasi', () {
    Future<void> pumpBoard(WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(
        home: IntercityRequestBoardScreen(repository: repo, now: _clock),
      ));
      await tester.pumpAndSettle();
    }

    testWidgets("kartada yo'nalish, oraliq, manzillar va oshirilgan narx", (tester) async {
      repo.board = [_request(bonus: 5000)];
      await pumpBoard(tester);

      expect(find.text('Angren → Rohat krugi'), findsOneWidget);
      expect(find.text('18.10 · 15:00–17:00 · 2 joy'), findsOneWidget);
      expect(find.text('Angren, Navoiy 12'), findsOneWidget);
      expect(find.text(Formatters.formatPrice(55000)), findsOneWidget);
      expect(find.text("shundan qo'shimcha ${Formatters.formatPrice(5000)}"), findsOneWidget);
    });

    testWidgets("mos qatnov bor — o'sha qatnovga qo'shiladi", (tester) async {
      repo.board = [_request()];
      repo.trips = [
        _trip(departureAt: _now.add(const Duration(hours: 2))),
        _trip(id: 't-late', departureAt: _now.add(const Duration(hours: 6))),
      ];
      await pumpBoard(tester);

      await tester.tap(find.byKey(const ValueKey('ic_board_accept_q1')));
      await tester.pumpAndSettle();
      expect(find.text("Qaysi qatnovingizga qo'shilsin"), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_board_trip_t1')), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_board_trip_t-late')), findsNothing);

      await tester.tap(find.byKey(const ValueKey('ic_board_accept_confirm')));
      await tester.pumpAndSettle();
      expect(repo.accepts.single, {'id': 'q1', 'tripId': 't1', 'departureAt': null});
      expect(find.text("Yo'lovchi qatnovingizga qo'shildi"), findsOneWidget);
      expect(repo.boardCalls, 2);
    });

    testWidgets("mos qatnov yo'q — tanlangan vaqtga yangi qatnov", (tester) async {
      repo.board = [_request()];
      await pumpBoard(tester);

      await tester.tap(find.byKey(const ValueKey('ic_board_accept_q1')));
      await tester.pumpAndSettle();
      expect(find.text("Jo'nash vaqtini tanlang"), findsOneWidget);
      // 15:00 dan 17:00 gacha har 15 daqiqa.
      expect(find.text('15:00'), findsOneWidget);
      expect(find.text('17:00'), findsOneWidget);

      await tester.tap(find.text('15:30'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('ic_board_accept_confirm')));
      await tester.pumpAndSettle();

      expect(repo.accepts.single['departureAt'], DateTime.utc(2026, 10, 18, 10, 30));
      expect(repo.accepts.single['tripId'], isNull);
      expect(find.text("Yangi qatnov ochildi, yo'lovchi qo'shildi"), findsOneWidget);
    });

    testWidgets("mos qatnovda joy yetmaydi — yangi vaqt taklif qilinmaydi", (tester) async {
      repo.board = [_request()];
      repo.trips = [_trip(departureAt: _now.add(const Duration(hours: 2)), seatsLeft: 1)];
      await pumpBoard(tester);

      await tester.tap(find.byKey(const ValueKey('ic_board_accept_q1')));
      await tester.pumpAndSettle();
      expect(find.text('Joy yetmaydi'), findsOneWidget);
      expect(find.byKey(const ValueKey('ic_board_no_room')), findsOneWidget);
      expect(find.text("Jo'nash vaqtini tanlang"), findsNothing);
      final confirm = tester.widget<ElevatedButton>(
        find.descendant(of: find.byKey(const ValueKey('ic_board_accept_confirm')), matching: find.byType(ElevatedButton)),
      );
      expect(confirm.onPressed, isNull);
    });

    testWidgets("boshqa qatnov bilan to'qnashadigan vaqtlar yashiriladi", (tester) async {
      repo.board = [_request()];
      // Boshqa yo'nalishdagi qatnov 12:00 UTC (17:00) — oraliq butunlay ±3 soat ichida.
      repo.trips = [
        IntercityTrip.fromJson({
          'id': 't-other',
          'route': const {'id': 'r-x', 'origin': {'name': 'Olmaliq'}, 'destination': {'name': 'Angren'}},
          'tripClass': 'start',
          'departureAt': _now.add(const Duration(hours: 3)).toIso8601String(),
          'status': 'open',
          'seatsTotal': 4,
          'seatsLeft': 4,
          'wholeCarAvailable': true,
          'seatPrice': 15000,
          'wholeCarPrice': 60000,
        }),
      ];
      await pumpBoard(tester);

      await tester.tap(find.byKey(const ValueKey('ic_board_accept_q1')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('ic_board_no_slots')), findsOneWidget);
      expect(find.textContaining("to'qnashadi"), findsOneWidget);
    });

    testWidgets("boshqa haydovchi ulgurdi — xabar va doska yangilanadi", (tester) async {
      repo.board = [_request()];
      repo.acceptError = _coded(409, 'INTERCITY_REQUEST_CLOSED');
      await pumpBoard(tester);
      repo.board = [];

      await tester.tap(find.byKey(const ValueKey('ic_board_accept_q1')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('ic_board_accept_confirm')));
      await tester.pumpAndSettle();

      expect(find.textContaining('boshqa haydovchi oldi'), findsOneWidget);
      expect(find.text("Hozircha ochiq so'rov yo'q"), findsOneWidget);
    });

    testWidgets("qatnovlarim ekranidan doskaga o'tish", (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: DriverIntercityTripsScreen(repository: repo, settings: _settings, now: _clock),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('ic_trips_requests')));
      await tester.pumpAndSettle();
      expect(find.text("Yo'lovchi so'rovlari"), findsOneWidget);
      expect(repo.boardCalls, 1);
    });
  });
}
