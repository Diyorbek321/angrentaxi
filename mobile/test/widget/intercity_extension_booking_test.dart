// Shaharlararo — "shahar ichiga davom" bilan band qilish ekrani:
// Rohat krugida tushish (standart) yoki manzilgacha km haqi bilan.
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_detail_screen.dart';
import 'package:angren_taxi/features/intercity/screens/intercity_booking_screen.dart';
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
// Egasi bergan koordinata; 30 km gacha davom, Start 2 000 / Comfort 2 500.
const _rohat = {
  'id': 'p-rohat',
  'name': 'Rohat krugi',
  'centerLat': 41.268028,
  'centerLng': 69.366806,
  'radiusKm': 1.5,
  'extension': {'maxKm': 30, 'pricePerKm': 2000, 'comfortPricePerKm': 2500},
};

final _route = IntercityRoute.fromJson(const {
  'id': 'r-a-r',
  'origin': _angren,
  'destination': _rohat,
  'seatPrice': 25000,
  'wholeCarPrice': 100000,
  'comfort': null,
  'seatsDefault': 4,
});

final _trip = IntercityTrip.fromJson(const {
  'id': 't1',
  'route': {
    'id': 'r-a-r',
    'origin': {'id': 'p-angren', 'name': 'Angren'},
    'destination': {'id': 'p-rohat', 'name': 'Rohat krugi'},
  },
  'tripClass': 'start',
  'departureAt': '2026-10-18T02:00:00.000Z',
  'status': 'open',
  'seatsTotal': 4,
  'seatsLeft': 4,
  'wholeCarAvailable': true,
  'seatPrice': 25000,
  'wholeCarPrice': 100000,
  'driver': {'firstName': 'Botir', 'rating': 4.9},
});

const _angrenHome =
    OrderLocation(address: 'Angren, Navoiy 12', lat: 41.02, lng: 70.14);
// Rohatdan ~10 km — davom hududida.
const _tashkentHome =
    OrderLocation(address: 'Toshkent, Chilonzor 5', lat: 41.358, lng: 69.3668);
// Rohatdan ~44 km — davom chegarasidan tashqarida.
const _tooFar = OrderLocation(address: 'Uzoq qishloq', lat: 41.668, lng: 69.3668);

const _extensionLine = IntercityExtensionCharge(
  side: 'dropoff',
  pointName: 'Rohat krugi',
  km: 12.4,
  pricePerKm: 2000,
  fare: 25000,
);

class _FakeRepo extends IntercityRepository {
  final quoteCalls = <String>[];
  final bookCalls = <Map<String, Object?>>[];
  Object? quoteError;

