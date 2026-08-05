import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/demo/demo_engine.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// Marks a request that has already been replayed after a token refresh, so a
/// second 401 on the same request ends in a logout instead of a refresh loop.
const String _retriedFlag = 'angren_retried_after_refresh';

/// Paths that must never trigger the refresh flow — a 401 from any of these
/// *is* the failure, and refreshing in response would recurse.
const Set<String> _noRefreshPaths = {
  ApiEndpoints.refreshToken,
  ApiEndpoints.logout,
  ApiEndpoints.sendOtp,
  ApiEndpoints.verifyOtp,
};

class ApiClient {
  late final Dio _dio;

  /// Bare Dio used only for `POST /auth/refresh`. It deliberately carries no
  /// interceptors, so a 401 on the refresh call cannot re-enter the refresh
  /// logic (guard 1 of 2 against recursion; [_noRefreshPaths] is guard 2).
  late final Dio _refreshDio;

  final LocalStorage _storage;
  final GlobalKey<NavigatorState> navigatorKey;

  /// Single-flight guard. While a refresh is in progress every other 401 awaits
  /// this future instead of issuing its own `/auth/refresh` call. With refresh
  /// token rotation, concurrent refreshes would send the same (already
  /// consumed) token twice and trip the backend's reuse detection, destroying
  /// the session entirely.
  Completer<bool>? _refreshInFlight;

  ApiClient(
    this._storage,
    this.navigatorKey, {
    Dio? dio,
    Dio? refreshDio,
  }) {
    _dio = dio ?? Dio(_baseOptions());
    _refreshDio = refreshDio ?? Dio(_baseOptions());

    // Demo mode: short-circuit every request with canned data. Added first so
    // it resolves before the auth/logging interceptors run.
    if (AppConfig.demoMode) {
      _dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            await Future<void>.delayed(const Duration(milliseconds: 350));
            final body = DemoEngine.instance.handle(
              options.method.toUpperCase(),
              options.path,
              options.data,
            );
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                data: body,
                statusCode: 200,
              ),
            );
          },
        ),
      );
    }

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = _storage.getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (!_shouldAttemptRefresh(error)) {
            if (_isUnrecoverable401(error)) await forceLogout();
            handler.next(error);
            return;
          }

          final refreshed = await _refreshTokens();
          if (!refreshed) {
            await forceLogout();
            handler.next(error);
            return;
          }

          try {
            handler.resolve(await _replay(error.requestOptions));
          } on DioException catch (retryError) {
            handler.next(retryError);
          } catch (_) {
            handler.next(error);
          }
        },
      ),
    );

    _dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => debugPrint(obj.toString()),
      ),
    );
  }

  static BaseOptions _baseOptions() => BaseOptions(
    baseUrl: AppConfig.apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  );

  static bool _isAuthPath(String path) =>
      _noRefreshPaths.any((p) => path.endsWith(p));

  bool _shouldAttemptRefresh(DioException error) {
    if (error.response?.statusCode != 401) return false;
    final options = error.requestOptions;
    if (options.extra[_retriedFlag] == true) return false;
    if (_isAuthPath(options.path)) return false;
    final refreshToken = _storage.getRefreshToken();
    return refreshToken != null && refreshToken.isNotEmpty;
  }

  /// A 401 we cannot recover from: no refresh token at all, or a request that
  /// already failed once *after* a successful refresh. Login/OTP endpoints are
  /// excluded — a 401 there just means "wrong code", not "session expired".
  bool _isUnrecoverable401(DioException error) {
    if (error.response?.statusCode != 401) return false;
    final options = error.requestOptions;
    if (_isAuthPath(options.path)) return false;
    return true;
  }

  /// Coalesces concurrent refresh attempts into one network call. Callers that
  /// arrive while a refresh is running simply await its result and are then
  /// replayed with the freshly issued access token.
  Future<bool> _refreshTokens() {
    final inFlight = _refreshInFlight;
    if (inFlight != null) return inFlight.future;

    final completer = Completer<bool>();
    _refreshInFlight = completer;

    _performRefresh().then(
      (ok) {
        _refreshInFlight = null;
        completer.complete(ok);
      },
      onError: (Object _) {
        _refreshInFlight = null;
        completer.complete(false);
      },
    );

    return completer.future;
  }

  Future<bool> _performRefresh() async {
    final refreshToken = _storage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return false;

    final Response<dynamic> response;
    try {
      response = await _refreshDio.post(
        ApiEndpoints.refreshToken,
        data: {'refreshToken': refreshToken},
      );
    } on DioException {
      return false;
    }

    final payload = _unwrap(response.data);
    if (payload == null) return false;

    final accessToken = payload['accessToken'] as String?;
    if (accessToken == null || accessToken.isEmpty) return false;

    // Rotation-tolerant: newer backends return a fresh refresh token, older
    // ones answer with `{ accessToken }` only — in which case the stored
    // refresh token is still valid and is kept as-is.
    await _storage.saveTokens(
      accessToken: accessToken,
      refreshToken: payload['refreshToken'] as String?,
    );
    return true;
  }

  /// Accepts both `{ accessToken }` and the enveloped `{ data: {...} }` shape.
  static Map<String, dynamic>? _unwrap(dynamic body) {
    if (body is! Map<String, dynamic>) return null;
    final inner = body['data'];
    if (inner is Map<String, dynamic>) return inner;
    return body;
  }

  Future<Response<dynamic>> _replay(RequestOptions options) {
    final token = _storage.getToken();
    return _dio.fetch(
      options.copyWith(
        extra: {...options.extra, _retriedFlag: true},
        headers: {
          ...options.headers,
          if (token != null) 'Authorization': 'Bearer $token',
        },
      ),
    );
  }

  /// Wipes credentials and returns to the auth flow. Called when refreshing is
  /// impossible or itself rejected.
  Future<void> forceLogout() async {
    await _storage.clearTokens();
    await _storage.clearUser();
    navigatorKey.currentState?.pushNamedAndRemoveUntil(
      '/phone',
      (route) => false,
    );
  }

  Future<Response<dynamic>> get(
    String path, {
    Map<String, dynamic>? params,
  }) => _dio.get(path, queryParameters: params);

  Future<Response<dynamic>> post(
    String path, {
    dynamic data,
    ProgressCallback? onSendProgress,
  }) => _dio.post(path, data: data, onSendProgress: onSendProgress);

  Future<Response<dynamic>> patch(String path, {dynamic data}) =>
      _dio.patch(path, data: data);

  Future<Response<dynamic>> put(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  Future<Response<dynamic>> delete(String path, {dynamic data}) =>
      _dio.delete(path, data: data);
}

String extractErrorMessage(dynamic error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      return (data['message'] as String?) ??
          (data['error'] as String?) ??
          'Xatolik yuz berdi';
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return 'Ulanish vaqti tugadi. Internetni tekshiring';
    }
    if (error.type == DioExceptionType.connectionError) {
      return 'Internet bilan muammo bor';
    }
  }
  return 'Noma\'lum xatolik yuz berdi';
}
