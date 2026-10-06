import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApi extends Mock implements ApiClient {}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _login(String role) => {
      'accessToken': 'access-$role',
      'refreshToken': 'refresh-$role',
      'user': {'id': 'u-1', 'phone': '+998901234572', 'role': role},
    };

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
    api = _MockApi();
    when(() => api.post(ApiEndpoints.sendOtp, data: any(named: 'data')))
        .thenAnswer((_) async => _ok({'message': 'ok'}));
    when(() => api.post(ApiEndpoints.logout, data: any(named: 'data')))
        .thenAnswer((_) async => _ok(null));
  });

  AuthProvider build(AppFlavor flavor) => AuthProvider(
        apiClient: api,
        localStorage: storage,
        socketService: SocketService(),
        navigatorKey: GlobalKey<NavigatorState>(),
        flavor: flavor,
      );

  Future<bool> loginAs(AuthProvider auth, String role) async {
    when(() => api.post(ApiEndpoints.verifyOtp, data: any(named: 'data')))
        .thenAnswer((_) async => _ok(_login(role)));
    await auth.sendOtp('+998901234572');
    return auth.verifyOtp('123456');
  }

  test('a driver number is turned away from the passenger app, nothing is kept', () async {
    final auth = build(AppFlavor.passenger);

    expect(await loginAs(auth, 'driver'), isFalse);

    expect(auth.isAuthenticated, isFalse);
    expect(auth.error, AppL10n.current.authWrongAppDriver);
    expect(storage.getToken(), isNull);
    expect(storage.getUser(), isNull);
    // The token pair the server just issued is revoked.
    verify(() => api.post(ApiEndpoints.logout, data: {'refreshToken': 'refresh-driver'})).called(1);
  });

  test('staff accounts are turned away from both apps', () async {
    expect(await loginAs(build(AppFlavor.passenger), 'admin'), isFalse);
    final driverApp = build(AppFlavor.driver);
    expect(await loginAs(driverApp, 'restaurant'), isFalse);
    expect(driverApp.error, AppL10n.current.authWrongAppStaff);
  });

  test('the right roles sign in as before', () async {
    final passenger = build(AppFlavor.passenger);
    expect(await loginAs(passenger, 'passenger'), isTrue);
    expect(storage.getToken(), 'access-passenger');

    // A passenger may open the driver app — that is where they apply.
    expect(await loginAs(build(AppFlavor.driver), 'passenger'), isTrue);
    expect(await loginAs(build(AppFlavor.driver), 'driver'), isTrue);
  });

  test('a stored session of the wrong role is cleared on start', () async {
    await storage.saveTokens(accessToken: 'old', refreshToken: 'old-r');
    await storage.saveUser({'id': 'u-1', 'phone': '+998901234572', 'role': 'driver'});

    final auth = build(AppFlavor.passenger);
    await auth.initialize();

    expect(auth.isAuthenticated, isFalse);
    expect(storage.getToken(), isNull);
  });
}
