import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/incidents/incidents_service.dart';
import 'package:angren_taxi/features/incidents/screens/my_incidents_screen.dart';
import 'package:angren_taxi/features/incidents/screens/report_incident_screen.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/incident.dart';
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

Widget _app(Widget home) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: kSupportedLocales,
      home: home,
    );

void main() {
  late _MockApi api;
  setUp(() => api = _MockApi());

  group('ReportIncidentScreen', () {
    // Forma uzun — hamma maydon bitta ekranda chizilsin.
    setUp(() {
      final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
      view.physicalSize = const Size(1200, 3200);
      view.devicePixelRatio = 1;
    });
    tearDown(() {
      final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
      view.resetPhysicalSize();
      view.resetDevicePixelRatio();
    });

    testWidgets("haydovchi: sabab + matn → POST, faqat haydovchi sabablari", (tester) async {
      when(() => api.post(ApiEndpoints.incidents, data: any(named: 'data'))).thenAnswer((_) async => _ok({'id': 'inc-1'}));
      await tester.pumpWidget(_app(ReportIncidentScreen(
        service: IncidentsService(api),
        args: const IncidentReportArgs(vertical: 'taxi', orderId: 'o1', side: IncidentReporterSide.driver),
      )));
      expect(find.byKey(const ValueKey('incident-category-drunk_passenger')), findsOneWidget);
      expect(find.byKey(const ValueKey('incident-category-detour')), findsNothing);

      await tester.tap(find.byKey(const ValueKey('incident-category-drunk_passenger')));
      await tester.enterText(find.byKey(const ValueKey('incident-description')), "Mast edi, o'rindiqni bulg'adi");
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('incident-submit')));
      await tester.pumpAndSettle();

      final body = verify(() => api.post(ApiEndpoints.incidents, data: captureAny(named: 'data'))).captured.single as Map;
      expect(body['category'], 'drunk_passenger');
      expect(body['vertical'], 'taxi');
      expect(body.containsKey('subject'), isFalse);
    });

    testWidgets('faol safar — faqat xavfsizlik sabablari va ogohlantirish', (tester) async {
      await tester.pumpWidget(_app(ReportIncidentScreen(
        service: IncidentsService(api),
        args: const IncidentReportArgs(
          vertical: 'taxi',
          orderId: 'o1',
          side: IncidentReporterSide.customer,
          safetyOnly: true,
        ),
      )));
      expect(find.byType(ChoiceChip), findsNWidgets(2));
      expect(find.textContaining('102'), findsOneWidget);
    });

    testWidgets('sabab tanlanmaguncha yuborilmaydi; server xatosi ko\'rinadi', (tester) async {
      when(() => api.post(ApiEndpoints.incidents, data: any(named: 'data'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 409,
          data: {'code': 'INCIDENT_ALREADY_OPEN', 'message': "Bu buyurtma bo'yicha murojaatingiz ko'rib chiqilmoqda"},
        ),
      ));
      await tester.pumpWidget(_app(ReportIncidentScreen(
        service: IncidentsService(api),
        args: const IncidentReportArgs(vertical: 'food', orderId: 'f1', side: IncidentReporterSide.customer),
      )));
      await tester.enterText(find.byKey(const ValueKey('incident-description')), 'Sovuq keldi');
      await tester.tap(find.byKey(const ValueKey('incident-submit')));
      await tester.pump();
      verifyNever(() => api.post(any(), data: any(named: 'data')));

      await tester.tap(find.byKey(const ValueKey('incident-category-cold_food')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('incident-submit')));
      await tester.pumpAndSettle();
      expect(find.textContaining("ko'rib chiqilmoqda"), findsOneWidget);
    });
  });

  group('MyIncidentsScreen', () {
    void stub({required bool canAppeal}) {
      when(() => api.get(ApiEndpoints.myIncidents)).thenAnswer((_) async => _ok([
            {
              'id': 'r1',
              'category': 'rude',
              'description': "Qo'pol gapirdi",
              'status': 'resolved',
              'resolutionNote': 'Haydovchi ogohlantirildi',
              'refundAmount': 5000,
              'createdAt': '2026-11-03T10:00:00Z',
            },
          ]));
      when(() => api.get(ApiEndpoints.incidentsAboutMe)).thenAnswer((_) async => _ok({
            'suspension': {'until': '2026-11-06T10:00:00Z', 'reason': 'Kelmadi'},
            'items': [
              {
                'id': 's1',
                'category': 'no_show',
                'status': 'resolved',
                'resolutionNote': 'Kelmadi',
                'outcomes': [
                  {'type': 'suspension', 'days': 3, 'until': '2026-11-06T10:00:00Z'},
                ],
                'appeal': {'canAppeal': canAppeal, 'deadline': '2026-11-11T10:00:00Z'},
              },
            ],
          }));
    }

    testWidgets("shikoyatlarim: qaror va qaytarilgan summa", (tester) async {
      stub(canAppeal: true);
      await tester.pumpWidget(_app(MyIncidentsScreen(service: IncidentsService(api))));
      await tester.pumpAndSettle();
      expect(find.textContaining('Haydovchi ogohlantirildi'), findsOneWidget);
      expect(find.textContaining('qaytarildi'), findsOneWidget);
    });

    testWidgets("menga nisbatan: to'xtatish banneri, e'tiroz yuboriladi", (tester) async {
      stub(canAppeal: true);
      when(() => api.post(ApiEndpoints.incidentAppeal('s1'), data: any(named: 'data'))).thenAnswer((_) async => _ok({}));
      await tester.pumpWidget(_app(MyIncidentsScreen(service: IncidentsService(api), initialTab: 1)));
      await tester.pumpAndSettle();
      expect(find.textContaining("to'xtatilgan"), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('incident-appeal-s1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('incident-appeal-note')), 'Yo\'lovchi o\'zi chiqmadi');
      await tester.tap(find.text('Yuborish'));
      await tester.pumpAndSettle();
      verify(() => api.post(ApiEndpoints.incidentAppeal('s1'), data: {'note': "Yo'lovchi o'zi chiqmadi"})).called(1);
      expect(find.byKey(const ValueKey('incident-appeal-s1')), findsNothing);
      expect(find.textContaining("E'tiroz admin"), findsOneWidget);
    });

    testWidgets("muddat o'tgan — e'tiroz tugmasi yo'q", (tester) async {
      stub(canAppeal: false);
      await tester.pumpWidget(_app(MyIncidentsScreen(service: IncidentsService(api), initialTab: 1)));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('incident-appeal-s1')), findsNothing);
    });
  });
}
