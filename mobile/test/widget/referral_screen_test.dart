// Widget tests for the invite-a-friend bonus screen
// (mobile/lib/features/passenger/screens/referral_screen.dart), backed by
// backend/src/modules/referrals:
//   GET  /users/me/referral
//   POST /users/me/referral/apply
//
// ApiClient is mocked with mocktail — no real network call is made — same
// pattern as test/widget/checkout_payment_test.dart. Clipboard writes are
// captured via a mock handler on SystemChannels.platform since this
// codebase has no existing Clipboard-testing convention to follow.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/passenger/screens/referral_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

DioException _badRequest(String path, String message) {
  return DioException(
    requestOptions: RequestOptions(path: path),
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 400,
      data: {'success': false, 'message': message},
    ),
  );
}

const Map<String, dynamic> _referralInfoJson = {
  'referralCode': 'AB12CD',
  'referredCount': 3,
  'totalBonusEarned': 15000,
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  late MockApiClient apiClient;
  late List<MethodCall> clipboardCalls;

  setUp(() {
    apiClient = MockApiClient();
    clipboardCalls = [];

    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        clipboardCalls.add(call);
      }
      return null;
    });

    when(() => apiClient.get(ApiEndpoints.myReferralInfo)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.myReferralInfo, _referralInfoJson),
    );
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  Future<void> pumpReferralScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(home: ReferralScreen(apiClient: apiClient)),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows the referral code, referred count and total bonus',
      (tester) async {
    await pumpReferralScreen(tester);

    expect(find.text('AB12CD'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    // Formatters.formatSom groups thousands with a non-breaking space
    // (U+00A0), not a plain space — matching its own output here avoids
    // hardcoding that whitespace quirk into the test.
    expect(find.text(Formatters.formatSom(15000)), findsOneWidget);
  });

  testWidgets('tapping "Nusxalash" copies the referral code to the clipboard',
      (tester) async {
    await pumpReferralScreen(tester);

    await tester.tap(find.text('Nusxalash'));
    await tester.pumpAndSettle();

    final setDataCall = clipboardCalls.firstWhere(
      (call) => call.method == 'Clipboard.setData',
    );
    expect((setDataCall.arguments as Map)['text'], 'AB12CD');
    expect(find.text('Kod nusxalandi'), findsOneWidget);
  });

  testWidgets(
      'tapping "Ulashish" copies a pre-written invite message containing the code',
      (tester) async {
    await pumpReferralScreen(tester);

    await tester.tap(find.text('Ulashish'));
    await tester.pumpAndSettle();

    final setDataCall = clipboardCalls.firstWhere(
      (call) => call.method == 'Clipboard.setData',
    );
    final copiedText = (setDataCall.arguments as Map)['text'] as String;
    expect(copiedText, contains('AB12CD'));
  });

  testWidgets('applying a valid friend code shows a success confirmation',
      (tester) async {
    when(() => apiClient.post(
          ApiEndpoints.applyReferralCode,
          data: any(named: 'data'),
        )).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.applyReferralCode, {
        'id': 'caller-uuid',
        'phone': '+998900000000',
        'referralCode': 'CALLER1',
        'referredByUserId': 'referrer-uuid',
      }),
    );

    await pumpReferralScreen(tester);

    await tester.enterText(
      find.byType(TextField),
      'FRIEND1',
    );
    await tester.tap(find.text("Qo'llash"));
    await tester.pumpAndSettle();

    final captured = verify(() => apiClient.post(
          ApiEndpoints.applyReferralCode,
          data: captureAny(named: 'data'),
        )).captured;
    expect((captured.single as Map<String, dynamic>)['code'], 'FRIEND1');

    expect(
      find.text("Referral kodi muvaffaqiyatli qo'llandi"),
      findsOneWidget,
    );
    // The input form is replaced by the success banner.
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets(
      'applying an unknown code shows a clear "not found" error message',
      (tester) async {
    when(() => apiClient.post(
          ApiEndpoints.applyReferralCode,
          data: any(named: 'data'),
        )).thenThrow(_badRequest(
      ApiEndpoints.applyReferralCode,
      'Invalid referral code',
    ));

    await pumpReferralScreen(tester);

    await tester.enterText(find.byType(TextField), 'NOSUCH1');
    await tester.tap(find.text("Qo'llash"));
    await tester.pumpAndSettle();

    expect(find.text('Bunday referral kod topilmadi'), findsOneWidget);
    // Still shows the input form so the passenger can retry.
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets(
      'applying a self-referral code shows a clear "own code" error message',
      (tester) async {
    when(() => apiClient.post(
          ApiEndpoints.applyReferralCode,
          data: any(named: 'data'),
        )).thenThrow(_badRequest(
      ApiEndpoints.applyReferralCode,
      'You cannot use your own referral code',
    ));

    await pumpReferralScreen(tester);

    await tester.enterText(find.byType(TextField), 'AB12CD');
    await tester.tap(find.text("Qo'llash"));
    await tester.pumpAndSettle();

    expect(
      find.text("O'zingizning kodingizni qo'llay olmaysiz"),
      findsOneWidget,
    );
  });

  testWidgets(
      'applying when the account already has a referrer shows a clear "already applied" error',
      (tester) async {
    when(() => apiClient.post(
          ApiEndpoints.applyReferralCode,
          data: any(named: 'data'),
        )).thenThrow(_badRequest(
      ApiEndpoints.applyReferralCode,
      'A referral code has already been applied to this account',
    ));

    await pumpReferralScreen(tester);

    await tester.enterText(find.byType(TextField), 'FRIEND2');
    await tester.tap(find.text("Qo'llash"));
    await tester.pumpAndSettle();

    expect(
      find.text("Sizda allaqachon referral kodi qo'llangan"),
      findsOneWidget,
    );
  });

  testWidgets('a failed GET /users/me/referral shows an error with retry',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.myReferralInfo)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.myReferralInfo),
        type: DioExceptionType.connectionError,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(home: ReferralScreen(apiClient: apiClient)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Qayta urinish'), findsOneWidget);
    // Never got far enough to render the referral code.
    expect(find.text('AB12CD'), findsNothing);
  });
}
