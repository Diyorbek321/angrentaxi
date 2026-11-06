import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/legal/legal_acceptance_sheet.dart';
import 'package:angren_taxi/features/legal/legal_status.dart';
import 'package:angren_taxi/features/legal/legal_terms_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApi extends Mock implements ApiClient {}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _doc(String document, String version, {required bool pending, String? accepted}) => {
      'document': document,
      'version': version,
      'acceptedVersion': accepted,
      'mustAccept': pending,
      'summary': {'uz': 'Komissiya va jarimalar', 'ru': 'Комиссия и штрафы'},
    };

LegalStatus _pending({String version = '2026-11-03.1', String? accepted}) => LegalStatus.tryParse({
      'mustAccept': true,
      'documents': [_doc('driver-terms', version, pending: true, accepted: accepted)],
    })!;

void main() {
  late _MockApi api;
  setUp(() => api = _MockApi());

  Future<List<bool>> open(WidgetTester tester, LegalStatus status, {bool blocking = true, List<String>? opened}) async {
    final results = <bool>[];
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: kSupportedLocales,
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () async => results.add(await showLegalAcceptanceSheet(
              context,
              status: status,
              service: LegalTermsService(api),
              blocking: blocking,
              openDocument: (doc) async => opened?.add(doc),
            )),
            child: const Text('open'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return results;
  }

  testWidgets("yangilangan tahrir: sarlavha, nima o'zgardi, to'liq matn havolasi", (tester) async {
    final opened = <String>[];
    await open(tester, _pending(accepted: '2000-01-01.1'), opened: opened);

    final l10n = lookupAppLocalizations(const Locale('uz'));
    expect(find.text(l10n.ofrSheetTitleUpdated), findsOneWidget);
    expect(find.text(l10n.ofrDriverTermsLink), findsOneWidget);
    expect(find.text(l10n.ofrVersion('2026-11-03.1')), findsOneWidget);
    expect(find.textContaining('Komissiya va jarimalar'), findsOneWidget);

    await tester.tap(find.text(l10n.ofrReadFull));
    expect(opened, ['driver-terms']);
  });

  testWidgets('qabul qilish: server yozadi va oyna true bilan yopiladi', (tester) async {
    when(() => api.post(ApiEndpoints.legalAcceptance, data: any(named: 'data'))).thenAnswer(
      (_) async => _ok({
        'mustAccept': false,
        'documents': [_doc('driver-terms', '2026-11-03.1', pending: false, accepted: '2026-11-03.1')],
      }),
    );
    final results = await open(tester, _pending());

    await tester.tap(find.byKey(const Key('legalAcceptButton')));
    await tester.pumpAndSettle();

    expect(results, [true]);
    expect(find.byType(LegalAcceptanceSheet), findsNothing);
  });

  testWidgets("bloklovchi oyna orqaga tugmasi bilan yopilmaydi", (tester) async {
    await open(tester, _pending());
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byType(LegalAcceptanceSheet), findsOneWidget);
  });

  testWidgets('eskirgan versiya (409): holat qayta yuklanadi, xabar ko\'rsatiladi', (tester) async {
    when(() => api.post(ApiEndpoints.legalAcceptance, data: any(named: 'data'))).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 409,
          data: {'success': false, 'statusCode': 409, 'message': 'x', 'code': 'LEGAL_VERSION_OUTDATED'},
        ),
      ),
    );
    when(() => api.get(ApiEndpoints.legalAcceptance)).thenAnswer(
      (_) async => _ok({
        'mustAccept': true,
        'documents': [_doc('driver-terms', '2026-12-01.1', pending: true)],
      }),
    );
    await open(tester, _pending());

    await tester.tap(find.byKey(const Key('legalAcceptButton')));
    await tester.pumpAndSettle();

    final l10n = lookupAppLocalizations(const Locale('uz'));
    expect(find.text(l10n.ofrOutdatedReloaded), findsOneWidget);
    expect(find.text(l10n.ofrVersion('2026-12-01.1')), findsOneWidget);
  });

  testWidgets("bloklamaydigan oyna: \"Keyinroq\" false qaytaradi", (tester) async {
    final results = await open(tester, _pending(), blocking: false);
    await tester.tap(find.text(lookupAppLocalizations(const Locale('uz')).ofrLater));
    await tester.pumpAndSettle();
    expect(results, [false]);
  });
}
