import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/driver/legal/legal_rejection.dart';
import 'package:angren_taxi/features/legal/legal_status.dart';
import 'package:angren_taxi/features/legal/legal_terms_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApi extends Mock implements ApiClient {}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _status({required bool termsPending, String? acceptedTerms}) => {
      'mustAccept': termsPending,
      'documents': [
        {
          'document': 'terms',
          'version': '2026-11-03.1',
          'acceptedVersion': acceptedTerms,
          'mustAccept': termsPending,
          'summary': {'uz': 'Birinchi tahrir', 'ru': 'Первая редакция'},
        },
        {
          'document': 'privacy',
          'version': '2026-10-29.1',
          'acceptedVersion': '2026-10-29.1',
          'mustAccept': false,
          'summary': {'uz': 'Maxfiylik', 'ru': 'Конфиденциальность'},
        },
      ],
    };

void main() {
  group('LegalStatus.tryParse', () {
    test('konvertdan o\'qiydi; faqat kutilayotganlar pending', () {
      final s = LegalStatus.tryParse({'success': true, 'data': _status(termsPending: true)})!;
      expect(s.mustAccept, isTrue);
      expect(s.pending.map((d) => d.document), ['terms']);
      expect(s.isUpdate, isFalse, reason: 'ilgari hech qaysi tahrir qabul qilinmagan');
      expect(s.pending.single.summaryFor('ru'), 'Первая редакция');
      expect(s.pending.single.summaryFor('uz'), 'Birinchi tahrir');
    });

    test('eski tahrir qabul qilingan — "yangilandi"', () {
      final s = LegalStatus.tryParse(_status(termsPending: true, acceptedTerms: '2000-01-01.1'))!;
      expect(s.isUpdate, isTrue);
    });

    test('noto\'g\'ri javob — null yoki bo\'sh', () {
      expect(LegalStatus.tryParse('x'), isNull);
      expect(LegalStatus.tryParse({'documents': 'x'})!.documents, isEmpty);
    });
  });

  group('LegalTermsService', () {
    late _MockApi api;
    setUp(() => api = _MockApi());

    test('accept: aynan versiyalar va manba bilan yuboradi', () async {
      when(() => api.post(ApiEndpoints.legalAcceptance, data: any(named: 'data')))
          .thenAnswer((_) async => _ok(_status(termsPending: false, acceptedTerms: '2026-11-03.1')));
      final pending = LegalStatus.tryParse(_status(termsPending: true))!.pending;

      final result = await LegalTermsService(api).accept(pending, source: 'login');

      expect(result!.mustAccept, isFalse);
      verify(() => api.post(ApiEndpoints.legalAcceptance, data: {
            'source': 'login',
            'items': [
              {'document': 'terms', 'version': '2026-11-03.1'},
            ],
          })).called(1);
    });

    test('kirishda: kutilayotgan hujjatlar login manbasi bilan yoziladi', () async {
      when(() => api.get(ApiEndpoints.legalAcceptance)).thenAnswer((_) async => _ok(_status(termsPending: true)));
      when(() => api.post(ApiEndpoints.legalAcceptance, data: any(named: 'data')))
          .thenAnswer((_) async => _ok(_status(termsPending: false)));

      await LegalTermsService(api).acceptPendingAtLogin();

      final data = verify(() => api.post(ApiEndpoints.legalAcceptance, data: captureAny(named: 'data')))
          .captured
          .single as Map;
      expect(data['source'], 'login');
    });

    test('kirishda: kutilayotgan yo\'q — POST yuborilmaydi', () async {
      when(() => api.get(ApiEndpoints.legalAcceptance)).thenAnswer((_) async => _ok(_status(termsPending: false)));
      await LegalTermsService(api).acceptPendingAtLogin();
      verifyNever(() => api.post(any(), data: any(named: 'data')));
    });

    test('kirishda: tarmoq xatosi yutiladi (kirish buzilmaydi)', () async {
      when(() => api.get(ApiEndpoints.legalAcceptance)).thenThrow(Exception('offline'));
      await expectLater(LegalTermsService(api).acceptPendingAtLogin(), completes);
    });
  });

  test('ilova turiga mos oferta havolasi', () {
    expect(primaryTermsDocument(AppFlavor.passenger), LegalDocumentCode.terms);
    expect(primaryTermsDocument(AppFlavor.driver), LegalDocumentCode.driverTerms);
    expect(legalDocumentUri('driver-terms').path, endsWith('/legal/driver-terms'));
  });

  test('LEGAL_TERMS_NOT_ACCEPTED — haydovchi xatosi turi', () {
    expect(driverErrorKindForCode(ApiErrorCode.legalTermsNotAccepted), DriverErrorKind.termsNotAccepted);
  });
}
