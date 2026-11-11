// Qarz oynasi: xato matni o'rniga summa, sabab va keyingi qadam (§7).
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/wallet_debt_sheet.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(Map<String, dynamic> data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
    );

Map<String, dynamic> _debt({bool card = false, bool settle = false, double total = 3000}) => {
      'total': total,
      'items': total > 0
          ? [
              {'id': 'd1', 'amount': total, 'reason': 'late_cancel', 'orderId': 'o1'},
            ]
          : <dynamic>[],
      'canSettleNow': settle,
      'topUpNeeded': settle ? 0 : total,
      'topUpAvailable': card,
      'minTopUp': total,
      'supportPhone': '+998711234567',
    };

Future<_MockApiClient> _pump(WidgetTester tester, Map<String, dynamic> debt) async {
  final api = _MockApiClient();
  when(() => api.get(ApiEndpoints.walletDebt)).thenAnswer((_) async => _ok(debt));
  await tester.pumpWidget(
    ChangeNotifierProvider<SuperappProvider>(
      create: (_) => SuperappProvider(apiClient: api),
      child: const MaterialApp(
        locale: Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: WalletDebtSheet()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets("karta yo'q: summa, sabab va qo'llab-quvvatlash, to'ldirish yo'q", (tester) async {
    await _pump(tester, _debt());
    expect(find.text("To'lanmagan qarz"), findsOneWidget);
    expect(find.text('Kech bekor qilish jarimasi'), findsOneWidget);
    expect(find.textContaining("Hozircha ilovada karta bilan to'lab bo'lmaydi"), findsOneWidget);
    expect(find.textContaining('+998711234567'), findsOneWidget);
    expect(find.byType(AgPrimaryButton), findsNothing);

    final dialled = <Uri>[];
    WalletDebtSheetDeps.dial = (uri) async {
      dialled.add(uri);
      return true;
    };
    await tester.tap(find.textContaining('+998711234567'));
    await tester.pump();
    expect(dialled.single.toString(), 'tel:+998711234567');
  });

  testWidgets("karta bor: to'lov tugmasi, callback yopgach 'Qarz yopildi'", (tester) async {
    final api = await _pump(tester, _debt(card: true));
    when(() => api.post(ApiEndpoints.walletTopup, data: any<dynamic>(named: 'data'))).thenAnswer(
      (_) async => _ok({'topupId': 't1', 'checkoutUrl': 'https://checkout.paycom.uz/x'}),
    );
    var opened = 0;
    WalletDebtSheetDeps.openCheckout = (context, result) async {
      opened++;
      return true;
    };
    when(() => api.get(ApiEndpoints.walletDebt)).thenAnswer((_) async => _ok(_debt(total: 0)));

    await tester.tap(find.byType(AgPrimaryButton));
    await tester.pumpAndSettle();

    expect(opened, 1);
    expect(find.textContaining('Qarz yopildi'), findsOneWidget);
  });

  testWidgets("hamyonda pul bor: 'Hamyondan to'lash'", (tester) async {
    final api = await _pump(tester, _debt(settle: true));
    when(() => api.post(ApiEndpoints.walletDebtSettle)).thenAnswer((_) async => _ok(_debt(total: 0)));
    await tester.tap(find.text("Hamyondan to'lash"));
    await tester.pumpAndSettle();
    expect(find.textContaining('Qarz yopildi'), findsOneWidget);
  });
}
