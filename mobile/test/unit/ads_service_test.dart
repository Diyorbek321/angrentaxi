import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/ads/ads_service.dart';
import 'package:angren_taxi/shared/models/ad_banner.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApi extends Mock implements ApiClient {}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

void main() {
  late _MockApi api;
  late AdsService service;

  setUp(() {
    AdsService.resetSession();
    api = _MockApi();
    service = AdsService(api);
    when(() => api.post(any())).thenAnswer((_) async => _ok(null));
  });

  test('parses active banners, unknown link types fall back to none', () async {
    when(() => api.get('/ads/active')).thenAnswer((_) async => _ok([
          {'id': 'a', 'title': 'Lavash', 'linkType': 'url', 'linkTarget': 'https://lavash.uz'},
          {'id': 'b', 'title': 'Yangi', 'linkType': 'video', 'linkTarget': null},
        ]));

    final banners = await service.active();

    expect(banners.map((b) => b.linkType), [AdLinkType.url, AdLinkType.none]);
    expect(banners.first.imageUrl, endsWith('/ads/a/image'));
  });

  test('an impression is sent once per banner per session', () async {
    await service.recordImpression('a');
    await service.recordImpression('a');
    // A fresh service (home rebuilt) shares the session set.
    await AdsService(api).recordImpression('a');
    await service.recordImpression('b');

    verify(() => api.post('/ads/a/impression')).called(1);
    verify(() => api.post('/ads/b/impression')).called(1);
  });

  test('a failed counter never throws to the caller', () async {
    when(() => api.post('/ads/a/click')).thenThrow(Exception('offline'));
    await expectLater(service.recordClick('a'), completes);
  });

  test('only https targets become an external link', () {
    AdBanner url(String target) =>
        AdBanner(id: 'x', title: 't', linkType: AdLinkType.url, linkTarget: target);
    expect(url('https://lavash.uz/menu').externalUri, isNotNull);
    expect(url('http://lavash.uz').externalUri, isNull);
    expect(url('javascript:alert(1)').externalUri, isNull);
    expect(url('intent://scan#Intent;end').externalUri, isNull);
  });
}
