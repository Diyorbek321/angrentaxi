import 'dart:async';
import 'dart:typed_data';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Routes every request to a plain callback so tests can script the backend.
class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this.onFetch);

  final Future<ResponseBody> Function(RequestOptions options) onFetch;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => onFetch(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(String body, int statusCode) => ResponseBody.fromString(
  body,
  statusCode,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;
  late GlobalKey<NavigatorState> navigatorKey;

  Future<LocalStorage> buildStorage({
    String? accessToken = 'old-access',
    String? refreshToken = 'old-refresh',
  }) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final s = LocalStorage(prefs, secureStore: InMemorySecureTokenStore());
    if (accessToken != null) await s.saveToken(accessToken);
    if (refreshToken != null) await s.saveRefreshToken(refreshToken);
    return s;
  }

  setUp(() {
    navigatorKey = GlobalKey<NavigatorState>();
  });

  /// Builds an ApiClient whose protected endpoint answers 401 for any token
  /// other than [validToken], and whose /auth/refresh answers [refreshBody]
  /// with [refreshStatus].
  ({ApiClient client, List<String> refreshCalls, List<String?> apiAuthHeaders})
  buildClient({
    required String validToken,
    required String refreshBody,
    int refreshStatus = 200,
    Duration refreshDelay = const Duration(milliseconds: 20),
  }) {
    final refreshCalls = <String>[];
    final apiAuthHeaders = <String?>[];

    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _ScriptedAdapter((options) async {
        final auth = options.headers['Authorization'] as String?;
        apiAuthHeaders.add(auth);
        if (auth == 'Bearer $validToken') {
          return _json('{"ok":true,"path":"${options.path}"}', 200);
        }
        return _json('{"message":"Unauthorized"}', 401);
      });

    final refreshDio = Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _ScriptedAdapter((options) async {
        refreshCalls.add(options.path);
        await Future<void>.delayed(refreshDelay);
        return _json(refreshBody, refreshStatus);
      });

    return (
      client: ApiClient(storage, navigatorKey, dio: dio, refreshDio: refreshDio),
      refreshCalls: refreshCalls,
      apiAuthHeaders: apiAuthHeaders,
    );
  }

  group('401 -> refresh -> replay', () {
    test('replays the original request with the new access token', () async {
      storage = await buildStorage();
      final h = buildClient(
        validToken: 'new-access',
        refreshBody:
            '{"data":{"accessToken":"new-access","refreshToken":"new-refresh"}}',
      );

      final response = await h.client.get('/orders');

      expect(response.statusCode, 200);
      expect((response.data as Map)['ok'], isTrue);
      expect(h.refreshCalls, hasLength(1));
      expect(storage.getToken(), 'new-access');
      expect(storage.getRefreshToken(), 'new-refresh');
      // First attempt with the stale token, replay with the fresh one.
      expect(h.apiAuthHeaders, [
        'Bearer old-access',
        'Bearer new-access',
      ]);
    });

    test('accepts an unenveloped {accessToken} body', () async {
      storage = await buildStorage();
      final h = buildClient(
        validToken: 'new-access',
        refreshBody: '{"accessToken":"new-access"}',
      );

      final response = await h.client.get('/orders');

      expect(response.statusCode, 200);
      expect(storage.getToken(), 'new-access');
    });

    test(
      'keeps the existing refresh token when the backend does not rotate',
      () async {
        storage = await buildStorage();
        final h = buildClient(
          validToken: 'new-access',
          refreshBody: '{"data":{"accessToken":"new-access"}}',
        );

        await h.client.get('/orders');

        expect(storage.getRefreshToken(), 'old-refresh');
      },
    );
  });

  group('parallel 401s', () {
    test('five concurrent 401s trigger exactly one refresh call', () async {
      storage = await buildStorage();
      final h = buildClient(
        validToken: 'new-access',
        refreshBody:
            '{"data":{"accessToken":"new-access","refreshToken":"new-refresh"}}',
        refreshDelay: const Duration(milliseconds: 50),
      );

      final responses = await Future.wait([
        h.client.get('/orders'),
        h.client.get('/tariffs'),
        h.client.get('/users/me'),
        h.client.get('/promos'),
        h.client.get('/notifications'),
      ]);

      expect(h.refreshCalls, hasLength(1));
      expect(responses.map((r) => r.statusCode), everyElement(200));
      expect(storage.getRefreshToken(), 'new-refresh');
    });

    test('a later 401 starts a fresh refresh once the first one is done',
        () async {
      storage = await buildStorage();
      final h = buildClient(
        validToken: 'new-access',
        refreshBody:
            '{"data":{"accessToken":"new-access","refreshToken":"new-refresh"}}',
      );

      await h.client.get('/orders');
      // Force the stale token back so the next call 401s again.
      await storage.saveToken('old-access');
      await h.client.get('/orders');

      expect(h.refreshCalls, hasLength(2));
    });
  });

  group('refresh failure', () {
    test('clears tokens and user when refresh is rejected', () async {
      storage = await buildStorage();
      await storage.saveUser({'id': 'u1', 'phone': '+998900000000'});
      final h = buildClient(
        validToken: 'new-access',
        refreshBody: '{"message":"Invalid refresh token"}',
        refreshStatus: 401,
      );

      await expectLater(
        h.client.get('/orders'),
        throwsA(isA<DioException>()),
      );

      expect(h.refreshCalls, hasLength(1));
      expect(storage.getToken(), isNull);
      expect(storage.getRefreshToken(), isNull);
      expect(storage.getUser(), isNull);
      expect(storage.isLoggedIn, isFalse);
    });

    test('does not call refresh at all when no refresh token is stored',
        () async {
      storage = await buildStorage(refreshToken: null);
      final h = buildClient(
        validToken: 'new-access',
        refreshBody: '{"data":{"accessToken":"new-access"}}',
      );

      await expectLater(
        h.client.get('/orders'),
        throwsA(isA<DioException>()),
      );

      expect(h.refreshCalls, isEmpty);
      expect(storage.getToken(), isNull);
    });

    test('a 401 on the replayed request does not loop', () async {
      storage = await buildStorage();
      // The refresh "succeeds" but hands back a token the API still rejects.
      final h = buildClient(
        validToken: 'never-valid',
        refreshBody: '{"data":{"accessToken":"still-bad"}}',
      );

      await expectLater(
        h.client.get('/orders'),
        throwsA(isA<DioException>()),
      );

      expect(h.refreshCalls, hasLength(1));
      // Original attempt + exactly one replay.
      expect(h.apiAuthHeaders, hasLength(2));
      expect(storage.getToken(), isNull);
    });

    test('a 401 from the auth endpoints never triggers refresh or logout',
        () async {
      storage = await buildStorage();
      final h = buildClient(
        validToken: 'new-access',
        refreshBody: '{"data":{"accessToken":"new-access"}}',
      );

      await expectLater(
        h.client.post('/auth/verify-otp', data: {'code': '0000'}),
        throwsA(isA<DioException>()),
      );

      expect(h.refreshCalls, isEmpty);
      // Wrong OTP must not wipe an existing session.
      expect(storage.getToken(), 'old-access');
    });
  });
}
