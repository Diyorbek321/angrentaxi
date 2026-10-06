import 'dart:convert';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/ads/ad_carousel.dart';
import 'package:angren_taxi/features/ads/ads_service.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:angren_taxi/shared/models/ad_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _NoApi extends Mock implements ApiClient {}

// 1×1 PNG — decodes in tests, so the slide really "paints".
final _png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
);

class _FakeAds extends AdsService {
  _FakeAds(this._result) : super(_NoApi());

  final Future<List<AdBanner>> Function() _result;
  final impressions = <String>[];
  final clicks = <String>[];

  @override
  Future<List<AdBanner>> active() => _result();

  @override
  Future<void> recordImpression(String id) async => impressions.add(id);

  @override
  Future<void> recordClick(String id) async => clicks.add(id);
}

const _url = AdBanner(id: 'a', title: 'Lavash', linkType: AdLinkType.url, linkTarget: 'https://lavash.uz');
const _plain = AdBanner(id: 'b', title: 'Kuz', linkType: AdLinkType.none);

void main() {
  late List<AdBanner> opened;

  setUp(() => opened = []);

  Future<void> pump(
    WidgetTester tester,
    _FakeAds ads, {
    bool disableAnimations = false,
    bool decodeImages = false,
  }) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('uz'),
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: Scaffold(
          body: AdCarousel(
            service: ads,
            onOpen: opened.add,
            imageFor: (_) => MemoryImage(_png),
          ),
        ),
      ),
    ));
    await tester.pump();
    if (decodeImages) {
      // Image decoding is real async work outside the fake clock.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump();
      await tester.pump();
    }
  }

  testWidgets('takes no space when there are no banners or loading fails', (tester) async {
    await pump(tester, _FakeAds(() async => []));
    expect(find.byType(PageView), findsNothing);

    await pump(tester, _FakeAds(() async => throw Exception('offline')));
    expect(find.byType(PageView), findsNothing);
  });

  testWidgets('marks each banner as an ad and counts a click before opening', (tester) async {
    final ads = _FakeAds(() async => [_url, _plain]);
    await pump(tester, ads, disableAnimations: true);

    expect(find.text('Reklama'), findsWidgets);
    expect(find.bySemanticsLabel('Reklama: Lavash'), findsOneWidget);

    await tester.tap(find.byType(PageView));
    expect(ads.clicks, ['a']);
    expect(opened.single.id, 'a');
  });

  testWidgets('a banner without a link does nothing on tap', (tester) async {
    final ads = _FakeAds(() async => [_plain]);
    await pump(tester, ads);

    await tester.tap(find.byType(PageView));
    expect(ads.clicks, isEmpty);
    expect(opened, isEmpty);
  });

  testWidgets('counts an impression only for the visible, painted banner', (tester) async {
    final ads = _FakeAds(() async => [_url, _plain]);
    await pump(tester, ads, disableAnimations: true, decodeImages: true);
    expect(ads.impressions, ['a']);

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
    await tester.pump();
    await tester.pump();
    expect(ads.impressions, ['a', 'b']);
  });

  testWidgets('advances on its own', (tester) async {
    final ads = _FakeAds(() async => [_url, _plain]);
    await pump(tester, ads);
    await tester.pump(kAdAutoAdvance);
    await tester.pumpAndSettle();
    expect(tester.widget<PageView>(find.byType(PageView)).controller!.page, 1);
  });

  testWidgets('stays put when the user asked for less motion', (tester) async {
    final still = _FakeAds(() async => [_url, _plain]);
    await pump(tester, still, disableAnimations: true);
    await tester.pump(kAdAutoAdvance * 2);
    await tester.pumpAndSettle();
    expect(tester.widget<PageView>(find.byType(PageView)).controller!.page, 0);
  });
}
