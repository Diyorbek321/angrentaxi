import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';

/// Har bir API so'rovining davomiyligi va natijasini Firebase Performance'ga
/// yozadi — haqiqiy foydalanuvchilar telefonida qaysi endpoint sekin
/// ekanini konsolda ko'rish uchun.
///
/// ⚠️ NEGA QO'LDA. Firebase'ning avtomatik tarmoq kuzatuvi faqat native
/// (OkHttp/URLSession) so'rovlarni ko'radi; Dio esa Dart'ning o'z HTTP
/// mijozidan foydalanadi va u yerda ko'rinmaydi.
///
/// URL'dan so'rov qatori (`?…`) olib tashlanadi: konsol endpoint'larni
/// yo'l bo'yicha guruhlaydi, qiymatlar esa faqat shovqin.
///
/// Firebase ishga tushmagan bo'lsa (dev/mock rejim, testlar) hech narsa
/// qilmaydi.
class PerformanceInterceptor extends Interceptor {
  PerformanceInterceptor({bool Function()? isEnabled})
      : _isEnabled = isEnabled ?? (() => Firebase.apps.isNotEmpty);

  final bool Function() _isEnabled;

  static const String _metricKey = 'perf.httpMetric';

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (_isEnabled()) {
      try {
        final method = _method(options.method);
        if (method != null) {
          final metric = FirebasePerformance.instance.newHttpMetric(urlFor(options.uri), method);
          await metric.start();
          options.extra[_metricKey] = metric;
        }
      } catch (e) {
        // O'lchov — ikkinchi darajali; so'rovni hech qachon to'xtatmaydi.
        debugPrint('[Perf] start failed: $e');
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) async {
    await _stop(response.requestOptions, response.statusCode);
    handler.next(response);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    await _stop(err.requestOptions, err.response?.statusCode);
    handler.next(err);
  }

  Future<void> _stop(RequestOptions options, int? statusCode) async {
    final metric = options.extra.remove(_metricKey);
    if (metric is! HttpMetric) return;
    try {
      if (statusCode != null) metric.httpResponseCode = statusCode;
      await metric.stop();
    } catch (e) {
      debugPrint('[Perf] stop failed: $e');
    }
  }

  /// So'rov qatori va fragmentsiz URL.
  @visibleForTesting
  static String urlFor(Uri uri) => Uri(
        scheme: uri.scheme,
        host: uri.host,
        port: uri.hasPort ? uri.port : null,
        path: uri.path,
      ).toString();

  static HttpMethod? _method(String method) => switch (method.toUpperCase()) {
        'GET' => HttpMethod.Get,
        'POST' => HttpMethod.Post,
        'PUT' => HttpMethod.Put,
        'PATCH' => HttpMethod.Patch,
        'DELETE' => HttpMethod.Delete,
        _ => null,
      };
}
