// Saqlangan kartalar (docs/specs/saqlangan-kartalar.md v2): model, servis
// (server + Payme), provider. Asosiy xususiyat — karta raqami bizning
// serverga hech qachon yuborilmaydi va JWT Payme'ga ketmaydi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/saved_cards_service.dart';
import 'package:angren_taxi/features/payments/screens/add_card_screen.dart';
import 'package:angren_taxi/features/payments/state/saved_cards_provider.dart';
import 'package:angren_taxi/shared/models/saved_card.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApi extends Mock implements ApiClient {}

class _MockDio extends Mock implements Dio {}

Response<dynamic> _ok(String path, dynamic data) =>
    Response<dynamic>(requestOptions: RequestOptions(path: path), statusCode: 200, data: data);

const _config = SavedCardsAvailability(
  enabled: true,
  merchantId: 'mid',
  apiUrl: 'https://checkout.test.paycom.uz/api',
);

Map<String, dynamic> _cardJson({String id = 'c1', bool isDefault = true}) => {
      'id': id,
      'provider': 'payme',
      'maskedPan': '8600 **** **** 6311',
      'cardBrand': 'uzcard',
      'expiry': '03/29',
      'isDefault': isDefault,
    };

void main() {
  setUpAll(() => registerFallbackValue(Options()));

  group('SavedCard', () {
    test('parses and exposes last four / brand', () {
      final card = SavedCard.fromJson(_cardJson());
      expect(card.lastFour, '6311');
      expect(card.brandLabel, 'Uzcard');
      expect(card.isDefault, isTrue);
    });
  });

  group('SavedCardsAvailability.fromJson', () {
    test('enabled only with merchant id and an https URL', () {
      expect(
        SavedCardsAvailability.fromJson(
            {'enabled': true, 'merchantId': 'mid', 'apiUrl': 'https://x/api'}).enabled,
        isTrue,
      );
      expect(
        SavedCardsAvailability.fromJson(
            {'enabled': true, 'merchantId': 'mid', 'apiUrl': 'http://x/api'}).enabled,
        isFalse,
      );
      expect(SavedCardsAvailability.fromJson({'enabled': true, 'apiUrl': 'https://x'}).enabled, isFalse);
      expect(SavedCardsAvailability.fromJson({'enabled': false}).enabled, isFalse);
    });
  });

  group('card input normalisation', () {
    test('card number needs exactly 16 digits', () {
      expect(normalizeCardNumber('8600 1234 5678 9012'), '8600123456789012');
      expect(normalizeCardNumber('8600 1234'), isNull);
    });

    test('expiry becomes MMYY with a real month', () {
      expect(normalizeCardExpiry('03/29'), '0329');
      expect(normalizeCardExpiry('13/29'), isNull);
      expect(normalizeCardExpiry('00/29'), isNull);
      expect(normalizeCardExpiry('3/2'), isNull);
    });

    test('formatters group digits and insert the slash', () {
      final number = CardNumberFormatter().formatEditUpdate(
        TextEditingValue.empty,
        const TextEditingValue(text: '86001234567890129999'),
      );
      expect(number.text, '8600 1234 5678 9012');
      final expiry = CardExpiryFormatter().formatEditUpdate(
        TextEditingValue.empty,
        const TextEditingValue(text: '0329'),
      );
      expect(expiry.text, '03/29');
    });
  });

  group('SavedCardsService', () {
    late _MockApi api;
    late _MockDio payme;
    late SavedCardsService service;

    setUp(() {
      api = _MockApi();
      payme = _MockDio();
      service = SavedCardsService(apiClient: api, paymeDio: payme);
    });

    test('availability falls back to disabled on any error (old server)', () async {
      when(() => api.get(ApiEndpoints.savedCardsAvailability)).thenThrow(Exception('404'));
      expect((await service.availability()).enabled, isFalse);
    });

    test('card number goes to Payme with the public merchant id, never to our API', () async {
      when(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')))
          .thenAnswer((_) async => _ok('/', {
                'result': {
                  'card': {'token': 'tok-1'}
                }
              }));

      final token = await service.paymeCreateCard(_config, number: '8600123456789012', expire: '0329');

      expect(token, 'tok-1');
      final captured = verify(() => payme.post<dynamic>(
            captureAny(),
            data: captureAny(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;
      expect(captured[0], 'https://checkout.test.paycom.uz/api');
      expect((captured[1] as Map)['method'], 'cards.create');
      expect((captured[2] as Options).headers, {'X-Auth': 'mid'});
      verifyNever(() => api.post(any(), data: any(named: 'data')));
    });

    test('Payme errors surface their localized message', () async {
      when(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')))
          .thenAnswer((_) async => _ok('/', {
                'error': {
                  'code': -31300,
                  'message': {'uz': 'Karta raqami noto\'g\'ri', 'ru': 'Неверный номер'}
                }
              }));
      expect(
        () => service.paymeCreateCard(_config, number: '8600123456789012', expire: '0329'),
        throwsA(isA<SavedCardsException>().having((e) => e.message, 'message', "Karta raqami noto'g'ri")),
      );
    });

    test('a network failure never echoes the request body (card number)', () async {
      when(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')))
          .thenThrow(DioException(
        requestOptions: RequestOptions(path: '/', data: {'number': '8600123456789012'}),
        type: DioExceptionType.connectionTimeout,
      ));
      try {
        await service.paymeCreateCard(_config, number: '8600123456789012', expire: '0329');
        fail('should throw');
      } on SavedCardsException catch (e) {
        expect(e.message, isNot(contains('8600')));
      }
    });

    test('verify rejects an unverified card', () async {
      when(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')))
          .thenAnswer((_) async => _ok('/', {
                'result': {
                  'card': {'token': 'tok-1', 'verify': false}
                }
              }));
      expect(
        () => service.paymeVerify(_config, token: 'tok-1', code: '123456'),
        throwsA(isA<SavedCardsException>()),
      );
    });

    test('Payme calls refuse to run while the feature is disabled', () async {
      expect(
        () => service.paymeCreateCard(const SavedCardsAvailability.disabled(), number: '8600123456789012', expire: '0329'),
        throwsA(isA<SavedCardsException>()),
      );
      verifyNever(() => payme.post<dynamic>(any(), data: any(named: 'data'), options: any(named: 'options')));
    });

    test('save sends only the token to our API', () async {
      when(() => api.post(ApiEndpoints.savedCards, data: any(named: 'data')))
          .thenAnswer((_) async => _ok(ApiEndpoints.savedCards, {'data': _cardJson()}));
      final card = await service.save('tok-1');
      expect(card.id, 'c1');
      verify(() => api.post(ApiEndpoints.savedCards, data: {'token': 'tok-1'})).called(1);
    });

    test('server errors carry the machine code', () async {
      final options = RequestOptions(path: ApiEndpoints.savedCards);
      when(() => api.post(ApiEndpoints.savedCards, data: any(named: 'data'))).thenThrow(DioException(
        requestOptions: options,
        response: Response(
          requestOptions: options,
          statusCode: 400,
          data: {'success': false, 'message': 'Too many saved cards', 'code': 'SAVED_CARD_LIMIT'},
        ),
      ));
      expect(
        () => service.save('tok-1'),
        throwsA(isA<SavedCardsException>().having((e) => e.code, 'code', 'SAVED_CARD_LIMIT')),
      );
    });
  });

  group('SavedCardsProvider', () {
    late _MockApi api;
    late SavedCardsProvider provider;

    setUp(() {
      api = _MockApi();
      provider = SavedCardsProvider(service: SavedCardsService(apiClient: api, paymeDio: _MockDio()));
    });

    test('does not list cards while disabled', () async {
      when(() => api.get(ApiEndpoints.savedCardsAvailability))
          .thenAnswer((_) async => _ok('/', {'data': {'enabled': false}}));
      await provider.load();
      expect(provider.isEnabled, isFalse);
      expect(provider.cards, isEmpty);
      verifyNever(() => api.get(ApiEndpoints.savedCards));
    });

    test('loads cards and exposes the default one', () async {
      when(() => api.get(ApiEndpoints.savedCardsAvailability)).thenAnswer((_) async => _ok('/', {
            'data': {'enabled': true, 'merchantId': 'mid', 'apiUrl': 'https://x/api'}
          }));
      when(() => api.get(ApiEndpoints.savedCards)).thenAnswer((_) async => _ok('/', {
            'data': [_cardJson(id: 'a', isDefault: false), _cardJson(id: 'b')]
          }));
      await provider.load();
      expect(provider.isEnabled, isTrue);
      expect(provider.defaultCard?.id, 'b');
    });

    test('adding a default card demotes the previous one', () {
      provider
        ..addCard(SavedCard.fromJson(_cardJson(id: 'a')))
        ..addCard(SavedCard.fromJson(_cardJson(id: 'b')));
      expect(provider.cards.where((c) => c.isDefault).map((c) => c.id), ['b']);
    });

    test('setDefault flips the flag locally after the server accepts', () async {
      provider
        ..addCard(SavedCard.fromJson(_cardJson(id: 'a')))
        ..addCard(SavedCard.fromJson(_cardJson(id: 'b', isDefault: false)));
      when(() => api.patch(ApiEndpoints.savedCardDefault('b')))
          .thenAnswer((_) async => _ok('/', {'data': _cardJson(id: 'b')}));
      await provider.setDefault('b');
      expect(provider.defaultCard?.id, 'b');
    });
  });
}
