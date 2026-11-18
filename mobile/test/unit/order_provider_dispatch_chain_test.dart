// "Buyurtma → haydovchi" zanjiri auditi (2026-10-31), yo'lovchi tomoni:
//   · `created` holati faol emas deb hisoblanardi — buyurtmadan keyin holat
//     tekshirilmasdi;
//   · timeout'dan keyin tarif o'zgarsa ham ESKI Idempotency-Key ketardi;
//   · javobsiz qolgan buyurtma yashirin qidirilib qolardi;
//   · tinglovchilar anonim edi (dublikat) va orderId filtrsiz;
//   · "topilmadi" socket'i yo'qolsa ekran izohsiz bosh sahifaga sakrardi;
//   · bekor qilish xatosi jim edi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _MockSocket extends Mock implements SocketService {}

const _pickup = {'address': 'Bobur 10', 'lat': 41.0167, 'lng': 70.1436};
const _dropoff = {'address': 'Markaz', 'lat': 41.02, 'lng': 70.15};

const _start = Tariff(
  id: 't-start', name: 'Start', description: '',
  baseFare: 5000, perKmRate: 1500, minFare: 8000,
);
const _comfort = Tariff(
  id: 't-comfort', name: 'Komfort', description: '',
  baseFare: 7000, perKmRate: 2000, minFare: 10000,
);

Map<String, dynamic> _order(String status, {String id = 'order-1', String? cancelReason}) => {
      'id': id,
      'passengerId': 'p-1',
      'pickup': _pickup,
      'dropoff': _dropoff,
      'status': status,
      'estimatedPrice': 20000.0,
      'createdAt': '2026-10-31T10:00:00.000Z',
      if (cancelReason != null) 'cancelReason': cancelReason,
    };

Response<dynamic> _ok(String path, Object data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

DioException _timeout() => DioException(
      requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
      type: DioExceptionType.receiveTimeout,
    );

DioException _rejected(int status, String message) => DioException(
      requestOptions: RequestOptions(path: ApiEndpoints.cancelOrder('order-1')),
      response: Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.cancelOrder('order-1')),
        statusCode: status,
        data: {'message': message},
      ),
    );

