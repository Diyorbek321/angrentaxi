// Haydovchi hamyoni — qoldiq QAYSI manbadan o'qilishi haqidagi testlar.
//
// NEGA bu fayl bor. Ilgari haydovchi ekrani `Driver.balance` ustunini
// ko'rsatardi va yechish summasini ham o'shanga solishtirardi. Server esa
// yechishni butunlay boshqa raqamga — tranzaksiyalar daftariga — qarab
// tekshirardi. Ikkalasi bir xil emas: yechib olish daftarni debetlaydi,
// ustunga tegmaydi, ya'ni birinchi yechishdan keyin ular abadiy ajralib
// ketardi. Haydovchi ilovada 500 000 ko'rib "yechish" bosardi va serverdan
// "summa balansdan oshdi" javobini olardi.
//
// Endi yagona manba — `GET /payments/wallet`.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
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

  void stubWallet(num balance) {
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.paymentsWallet,
        {'userId': 'user-1', 'balance': balance},
      ),
    );
  }

  group('loadWalletBalance', () {
    test('daftardagi qoldiqni o\'qiydi', () async {
      stubWallet(125000);

      await provider.loadWalletBalance();

      expect(provider.walletBalance, 125000);
      expect(provider.hasWalletDebt, isFalse);
    });

    test('MANFIY qoldiq qarz deb o\'qiladi', () async {
      // Bitta hisob modeli: naqd safarlar komissiyasi qoldiqni minusga
      // olib tushadi. Ilgari server qiymatni 0 ga qirqardi, ya'ni qarz
      // umuman ko'rinmasdi.
      stubWallet(-12000);

      await provider.loadWalletBalance();

      expect(provider.walletBalance, -12000);
      expect(provider.hasWalletDebt, isTrue);
    });

    test('nol qoldiq qarz EMAS', () async {
      stubWallet(0);

      await provider.loadWalletBalance();

      expect(provider.hasWalletDebt, isFalse);
    });

    test("o'qilmagan qoldiq `null` — nol EMAS", () {
      // Nol ko'rsatish "puling yo'q" degan yolg'on bo'lardi; ekran shu
      // farqqa qarab blokni umuman chizmaydi.
      expect(provider.walletBalance, isNull);
    });

    test("so'rov yiqilsa oldingi qiymat SAQLANADI", () async {
      stubWallet(80000);
      await provider.loadWalletBalance();

      when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenThrow(
        DioException(requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet)),
      );
      await provider.loadWalletBalance();

      // Bir marta yiqilgan so'rov tufayli summani nolga tushirish yoki
      // yo'q qilish haydovchida pul yo'qolgandek taassurot qoldirardi.
      expect(provider.walletBalance, 80000);
    });

    test('raqamsiz javob qoldiqni buzmaydi', () async {
      stubWallet(50000);
      await provider.loadWalletBalance();

      when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.paymentsWallet, {'userId': 'user-1'}),
      );
      await provider.loadWalletBalance();

      expect(provider.walletBalance, 50000);
    });
  });

  group('requestWithdrawal qoldiqqa ta\'siri', () {
    setUp(() {
      when(() => apiClient.post(
            ApiEndpoints.walletWithdraw,
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.walletWithdraw, {
          'id': 'wd-1',
          'driverId': 'user-1',
          'amount': 30000,
          'status': 'pending',
          'payoutDestination': 'card-1234',
          'requestedAt': '2026-08-19T10:00:00.000Z',
        }),
      );
    });

    test('muvaffaqiyatli so\'rovdan keyin qoldiq DARHOL kamayadi', () async {
      // Server so'rov paytida ushlab qolish (DEBIT) yozadi, ya'ni qoldiq
      // shu zahoti kamayadi. Ekranda eski summa qolsa, haydovchi o'sha
      // pulni yana yechmoqchi bo'lib rad javobini olardi.
      stubWallet(100000);
      await provider.loadWalletBalance();

      await provider.requestWithdrawal(
        amount: 30000,
        payoutDestination: 'card-1234',
      );

      expect(provider.walletBalance, 70000);
    });

    test('yiqilgan so\'rov qoldiqqa TEGMAYDI', () async {
      stubWallet(100000);
      await provider.loadWalletBalance();

      when(() => apiClient.post(
            ApiEndpoints.walletWithdraw,
            data: any(named: 'data'),
          )).thenThrow(
        DioException(requestOptions: RequestOptions(path: ApiEndpoints.walletWithdraw)),
      );

      final ok = await provider.requestWithdrawal(
        amount: 30000,
        payoutDestination: 'card-1234',
      );

      expect(ok, isFalse);
      expect(provider.walletBalance, 100000);
    });
  });
}
