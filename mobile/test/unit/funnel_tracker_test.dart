import 'package:angren_taxi/core/analytics/funnel_tracker.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  late _MockApiClient api;
  late DateTime now;
  late FunnelTracker tracker;
  late List<List<String>> sent;

  setUp(() {
    api = _MockApiClient();
    now = DateTime(2026, 10, 27, 12);
    sent = [];
    when(() => api.post(ApiEndpoints.analyticsFunnel, data: any(named: 'data'))).thenAnswer((inv) async {
      final data = inv.namedArguments[#data] as Map<String, dynamic>;
      expect(data['app'], 'passenger');
      sent.add(List<String>.from(data['steps'] as List));
      return Response(requestOptions: RequestOptions(path: ''), statusCode: 204);
    });
    tracker = FunnelTracker(api: api, now: () => now, flushDelay: null);
  });

  test('bosqichlar yig\'iladi va bitta so\'rov bilan yuboriladi', () async {
    tracker.mark(FunnelStep.appOpen);
    tracker.mark(FunnelStep.destinationSelected);
    await tracker.flush();

    expect(sent, [
      ['app_open', 'destination_selected'],
    ]);
  });

  test('bir sessiyada bosqich bir marta sanaladi (narx qayta hisoblansa ham)', () async {
    tracker.mark(FunnelStep.priceShown);
    tracker.mark(FunnelStep.priceShown);
    await tracker.flush();
    tracker.mark(FunnelStep.priceShown);
    await tracker.flush();

    expect(sent, [
      ['price_shown'],
    ]);
  });

  test('zakaz darhol yuboriladi va keyingi zakaz uchun bosqichlar qayta ochiladi', () async {
    tracker.mark(FunnelStep.appOpen);
    tracker.mark(FunnelStep.priceShown);
    tracker.mark(FunnelStep.orderRequested);
    await Future<void>.delayed(Duration.zero);

    tracker.mark(FunnelStep.appOpen); // ilova hali ochiq — qayta sanalmaydi
    tracker.mark(FunnelStep.priceShown);
    tracker.mark(FunnelStep.orderRequested);
    await Future<void>.delayed(Duration.zero);

    expect(sent, [
      ['app_open', 'price_shown', 'order_requested'],
      ['price_shown', 'order_requested'],
    ]);
  });

  test('30 daqiqadan keyin qaytsa — yangi sessiya, ilova ochilishi qayta sanaladi', () async {
    tracker.onAppResumed();
    await tracker.flush();
    now = now.add(const Duration(minutes: 5));
    tracker.onAppResumed();
    await tracker.flush();
    now = now.add(const Duration(minutes: 31));
    tracker.onAppResumed();
    await tracker.flush();

    expect(sent, [
      ['app_open'],
      ['app_open'],
    ]);
  });

  test('yuborish yiqilsa bosqichlar yo\'qolmaydi — keyingi flush\'da ketadi', () async {
    when(() => api.post(ApiEndpoints.analyticsFunnel, data: any(named: 'data')))
        .thenThrow(DioException(requestOptions: RequestOptions(path: '')));
    tracker.mark(FunnelStep.appOpen);
    await tracker.flush();

    when(() => api.post(ApiEndpoints.analyticsFunnel, data: any(named: 'data'))).thenAnswer((inv) async {
      sent.add(List<String>.from((inv.namedArguments[#data] as Map)['steps'] as List));
      return Response(requestOptions: RequestOptions(path: ''), statusCode: 204);
    });
    await tracker.flush();

    expect(sent, [
      ['app_open'],
    ]);
  });
}