void main() {
  late _MockApiClient api;
  late _MockSocket socket;
  late OrderProvider orders;
  late List<Object> createOutcomes;
  late List<String?> sentKeys;
  late List<Map<String, dynamic>> history;
  late Map<String, dynamic> serverOrder;
  late Map<String, List<void Function(dynamic)>> handlers;

  setUpAll(() => registerFallbackValue(<String, dynamic>{}));

  setUp(() {
    api = _MockApiClient();
    socket = _MockSocket();
    createOutcomes = [];
    sentKeys = [];
    history = [];
    serverOrder = _order('searching');
    handlers = {};
    OrderProvider.uncertainOrderRecheckDelay = Duration.zero;

    when(() => socket.isConnected).thenReturn(true);
    when(() => socket.on(any(), any())).thenAnswer((inv) {
      final event = inv.positionalArguments[0] as String;
      final handler = inv.positionalArguments[1] as void Function(dynamic);
      handlers.putIfAbsent(event, () => []).add(handler);
    });

    when(() => api.post(ApiEndpoints.createOrder,
        data: any(named: 'data'), headers: any(named: 'headers'))).thenAnswer((inv) async {
      final headers = inv.namedArguments[#headers] as Map<String, dynamic>?;
      sentKeys.add(headers?['Idempotency-Key'] as String?);
      final next = createOutcomes.removeAt(0);
      if (next is DioException) throw next;
      return _ok(ApiEndpoints.createOrder, next as Map<String, dynamic>);
    });
    when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _ok(ApiEndpoints.orderHistory, {'orders': history, 'total': history.length}),
    );
    when(() => api.get(ApiEndpoints.orderById('order-1')))
        .thenAnswer((_) async => _ok(ApiEndpoints.orderById('order-1'), serverOrder));

    orders = OrderProvider(apiClient: api, socketService: socket, syncInterval: null)
      ..setPendingPickup(OrderLocation.fromJson(_pickup))
      ..setPendingDropoff(OrderLocation.fromJson(_dropoff))
      ..selectTariff(_start);
  });

  tearDown(() => orders.dispose());

  void emit(String event, Map<String, dynamic> data) {
    for (final handler in List.of(handlers[event] ?? const <void Function(dynamic)>[])) {
      handler(data);
    }
  }

  group('created holati', () {
    test('serverning `created` i — "qidirilmoqda", ya’ni faol', () {
      expect(orderStatusFromString('created'), OrderStatus.searching);
    });

    test('POST /orders `created` qaytarsa ham kuzatuv rejimi yoqiladi', () async {
      createOutcomes.add(_order('created'));

      expect(await orders.createOrder(), isTrue);

      expect(orders.hasActiveOrder, isTrue);
    });

    test('noma’lum holat faol HISOBLANMAYDI (bosh ekran qulflanmaydi)', () {
      expect(orderStatusFromString('some_future_status'), OrderStatus.pending);
    });
  });

  group('Idempotency-Key so‘rov mazmuniga bog‘langan', () {
    test('timeout’dan keyin tarif o‘zgarsa — YANGI kalit', () async {
      createOutcomes.addAll([_timeout(), _order('searching')]);

      expect(await orders.createOrder(), isFalse);
      orders.selectTariff(_comfort);
      expect(await orders.createOrder(), isTrue);

      expect(sentKeys[1], isNot(sentKeys[0]));
    });

    test('timeout’dan keyin hech narsa o‘zgarmasa — o‘sha kalit', () async {
      createOutcomes.addAll([_timeout(), _order('searching')]);

      await orders.createOrder();
      await orders.createOrder();

      expect(sentKeys[1], sentKeys[0]);
    });
  });

  group('javobsiz qolgan buyurtma tiklanadi', () {
    test('timeout — server buyurtmani yaratgan bo‘lsa kuzatuv ekrani ochiladi', () async {
      createOutcomes.add(_timeout());
      history = [_order('searching')];

      expect(await orders.createOrder(), isFalse);
      await pumpEventQueue();

      expect(orders.hasActiveOrder, isTrue);
      expect(orders.activeOrder!.id, 'order-1');
    });

    test('server aniq rad etgan (400) — tiklash urinilmaydi', () async {
      createOutcomes.add(DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: ApiEndpoints.createOrder),
          statusCode: 400,
          data: {'message': 'no'},
        ),
      ));

      await orders.createOrder();
      await pumpEventQueue();

      verifyNever(() => api.get(ApiEndpoints.orderHistory));
    });
  });

  group('socket tinglovchilari', () {
    test('qayta-qayta checkActiveOrder — har event uchun BITTA xil handler', () async {
      history = [_order('searching')];

      await orders.checkActiveOrder();
      await orders.checkActiveOrder();

      final accepted = handlers[SocketEvents.orderAccepted]!;
      expect(accepted.toSet(), hasLength(1));
    });

    test('boshqa buyurtmaning (kuryer) no_drivers_found i taksi ekraniga tegmaydi', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();

      emit(SocketEvents.noDriversFound, {'orderId': 'food-courier-9'});

      expect(orders.hasActiveOrder, isTrue);
      expect(orders.noDriversFoundMessage, isNull);
    });

    test('boshqa buyurtmaning order:accepted i taksi holatini o‘zgartirmaydi', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();

      emit(SocketEvents.orderAccepted, {'orderId': 'food-courier-9', 'driver': null});

      expect(orders.activeOrder!.status, OrderStatus.searching);
    });

    test('o‘z buyurtmasining no_drivers_found i — bekor + banner', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();

      emit(SocketEvents.noDriversFound, {'orderId': 'order-1'});

      expect(orders.hasActiveOrder, isFalse);
      expect(orders.noDriversFoundMessage, AppL10n.current.paxNoDriversNearbyRetry);
    });

    test('tozalashda faqat O‘Z handlerlari o‘chiriladi (boshqa ekranlar tegilmaydi)', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();

      emit(SocketEvents.noDriversFound, {'orderId': 'order-1'});

      verifyNever(() => socket.off(SocketEvents.orderAccepted));
      verify(() => socket.off(SocketEvents.orderAccepted, any())).called(1);
    });
  });

  group('zaxira sinxronlash', () {
    test('"topilmadi" socket’i yo‘qolgan — server holatidan banner chiqadi', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();
      serverOrder = _order('cancelled', cancelReason: kNoDriversCancelReason);

      await orders.refreshOnResume();

      expect(orders.hasActiveOrder, isFalse);
      expect(orders.noDriversFoundMessage, AppL10n.current.paxNoDriversNearbyRetry);
    });

    test('boshqa sabab bilan bekor — banner yo‘q', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();
      serverOrder = _order('cancelled', cancelReason: 'driver cancelled');

      await orders.refreshOnResume();

      expect(orders.hasActiveOrder, isFalse);
      expect(orders.noDriversFoundMessage, isNull);
    });

    test('fondan qaytganda faol buyurtma bo‘lmasa — server tarixidan tiklanadi', () async {
      history = [_order('accepted')];

      await orders.refreshOnResume();

      expect(orders.activeOrder?.status, OrderStatus.driverAssigned);
    });
  });

  group('bekor qilish xatosi jim emas', () {
    test('server rad etsa — false, sabab error da, holat qayta sinxronlanadi', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();
      when(() => api.patch(ApiEndpoints.cancelOrder('order-1'), data: any(named: 'data')))
          .thenThrow(_rejected(400, 'Buyurtmani hozirgi holatida bekor qilib bo‘lmaydi'));
      serverOrder = _order('accepted');

      expect(await orders.cancelOrder(), isFalse);
      await pumpEventQueue();

      expect(orders.error, 'Buyurtmani hozirgi holatida bekor qilib bo‘lmaydi');
      expect(orders.activeOrder!.status, OrderStatus.driverAssigned);
    });

    test('muvaffaqiyat — true', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();
      when(() => api.patch(ApiEndpoints.cancelOrder('order-1'), data: any(named: 'data')))
          .thenAnswer((_) async => _ok(ApiEndpoints.cancelOrder('order-1'), {}));

      expect(await orders.cancelOrder(), isTrue);
      expect(orders.activeOrder, isNull);
    });
  });

  test('sendTimeout — "vaqt tugadi" xabari, "noma’lum xato" emas', () {
    final message = extractErrorMessage(DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: DioExceptionType.sendTimeout,
    ));
    expect(message, AppL10n.current.shErrorTimeout);
  });

  group('4-bosqich: qayta izlash, boshqa tarif, bo‘sh haydovchilar', () {
    test('qayta izlash — o‘sha tana, YANGI kalit', () async {
      createOutcomes.addAll([_order('searching'), _order('searching', id: 'order-2')]);
      await orders.createOrder();
      emit(SocketEvents.noDriversFound, {'orderId': 'order-1'});
      expect(orders.canRetryLastOrder, isTrue);

      expect(await orders.retryLastOrder(), isTrue);

      final calls = verify(() => api.post(ApiEndpoints.createOrder,
          data: captureAny(named: 'data'), headers: any(named: 'headers'))).captured;
      expect(calls[1], calls[0]);
      expect(sentKeys[1], isNot(sentKeys[0]));
      expect(orders.activeOrder!.id, 'order-2');
    });

    test('rejalashtirilgan buyurtma qayta izlash uchun saqlanmaydi', () async {
      orders.setScheduledAt(DateTime.now().add(const Duration(hours: 2)));
      createOutcomes.add(_order('scheduled'));

      await orders.createOrder();

      expect(orders.canRetryLastOrder, isFalse);
    });

    test('boshqa tarif — marshrut tugagan buyurtmadan tiklanadi, tarif tanlanmagan', () {
      final fresh = OrderProvider(apiClient: api, socketService: socket);
      final cancelled = Order.fromJson(_order('cancelled'));

      fresh.restorePendingFromOrder(cancelled);

      expect(fresh.pendingPickup!.address, 'Bobur 10');
      expect(fresh.pendingDropoff!.address, 'Markaz');
      expect(fresh.selectedTariff, isNull);
      fresh.dispose();
    });

    test('bo‘sh haydovchilar soni o‘qiladi; xato bo‘lsa — noma’lum (null), "0" emas', () async {
      when(() => api.get(ApiEndpoints.nearbyDriversCount, params: any(named: 'params')))
          .thenAnswer((_) async => _ok(ApiEndpoints.nearbyDriversCount, {'count': 3, 'radiusKm': 5}));
      await orders.loadNearbyDrivers(41.0, 70.1);
      expect(orders.nearbyFreeDrivers, 3);

      when(() => api.get(ApiEndpoints.nearbyDriversCount, params: any(named: 'params')))
          .thenThrow(_rejected(404, 'Not found'));
      await orders.loadNearbyDrivers(41.0, 70.1);
      expect(orders.nearbyFreeDrivers, isNull);
    });

    test('qidiruv vaqti faqat O‘SHA buyurtmaga tegishli', () async {
      createOutcomes.add(_order('searching'));
      await orders.createOrder();
      expect(orders.searchStartedAt, isNotNull);

      emit(SocketEvents.noDriversFound, {'orderId': 'order-1'});
      history = [_order('searching', id: 'order-9')];
      await orders.checkActiveOrder();

      // order-9 o'z createdAt idan (kelajakda emas), order-1 vaqtidan emas.
      expect(orders.activeOrder!.id, 'order-9');
      expect(orders.searchStartedAt, DateTime.parse('2026-10-31T10:00:00.000Z').toLocal());
    });
  });
}
