// Shikoyat va hodisa (docs/INCIDENT-POLICY.md §3): server kontrakti
// (backend/src/modules/incidents), sabab ro'yxatlari, kodli xatolar, push.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/core/push/push_tap_router.dart';
import 'package:angren_taxi/features/driver/legal/legal_rejection.dart';
import 'package:angren_taxi/features/incidents/incident_entry_points.dart';
import 'package:angren_taxi/features/incidents/incident_labels.dart';
import 'package:angren_taxi/features/incidents/incidents_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/incident.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApi extends Mock implements ApiClient {}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

DioException _error(int status, Map<String, dynamic> body) => DioException(
      requestOptions: RequestOptions(path: '/'),
      response: Response<dynamic>(requestOptions: RequestOptions(path: '/'), statusCode: status, data: body),
    );

void main() {
  group('sabablar', () {
    test("yo'lovchi taksida — xavfli haydash bor, mast yo'lovchi yo'q", () {
      final list = IncidentCategory.forReport(side: IncidentReporterSide.customer, vertical: 'taxi');
      expect(list, contains(IncidentCategory.dangerousDriving));
      expect(list, isNot(contains(IncidentCategory.drunkPassenger)));
    });

    test("haydovchi — mast, zarar, to'lamadi, kelmadi", () {
      final list = IncidentCategory.forReport(side: IncidentReporterSide.driver, vertical: 'taxi');
      expect(list, containsAll(['drunk_passenger', 'vehicle_damage', 'did_not_pay', 'no_show', 'rude', 'harassment', 'safety', 'other']));
      expect(list, isNot(contains(IncidentCategory.detour)));
    });

    test('ovqat/market — sovuq ovqat, noto\'g\'ri tovar', () {
      final list = IncidentCategory.forReport(side: IncidentReporterSide.customer, vertical: 'food');
      expect(list, containsAll(['cold_food', 'wrong_items']));
    });

    test('faol safar — faqat xavfsizlik', () {
      expect(
        IncidentCategory.forReport(side: IncidentReporterSide.customer, vertical: 'taxi', safetyOnly: true),
        ['harassment', 'safety'],
      );
    });

    test('noma\'lum kod — «Boshqa»', () {
      final l10n = lookupAppLocalizations(kDefaultLocale);
      expect(incidentCategoryLabel(l10n, 'future_code'), l10n.incCatOther);
      expect(incidentCategoryLabel(l10n, 'cold_food'), 'Sovuq ovqat');
    });
  });

  group('modellar', () {
    test('ReporterIncident — natija va qaytarilgan summa', () {
      final i = ReporterIncident.fromJson({
        'id': 'i1',
        'vertical': 'taxi',
        'orderId': 'o1',
        'category': 'rude',
        'description': "Qo'pol",
        'status': 'resolved',
        'photoCount': 2,
        'resolutionNote': 'Tasdiqlandi',
        'refundAmount': 3000,
        'createdAt': '2026-11-03T10:00:00.000Z',
        'resolvedAt': '2026-11-04T10:00:00.000Z',
      });
      expect(i.status, IncidentStatus.resolved);
      expect(i.isClosed, isTrue);
      expect(i.refundAmount, 3000);
      expect(i.photoCount, 2);
    });

    test('IncidentAboutMe — to\'xtatish, choralar, e\'tiroz holati', () {
      final me = IncidentAboutMe.fromJson({
        'suspension': {'until': '2026-11-06T10:00:00.000Z', 'reason': "Qo'pollik"},
        'items': [
          {
            'id': 'i1',
            'category': 'rude',
            'status': 'resolved',
            'resolutionNote': "Qo'pollik",
            'outcomes': [
              {'type': 'suspension', 'days': 3, 'until': '2026-11-06T10:00:00.000Z'},
              {'type': 'penalty', 'amount': 10000},
            ],
            'safetySuspended': false,
            'appeal': {'canAppeal': true, 'deadline': '2026-11-11T10:00:00.000Z', 'appealedAt': null, 'decision': null},
          },
        ],
      });
      expect(me.suspension!.reason, "Qo'pollik");
      final item = me.items.single;
      expect(item.sanctions.map((s) => s.type), ['suspension', 'penalty']);
      expect(item.sanctions.first.days, 3);
      expect(item.appeal.canAppeal, isTrue);
      final appealed = item.appealed(DateTime(2026, 11, 5));
      expect(appealed.appeal.pending, isTrue);
      expect(appealed.appeal.canAppeal, isFalse);
      expect(appealed.status, IncidentStatus.investigating);
    });

    test('bo\'sh/buzuq javob yiqitmaydi', () {
      final me = IncidentAboutMe.fromJson({'suspension': null, 'items': 'x'});
      expect(me.suspension, isNull);
      expect(me.items, isEmpty);
    });
  });

  group('kodli xatolar', () {
    test('ACCOUNT_SUSPENDED → muddat va sabab, haydovchi turkumi', () {
      final e = _error(403, {
        'code': 'ACCOUNT_SUSPENDED',
        'message': "Hisobingiz ... to'xtatilgan",
        'details': {'until': '2026-11-06T10:00:00.000Z', 'reason': 'Mast'},
      });
      final s = suspensionFromError(ApiError.from(e));
      expect(s!.reason, 'Mast');
      expect(s.until.toUtc(), DateTime.utc(2026, 11, 6, 10));
      expect(classifyDriverError(e), DriverErrorKind.accountSuspended);
      expect(suspensionFromError(ApiError.from(_error(400, {'code': 'OTHER'}))), isNull);
    });

    test('ACCOUNT_BLOCKED — xabar ostida sabab', () {
      final text = extractErrorMessage(_error(401, {
        'code': 'ACCOUNT_BLOCKED',
        'message': 'Hisobingiz bloklangan',
        'details': {'reason': 'Firibgarlik'},
      }));
      expect(text, contains('Hisobingiz bloklangan'));
      expect(text, contains('Firibgarlik'));
      expect(
        extractErrorMessage(_error(401, {'code': 'ACCOUNT_BLOCKED', 'message': 'Hisobingiz bloklangan', 'details': {'reason': null}})),
        'Hisobingiz bloklangan',
      );
    });
  });

  test('push: chora — «Menga nisbatan», natija — «Shikoyatlarim» (ikkala rol)', () {
    for (final driver in [true, false]) {
      expect(pushTapTarget({'event': 'incident_suspended'}, driver: driver), PushTapTarget.incidentsAboutMe);
      expect(pushTapTarget({'event': 'incident_appeal_decided'}, driver: driver), PushTapTarget.incidentsAboutMe);
      expect(pushTapTarget({'event': 'incident_resolved'}, driver: driver), PushTapTarget.incidentsMine);
      expect(pushTapTarget({'event': 'incident_refund'}, driver: driver), PushTapTarget.incidentsMine);
    }
  });

  test('oyna: 7 kun', () {
    final now = DateTime(2026, 11, 10);
    expect(incidentReportWindowOpen(DateTime(2026, 11, 4), now: now), isTrue);
    expect(incidentReportWindowOpen(DateTime(2026, 11, 1), now: now), isFalse);
    expect(incidentReportWindowOpen(null, now: now), isFalse);
    expect(IncidentComplaintLink.visibleFor(2), isTrue);
    expect(IncidentComplaintLink.visibleFor(3), isFalse);
    expect(IncidentComplaintLink.visibleFor(0), isFalse);
    expect(IncidentComplaintLink.visibleFor(5, always: true), isTrue);
  });

  group('IncidentsService', () {
    late _MockApi api;
    setUp(() => api = _MockApi());

    test('report — kontrakt maydonlari, id qaytadi', () async {
      when(() => api.post(ApiEndpoints.incidents, data: any(named: 'data'))).thenAnswer((_) async => _ok({'id': 'inc-1'}));
      final id = await IncidentsService(api).report(
        vertical: 'food',
        orderId: 'f1',
        category: 'cold_food',
        description: '  Sovuq  ',
        subject: 'vendor',
      );
      expect(id, 'inc-1');
      final body = verify(() => api.post(ApiEndpoints.incidents, data: captureAny(named: 'data'))).captured.single;
      expect(body, {'vertical': 'food', 'orderId': 'f1', 'category': 'cold_food', 'description': 'Sovuq', 'subject': 'vendor'});
    });

    test('mine / aboutMe / appeal', () async {
      when(() => api.get(ApiEndpoints.myIncidents)).thenAnswer((_) async => _ok([
            {'id': 'i1', 'category': 'rude', 'description': 'x', 'status': 'open', 'createdAt': '2026-11-03T10:00:00Z'},
          ]));
      when(() => api.get(ApiEndpoints.incidentsAboutMe)).thenAnswer((_) async => _ok({'suspension': null, 'items': []}));
      when(() => api.post(ApiEndpoints.incidentAppeal('i1'), data: any(named: 'data'))).thenAnswer((_) async => _ok({}));
      final service = IncidentsService(api);
      expect((await service.mine()).single.id, 'i1');
      expect((await service.aboutMe()).items, isEmpty);
      await service.appeal('i1', ' Aybsizman ');
      verify(() => api.post(ApiEndpoints.incidentAppeal('i1'), data: {'note': 'Aybsizman'})).called(1);
    });
  });
}
