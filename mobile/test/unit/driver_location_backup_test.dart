// Haydovchi joylashuvining HTTP zaxirasi faqat socket uzilganda ketadi.
//
// Socket handler (`realtime.gateway.ts`) joylashuvni o'zi DB + Redis'ga
// yozadi; ilgari HTTP ham har fiksda ketardi va harakatda har 4 soniyada
// ikki yozuv bo'lardi.
import 'dart:async';

import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _FakeSocket extends SocketService {
  _FakeSocket({required this.connected});

  final bool connected;
  final emitted = <String>[];

  @override
  bool get isConnected => connected;

  @override
  void emit(String event, dynamic data) => emitted.add(event);
}

class _StreamLocationService extends LocationService {
  final controller = StreamController<Position>.broadcast();

  @override
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    BackgroundNotice? background,
  }) =>
      controller.stream;

  Future<void> close() => controller.close();
}

Position _fix() => Position(
      latitude: 41.0167,
      longitude: 70.1436,
      timestamp: DateTime(2026, 10, 10, 10),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 10,
      speedAccuracy: 0,
    );

Response<dynamic> _ok(String path) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MockApiClient api;
  late LocalStorage storage;
  late _StreamLocationService location;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorage(await SharedPreferences.getInstance());
    api = _MockApiClient();
    location = _StreamLocationService();
    when(() => api.patch(any(), data: any(named: 'data')))
        .thenAnswer((i) async => _ok(i.positionalArguments.first as String));
    when(() => api.post(any(), data: any(named: 'data')))
        .thenAnswer((i) async => _ok(i.positionalArguments.first as String));
  });

  tearDown(() => location.close());

  Future<_FakeSocket> goOnlineAndPing({required bool connected}) async {
    final socket = _FakeSocket(connected: connected);
    final provider = DriverProvider(
      apiClient: api,
      socketService: socket,
      locationService: location,
      localStorage: storage,
    );
    await provider.goOnline();
    location.controller.add(_fix());
    await Future<void>.delayed(Duration.zero);
    return socket;
  }

  test('socket ulangan — joylashuv faqat socket orqali, HTTP yo\'q', () async {
    final socket = await goOnlineAndPing(connected: true);

    expect(socket.emitted, contains(SocketEvents.driverLocation));
    verifyNever(
      () => api.post(ApiEndpoints.updateLocation, data: any(named: 'data')),
    );
  });

  test('socket uzilgan — HTTP zaxira ketadi', () async {
    final socket = await goOnlineAndPing(connected: false);

    expect(socket.emitted, isNot(contains(SocketEvents.driverLocation)));
    verify(
      () => api.post(ApiEndpoints.updateLocation, data: any(named: 'data')),
    ).called(1);
  });
}
