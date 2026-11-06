import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApi extends Mock implements ApiClient {}

// Google Play: hisobni ilova ichida o'chirish. Muvaffaqiyatda sessiya
// qurilmadan butunlay tozalanadi; rad etilsa (faol buyurtma, hamyonda pul)
// hech narsa o'chmaydi va server bergan barcha sabablar ko'rsatiladi.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MockApi api;
  late LocalStorage storage;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    storage = LocalStorage(
      await SharedPreferences.getInstance(),
      secureStore: InMemorySecureTokenStore(),
    );
    await storage.initTokens();
    await storage.saveTokens(accessToken: 'access', refreshToken: 'refresh');
    api = _MockApi();
  });

  AuthProvider build() => AuthProvider(
        apiClient: api,
        localStorage: storage,
        socketService: SocketService(),
        navigatorKey: GlobalKey<NavigatorState>(),
        flavor: AppFlavor.passenger,
      );

  test("o'chirilgach tokenlar qurilmadan tozalanadi", () async {
    when(() => api.delete(ApiEndpoints.account)).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.account),
        data: {'success': true, 'data': {'deleted': true}},
        statusCode: 200,
      ),
    );

    final result = await build().deleteAccount();

    expect(result.deleted, isTrue);
    expect(storage.getToken(), isNull);
  });

  test("409 — sabablar qaytadi, sessiya saqlanib qoladi", () async {
    final options = RequestOptions(path: ApiEndpoints.account);
    when(() => api.delete(ApiEndpoints.account)).thenThrow(
      DioException(
        requestOptions: options,
        response: Response<dynamic>(
          requestOptions: options,
          statusCode: 409,
          data: {
            'success': false,
            'statusCode': 409,
            'code': 'ACCOUNT_DELETION_BLOCKED',
            'message': "Hisobni hozir o'chirib bo'lmaydi",
            'reasons': [
              {'code': 'ACTIVE_ORDER', 'message': 'Faol buyurtmangiz bor'},
              {'code': 'WALLET_DEBT', 'message': 'Qarzingiz bor'},
            ],
          },
        ),
      ),
    );

    final result = await build().deleteAccount();

    expect(result.deleted, isFalse);
    expect(result.reasons, ['Faol buyurtmangiz bor', 'Qarzingiz bor']);
    expect(storage.getToken(), 'access');
  });
}
