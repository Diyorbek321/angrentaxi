import 'package:angren_taxi/core/network/performance_interceptor.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('URL so\'rov qatorisiz va fragmentsiz yoziladi', () {
    expect(
      PerformanceInterceptor.urlFor(
        Uri.parse('https://api.example.uz/api/v1/tariffs?serviceType=taxi#x'),
      ),
      'https://api.example.uz/api/v1/tariffs',
    );
    expect(
      PerformanceInterceptor.urlFor(Uri.parse('http://10.0.2.2:3000/api/v1/orders/42')),
      'http://10.0.2.2:3000/api/v1/orders/42',
    );
  });

  test('Firebase yo\'q bo\'lsa so\'rov o\'zgarishsiz o\'tadi', () async {
    final dio = Dio()
      ..interceptors.add(PerformanceInterceptor(isEnabled: () => false))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) => handler.resolve(
            Response<dynamic>(requestOptions: options, statusCode: 200, data: 'ok'),
          ),
        ),
      );

    final response = await dio.get<dynamic>('https://api.example.uz/x');

    expect(response.data, 'ok');
    expect(response.requestOptions.extra, isEmpty);
  });
}
