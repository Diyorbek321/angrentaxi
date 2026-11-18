// Karta bog'lash ekrani: raqam + muddat → Payme SMS → tasdiq → serverga token.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/saved_cards_service.dart';
import 'package:angren_taxi/features/payments/screens/add_card_screen.dart';
import 'package:angren_taxi/features/payments/state/saved_cards_provider.dart';
import 'package:angren_taxi/shared/models/saved_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApi extends Mock implements ApiClient {}

class _MockDio extends Mock implements Dio {}

Response<dynamic> _ok(dynamic data) =>
    Response<dynamic>(requestOptions: RequestOptions(path: '/'), statusCode: 200, data: data);

void main() {
  setUpAll(() => registerFallbackValue(Options()));

  late _MockApi api;
  late _MockDio payme;
  late SavedCardsProvider provider;
  SavedCard? popped;

  setUp(() async {
    api = _MockApi();
    payme = _MockDio();
    provider = SavedCardsProvider(service: SavedCardsService(apiClient: api, paymeDio: payme));
    popped = null;
    when(() => api.get(ApiEndpoints.savedCardsAvailability)).thenAnswer((_) async => _ok({
          'data': {'enabled': true, 'merchantId': 'mid', 'apiUrl': 'https://checkout.test.paycom.uz/api'}
        }));
    when(() => api.get(ApiEndpoints.savedCards)).thenAnswer((_) async => _ok({'data': <dynamic>[]}));
    await provider.load();

    when(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')))
        .thenAnswer((inv) async {
      final method = (inv.namedArguments[#data] as Map)['method'];
      return switch (method) {
        'cards.create' => _ok({
            'result': {
              'card': {'token': 'tok-1'}
            }
          }),
        'cards.get_verify_code' => _ok({
            'result': {'sent': true, 'phone': '99890*****31', 'wait': 60000}
          }),
        'cards.verify' => _ok({
            'result': {
              'card': {'token': 'tok-1', 'verify': true}
            }
          }),
        _ => _ok({'error': {'code': -1, 'message': 'unexpected'}}),
      };
    });
    when(() => api.post(ApiEndpoints.savedCards, data: any(named: 'data'))).thenAnswer((_) async => _ok({
          'data': {'id': 'c1', 'maskedPan': '8600 **** **** 9012', 'cardBrand': 'uzcard', 'isDefault': true}
        }));
  });

  Future<void> pump(WidgetTester tester) async {
    tester.view.physicalSize = const Size(412 * 3, 915 * 3);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ChangeNotifierProvider<SavedCardsProvider>.value(
        value: provider,
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  popped = await Navigator.of(context).push<SavedCard>(
                    MaterialPageRoute(builder: (_) => const AddCardScreen()),
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('validates input before calling Payme', (tester) async {
    await pump(tester);
    await tester.enterText(find.byKey(const Key('add-card-number')), '8600 1234');
    await tester.enterText(find.byKey(const Key('add-card-expiry')), '13/29');
    await tester.tap(find.byKey(const Key('add-card-continue')));
    await tester.pumpAndSettle();

    expect(find.text('16 xonali karta raqamini kiriting'), findsOneWidget);
    expect(find.text("Muddatni OO/YY ko'rinishida kiriting"), findsOneWidget);
    verifyNever(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')));
  });

  testWidgets('full flow binds the card and saves only the token', (tester) async {
    await pump(tester);
    await tester.enterText(find.byKey(const Key('add-card-number')), '8600123456789012');
    await tester.enterText(find.byKey(const Key('add-card-expiry')), '1229');
    await tester.tap(find.byKey(const Key('add-card-continue')));
    await tester.pumpAndSettle();

    expect(find.text('Kod 99890*****31 raqamiga yuborildi'), findsOneWidget);
    final createBody = verify(() => payme.post<dynamic>(any(), data: captureAny(named: 'data'), options: any(named: 'options')))
        .captured
        .first as Map;
    expect(createBody['params'], {
      'card': {'number': '8600123456789012', 'expire': '1229'},
      'save': true,
    });

    await tester.enterText(find.byKey(const Key('add-card-code')), '666666');
    await tester.tap(find.byKey(const Key('add-card-confirm')));
    await tester.pumpAndSettle();

    verify(() => api.post(ApiEndpoints.savedCards, data: {'token': 'tok-1'})).called(1);
    expect(popped?.id, 'c1');
    expect(provider.defaultCard?.id, 'c1');
  });

  testWidgets('a Payme rejection is shown and keeps the user on the form', (tester) async {
    when(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')))
        .thenAnswer((_) async => _ok({
              'error': {'code': -31300, 'message': {'uz': "Karta topilmadi"}}
            }));
    await pump(tester);
    await tester.enterText(find.byKey(const Key('add-card-number')), '8600123456789012');
    await tester.enterText(find.byKey(const Key('add-card-expiry')), '1229');
    await tester.tap(find.byKey(const Key('add-card-continue')));
    await tester.pumpAndSettle();

    expect(find.text('Karta topilmadi'), findsOneWidget);
    expect(find.byKey(const Key('add-card-number')), findsOneWidget);
  });
}
