import 'dart:typed_data';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _RecordingAdapter implements HttpClientAdapter {
  final languages = <String?>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    languages.add(options.headers['Accept-Language'] as String?);
    return ResponseBody.fromString('{}', 200, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  @override
  void close({bool force = false}) {}
}

/// Server xato xabarlarini ilova tilida qaytaradi (`Accept-Language`).
/// Til ilova ichida almashtirilsa, KEYINGI so'rovdan yangi til ketishi kerak.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("so'rov joriy ilova tilini yuboradi va til almashganda yangilanadi", () async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final locale = LocaleController(prefs);
    final adapter = _RecordingAdapter();
    final client = ApiClient(
      LocalStorage(prefs, secureStore: InMemorySecureTokenStore()),
      GlobalKey<NavigatorState>(),
      dio: Dio(BaseOptions(baseUrl: 'https://example.test'))..httpClientAdapter = adapter,
    );

    await locale.setLocale(const Locale('uz'));
    await client.get('/orders');
    await locale.setLocale(const Locale('ru'));
    await client.get('/orders');
    await locale.setLocale(const Locale('uz'));

    expect(adapter.languages, ['uz', 'ru']);
  });
}
