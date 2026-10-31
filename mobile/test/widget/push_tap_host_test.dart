// Push bosilganda ekran haqiqatan ochiladi (lib/push_tap_host.dart).
import 'package:angren_taxi/core/push/push_tap_router.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';
import 'package:angren_taxi/push_tap_host.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeRepo extends IntercityRepository {
  int boardCalls = 0;
  int myRequestsCalls = 0;

  @override
  Future<IntercityPublicSettings> publicSettings() async => const IntercityPublicSettings(enabled: true);

  @override
  Future<List<IntercityRequest>> requestBoard({String? routeId}) async {
    boardCalls++;
    return const [];
  }

  @override
  Future<List<IntercityTrip>> myTrips() async => const [];

  @override
  Future<List<IntercityRequest>> myRequests() async {
    myRequestsCalls++;
    return const [];
  }
}

void main() {
  Future<(PushTapRouter, _FakeRepo, GlobalKey<NavigatorState>)> pump(WidgetTester tester, {required bool driver}) async {
    final router = PushTapRouter(driver: driver);
    final repo = _FakeRepo();
    final key = GlobalKey<NavigatorState>();
    await tester.pumpWidget(MaterialApp(
      navigatorKey: key,
      builder: (context, child) => PushTapHost(
        navigatorKey: key,
        router: router,
        intercityRepository: repo,
        child: child!,
      ),
      home: const Scaffold(body: Text('bosh ekran')),
      routes: {'/driver/verification': (_) => const Scaffold(body: Text('tekshiruv'))},
    ));
    return (router, repo, key);
  }

  testWidgets("haydovchi: yangi so'rov pushi doskani ochadi (bosh ekran tayyor bo'lgach)", (tester) async {
    final (router, repo, _) = await pump(tester, driver: true);

    router.handle({'event': 'intercity_request_created', 'requestId': 'q1'});
    await tester.pumpAndSettle();
    expect(find.text('bosh ekran'), findsOneWidget);
    expect(repo.boardCalls, 0);

    router.markReady();
    await tester.pumpAndSettle();
    expect(find.text("Yo'lovchi so'rovlari"), findsOneWidget);
    expect(repo.boardCalls, 1);
  });

  testWidgets("ikki marta bosilsa ekran ustma-ust to'planmaydi", (tester) async {
    final (router, _, key) = await pump(tester, driver: true);
    router.markReady();

    router.handle({'event': 'intercity_request_created'});
    await tester.pumpAndSettle();
    router.handle({'event': 'intercity_request_created'});
    await tester.pumpAndSettle();

    key.currentState!.pop();
    await tester.pumpAndSettle();
    expect(find.text('bosh ekran'), findsOneWidget);
  });

  testWidgets("yo'lovchi: muddat tugadi pushi so'rovlarimni ochadi", (tester) async {
    final (router, repo, _) = await pump(tester, driver: false);
    router.markReady();

    router.handle({'event': 'intercity_request_expired', 'requestId': 'q1'});
    await tester.pumpAndSettle();
    expect(find.text("Mening so'rovlarim"), findsOneWidget);
    expect(repo.myRequestsCalls, 1);
  });

  testWidgets('haydovchi: tekshiruv muddati — nomli marshrut', (tester) async {
    final (router, _, _) = await pump(tester, driver: true);
    router.markReady();

    router.handle({'event': 'verification_due'});
    await tester.pumpAndSettle();
    expect(find.text('tekshiruv'), findsOneWidget);
  });

  testWidgets('taksi pushi hech narsa ochmaydi', (tester) async {
    final (router, _, _) = await pump(tester, driver: false);
    router.markReady();

    router.handle({'event': 'order_accepted', 'orderId': 'o1'});
    await tester.pumpAndSettle();
    expect(find.text('bosh ekran'), findsOneWidget);
  });
}
