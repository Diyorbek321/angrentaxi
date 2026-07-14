// Unit tests for three new DriverProvider methods that consume newly added
// backend endpoints:
//  - loadEarningsBreakdown() → GET /orders/earnings/breakdown
//    (today/week/month gross/commission/net/trips)
//  - loadBonusProgress()     → GET /driver-bonus-rules/me/progress
//  - loadRatingStats()       → GET /ratings/driver/:userId
//
// Pattern mirrors test/unit/order_provider_estimate_test.dart: mock
// ApiClient with mocktail, no real network/platform calls.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late DriverProvider provider;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    apiClient = MockApiClient();
    provider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: LocalStorage(prefs),
    );
  });

  group('loadEarningsBreakdown', () {
    test('parses today/week/month gross/commission/net/trips', () async {
      when(() => apiClient.get(ApiEndpoints.driverEarningsBreakdown))
          .thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverEarningsBreakdown, {
          'today': {'gross': 20000, 'commission': 2000, 'net': 18000, 'trips': 1},
          'week': {'gross': 40000, 'commission': 4000, 'net': 36000, 'trips': 2},
          'month': {'gross': 55000, 'commission': 5500, 'net': 49500, 'trips': 3},
        }),
      );

      await provider.loadEarningsBreakdown();

      expect(ApiEndpoints.driverEarningsBreakdown, '/orders/earnings/breakdown');
      expect(provider.earningsBreakdown.today.gross, 20000);
      expect(provider.earningsBreakdown.today.commission, 2000);
      expect(provider.earningsBreakdown.today.net, 18000);
      expect(provider.earningsBreakdown.today.trips, 1);
      expect(provider.earningsBreakdown.week.trips, 2);
      expect(provider.earningsBreakdown.month.gross, 55000);
      expect(provider.earningsBreakdown.month.net, 49500);
    });

    test('a failed request leaves earningsBreakdown at its empty default',
        () async {
      when(() => apiClient.get(ApiEndpoints.driverEarningsBreakdown))
          .thenThrow(
        DioException(
          requestOptions:
              RequestOptions(path: ApiEndpoints.driverEarningsBreakdown),
        ),
      );

      await provider.loadEarningsBreakdown();

      expect(provider.earningsBreakdown.today.trips, 0);
      expect(provider.earningsBreakdown.today.gross, 0);
    });
  });

  group('loadBonusProgress', () {
    test('parses active bonus rules with progress', () async {
      when(() => apiClient.get(ApiEndpoints.driverBonusProgress)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverBonusProgress, [
          {
            'ruleId': 'rule-1',
            'name': '10 ta safar bonusi',
            'ruleType': 'trip_count',
            'tripThreshold': 10,
            'bonusAmount': 50000,
            'currentCount': 4,
          },
          {
            'ruleId': 'rule-2',
            'name': 'Haftalik maqsad',
            'ruleType': 'weekly_goal',
            'tripThreshold': 20,
            'bonusAmount': 100000,
            'currentCount': 20,
          },
        ]),
      );

      await provider.loadBonusProgress();

      expect(ApiEndpoints.driverBonusProgress, '/driver-bonus-rules/me/progress');
      expect(provider.bonusProgress, hasLength(2));
      expect(provider.bonusProgress[0].ruleType, BonusRuleType.tripCount);
      expect(provider.bonusProgress[0].currentCount, 4);
      expect(provider.bonusProgress[0].progressFraction, closeTo(0.4, 0.0001));
      expect(provider.bonusProgress[1].ruleType, BonusRuleType.weeklyGoal);
      expect(provider.bonusProgress[1].progressFraction, 1.0);
    });

    test('a failed request leaves bonusProgress empty', () async {
      when(() => apiClient.get(ApiEndpoints.driverBonusProgress)).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: ApiEndpoints.driverBonusProgress),
        ),
      );

      await provider.loadBonusProgress();

      expect(provider.bonusProgress, isEmpty);
    });
  });

  group('loadRatingStats', () {
    test('fetches the profile first to resolve the userId, then loads stats',
        () async {
      when(() => apiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
          'id': 'driver-1',
          'carModel': 'Cobalt',
          'carNumber': '01 A 123 BC',
          'user': {'id': 'user-1', 'phone': '+998901112233', 'status': 'approved'},
        }),
      );
      when(() => apiClient.get(ApiEndpoints.driverRatingStats('user-1')))
          .thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverRatingStats('user-1'), {
          'avg': 4.5,
          'count': 4,
          'breakdown': {'1': 0, '2': 0, '3': 1, '4': 1, '5': 2},
        }),
      );

      await provider.loadRatingStats();

      expect(ApiEndpoints.driverRatingStats('user-1'), '/ratings/driver/user-1');
      verify(() => apiClient.get(ApiEndpoints.driverProfile)).called(1);
      expect(provider.ratingStats.avg, 4.5);
      expect(provider.ratingStats.count, 4);
      expect(provider.ratingStats.breakdown[5], 2);
      expect(provider.ratingStats.breakdown[4], 1);
      expect(provider.ratingStats.breakdown[3], 1);
      expect(provider.ratingStats.breakdown[2], 0);
      expect(provider.ratingStats.breakdown[1], 0);
      expect(provider.ratingStats.maxBreakdownCount, 2);
    });

    test('reuses an already-loaded driver profile instead of refetching it',
        () async {
      when(() => apiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
          'id': 'driver-1',
          'carModel': 'Cobalt',
          'carNumber': '01 A 123 BC',
          'user': {'id': 'user-1', 'phone': '+998901112233', 'status': 'approved'},
        }),
      );
      when(() => apiClient.get(ApiEndpoints.driverRatingStats('user-1')))
          .thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverRatingStats('user-1'), {
          'avg': 5.0,
          'count': 1,
          'breakdown': {'1': 0, '2': 0, '3': 0, '4': 0, '5': 1},
        }),
      );

      await provider.loadProfile();
      await provider.loadRatingStats();

      verify(() => apiClient.get(ApiEndpoints.driverProfile)).called(1);
      expect(provider.ratingStats.count, 1);
    });

    test('a failed rating-stats request leaves ratingStats at its default',
        () async {
      when(() => apiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
          'id': 'driver-1',
          'carModel': 'Cobalt',
          'carNumber': '01 A 123 BC',
          'user': {'id': 'user-1', 'phone': '+998901112233', 'status': 'approved'},
        }),
      );
      when(() => apiClient.get(ApiEndpoints.driverRatingStats('user-1')))
          .thenThrow(
        DioException(
          requestOptions:
              RequestOptions(path: ApiEndpoints.driverRatingStats('user-1')),
        ),
      );

      await provider.loadRatingStats();

      expect(provider.ratingStats.count, 0);
      expect(provider.ratingStats.avg, 0);
    });
  });
}
