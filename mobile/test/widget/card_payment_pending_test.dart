// "To'lov kutilmoqda" bloki (docs/INCIDENT-POLICY.md §1): to'lanmagan kartali
// buyurtma oddiy buyurtmaga o'xshamaydi va qayta to'lash tugmasi bor.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/screens/order_status_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/card_payment_pending.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

void main() {
  late _MockApiClient api;
  late SuperappProvider superapp;

  setUp(() {
    api = _MockApiClient();
    superapp = SuperappProvider(apiClient: api)
      ..debugSetCardPaymentsForTest(available: true, providers: const ['click']);
    when(() => api.get(any(), params: any(named: 'params'))).thenAnswer((inv) async => Response<dynamic>(
          requestOptions: RequestOptions(path: inv.positionalArguments.first as String),
          data: {'success': true, 'data': <dynamic>[]},
        ));
    when(() => api.get(any())).thenAnswer((inv) async => Response<dynamic>(
          requestOptions: RequestOptions(path: inv.positionalArguments.first as String),
          data: {'success': true, 'data': <dynamic>[]},
        ));
  });

  Widget host(Widget child) => MultiProvider(
        providers: [
          ChangeNotifierProvider<SuperappProvider>.value(value: superapp),
          ChangeNotifierProvider<FoodProvider>(
              create: (_) => FoodProvider(apiClient: api, socketService: SocketService())),
          ChangeNotifierProvider<MarketProvider>(
              create: (_) => MarketProvider(apiClient: api, socketService: SocketService())),
        ],
        child: MaterialApp(home: child),
      );

  testWidgets("OrderStatusScreen: to'lov tugamagan — 'To'lov kutilmoqda', 'qabul qilindi' emas", (tester) async {
    await tester.pumpWidget(host(const OrderStatusScreen(
      orderId: 'abc-1',
      paidOnline: false,
      paymentPending: true,
      kind: 'food',
    )));
    await tester.pumpAndSettle();
    expect(find.text("To'lov kutilmoqda"), findsWidgets);
    expect(find.byKey(const ValueKey('card-payment-retry')), findsOneWidget);
  });

  testWidgets("qayta to'lash — sozlangan provayder bilan initiate, muvaffaqiyatda onPaid", (tester) async {
    final payments = PaymentService(apiClient: api);
    when(() => api.post(any(that: contains(ApiEndpoints.paymentsInitiate)), data: any(named: 'data')))
        .thenAnswer((_) async => Response<dynamic>(
              requestOptions: RequestOptions(path: ApiEndpoints.paymentsInitiate),
              data: {
                'success': true,
                'data': {'url': 'https://my.click.uz/x', 'id': 't1', 'provider': 'click'},
              },
            ));
    PaymentInitiateResult? opened;
    var paid = false;
    await tester.pumpWidget(host(Scaffold(
      body: CardPaymentPendingCard(
        kind: 'food',
        orderId: 'fo-1',
        paymentService: payments,
        openPaymentCheckout: (context, result) async {
          opened = result;
          return true;
        },
        onPaid: () => paid = true,
      ),
    )));
    await tester.tap(find.byKey(const ValueKey('card-payment-retry')));
    await tester.pumpAndSettle();

    final path = verify(() => api.post(captureAny(that: contains(ApiEndpoints.paymentsInitiate)), data: any(named: 'data')))
        .captured
        .single as String;
    expect(path, contains('provider=click'));
    expect(opened?.url, 'https://my.click.uz/x');
    expect(paid, isTrue);
    expect(find.text("To'lov qabul qilindi"), findsOneWidget);
  });
}