  @override
  Future<IntercityQuote> quote({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async {
    quoteCalls.add('$kind:${seats ?? 1}:${dropoff.address}');
    if (quoteError != null) throw quoteError!;
    final base = kind == IntercityBookingKind.wholeCar ? 100000.0 : 25000.0 * (seats ?? 1);
    return IntercityQuote(basePrice: base, extensions: const [_extensionLine], total: base + 25000);
  }

  @override
  Future<IntercityBooking> book({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async {
    bookCalls.add({'pickup': pickup.address, 'dropoff': dropoff.address, 'dropoffLat': dropoff.lat});
    return const IntercityBooking(orderId: 'o1', status: 'scheduled', price: 50000);
  }
}

DioException _serverError() => DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.badResponse,
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: '/x'),
        statusCode: 500,
        data: const {'statusCode': 500, 'message': 'boom'},
      ),
    );

void main() {
  late _FakeRepo repo;
  late OrderLocation dropoffChoice;

  setUp(() {
    repo = _FakeRepo();
    dropoffChoice = _tashkentHome;
  });

  Future<void> pump(WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(
      home: IntercityBookingScreen(
        trip: _trip,
        route: _route,
        settings: const IntercityPublicSettings(enabled: true, maxSeatsPerBooking: 4),
        repository: repo,
        // Olib ketish — Angren, tushish — testda tanlangan manzil.
        pickLocation: (context, {required title, required area}) async =>
            area.id == 'p-angren' ? _angrenHome : dropoffChoice,
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Olib ketish manzili'));
    await tester.pumpAndSettle();
  }

  Future<void> chooseHomeDropoff(WidgetTester tester) async {
    await tester.tap(find.text('Manzilimgacha'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tushish joyi'));
    // Narx so'rovi kechiktirilgan (debounce).
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
  }

  String totalText(WidgetTester tester) =>
      tester.widget<Text>(find.byKey(const ValueKey('intercity_total'))).data!;

  testWidgets("standart: Rohat krugida tushish — narx so'ralmaydi, qat'iy narx",
      (tester) async {
    await pump(tester);

    expect(find.text('Rohat krugida'), findsOneWidget);
    expect(totalText(tester), Formatters.formatPrice(25000));

    await tester.tap(find.text('Band qilish'));
    await tester.pumpAndSettle();
    expect(repo.quoteCalls, isEmpty);
    expect(repo.bookCalls.single['dropoff'], 'Rohat krugi');
  });

  testWidgets("manzilgacha: server narxi qatorlari bilan, band manzilga",
      (tester) async {
    await pump(tester);
    await chooseHomeDropoff(tester);

    expect(repo.quoteCalls, ['seat:1:Toshkent, Chilonzor 5']);
    expect(find.text('Qatnov narxi'), findsOneWidget);
    expect(
      find.text("Rohat krugi → manzil: 12.4 km × ${Formatters.formatPrice(2000)}"),
      findsOneWidget,
    );
    expect(totalText(tester), Formatters.formatPrice(50000));

    await tester.tap(find.text('Band qilish'));
    await tester.pumpAndSettle();
    expect(repo.bookCalls.single['dropoff'], 'Toshkent, Chilonzor 5');
  });

  testWidgets("joylar soni o'zgarsa narx qayta so'raladi", (tester) async {
    await pump(tester);
    await chooseHomeDropoff(tester);

    await tester.tap(find.byTooltip("Joyni ko'paytirish"));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(repo.quoteCalls.last, 'seat:2:Toshkent, Chilonzor 5');
    expect(totalText(tester), Formatters.formatPrice(75000));
  });

  testWidgets("narx xatosi — xabar va qayta urinish, band qilish o'chiq",
      (tester) async {
    repo.quoteError = _serverError();
    await pump(tester);
    await chooseHomeDropoff(tester);

    expect(find.text("Narxni hisoblab bo'lmadi"), findsOneWidget);
    await tester.tap(find.text('Band qilish'));
    await tester.pump();
    expect(repo.bookCalls, isEmpty);

    repo.quoteError = null;
    await tester.tap(find.text('Qayta urinish'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(totalText(tester), Formatters.formatPrice(50000));
  });

  testWidgets("davom chegarasidan uzoq — xato, narx so'ralmaydi", (tester) async {
    dropoffChoice = _tooFar;
    await pump(tester);
    await chooseHomeDropoff(tester);

    expect(find.text('Manzil Rohat krugidan 30 km dan uzoqda'), findsOneWidget);
    expect(repo.quoteCalls, isEmpty);
    await tester.tap(find.text('Band qilish'));
    await tester.pump();
    expect(repo.bookCalls, isEmpty);
  });

  testWidgets("band tafsilotida davom qatori ko'rinadi", (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: IntercityBookingDetailScreen(
        booking: IntercityBooking(
          orderId: 'o1',
          status: 'scheduled',
          price: 50000,
          basePrice: 25000,
          extensions: const [_extensionLine],
          trip: _trip,
        ),
        repository: repo,
        now: () => DateTime.utc(2026, 10, 17, 22),
      ),
    ));
    await tester.pump();

    expect(
      find.text("Rohat krugi → manzil: 12.4 km × ${Formatters.formatPrice(2000)}"),
      findsOneWidget,
    );
  });
}
