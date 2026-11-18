import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/update/app_update.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  const policy = AppVersionPolicy(minBuild: 100, latestBuild: 120);

  group('decideUpdate', () {
    test('min dan past — majburiy', () {
      expect(decideUpdate(99, policy), UpdateRequirement.required);
    });
    test('min..latest oralig\'i — ixtiyoriy', () {
      expect(decideUpdate(100, policy), UpdateRequirement.optional);
      expect(decideUpdate(119, policy), UpdateRequirement.optional);
    });
    test('latest va undan yuqori — yo\'q', () {
      expect(decideUpdate(120, policy), UpdateRequirement.none);
      expect(decideUpdate(500, policy), UpdateRequirement.none);
    });
    test("build noma'lum (0) — hech qachon bloklanmaydi", () {
      expect(decideUpdate(0, policy), UpdateRequirement.none);
    });
  });

  group('AppUpdateService.check', () {
    late _MockApiClient api;

    setUp(() => api = _MockApiClient());

    test('serverdagi siyosat o\'qiladi (envelope bilan)', () async {
      when(() => api.get(ApiEndpoints.appVersion, params: {'flavor': 'driver'}))
          .thenAnswer((_) async => Response<dynamic>(
                requestOptions: RequestOptions(path: ApiEndpoints.appVersion),
                data: {
                  'success': true,
                  'data': {
                    'minBuild': 150,
                    'latestBuild': 160,
                    'updateUrl': 'https://x.uz/d.apk',
                  },
                },
              ));
      final service = AppUpdateService(
        api,
        flavor: AppFlavor.driver,
        currentBuild: () async => 140,
      );

      final result = await service.check();

      expect(result?.requirement, UpdateRequirement.required);
      expect(result?.policy.updateUrl, 'https://x.uz/d.apk');
    });

    test('tarmoq xatosi — null (foydalanuvchi bloklanmaydi)', () async {
      when(() => api.get(any(), params: any(named: 'params'))).thenThrow(
        DioException(requestOptions: RequestOptions(path: '/app/version')),
      );
      final service = AppUpdateService(
        api,
        flavor: AppFlavor.passenger,
        currentBuild: () async => 1,
      );

      expect(await service.check(), isNull);
    });
  });
}
