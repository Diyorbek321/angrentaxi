import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/demo/demo_engine.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';

class ApiClient {
  late final Dio _dio;
  final LocalStorage _storage;
  final GlobalKey<NavigatorState> navigatorKey;

  ApiClient(this._storage, this.navigatorKey) {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

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
          if (error.response?.statusCode == 401) {
            await _storage.clearToken();
            await _storage.clearUser();
            navigatorKey.currentState?.pushNamedAndRemoveUntil(
              '/phone',
              (route) => false,
            );
          }
          handler.next(error);
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

  Future<Response<dynamic>> get(
    String path, {
    Map<String, dynamic>? params,
  }) => _dio.get(path, queryParameters: params);

  Future<Response<dynamic>> post(String path, {dynamic data}) =>
      _dio.post(path, data: data);

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
