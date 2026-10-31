// OTP ekrani yopilganda xato bermasligi kerak: controller'ni ekran o'zi
// yopadi, `pin_code_fields` ham yopsa — "used after being disposed".
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/auth/screens/otp_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  testWidgets('OTP ekrani yopilganda xato yo\'q', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final auth = AuthProvider(
      apiClient: _MockApiClient(),
      localStorage: LocalStorage(await SharedPreferences.getInstance()),
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>.value(
        value: auth,
        child: const MaterialApp(home: OtpScreen()),
      ),
    );
    await tester.pump();

    // Ekranni daraxtdan olib tashlash — `dispose` ishlaydi.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 1));

    expect(tester.takeException(), isNull);
  });
}
