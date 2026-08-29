import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_tariff_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

/// `AgTariffCard` uchun testlar.
///
/// Bu testlar KO'RINISHNI emas, **shartnomani** tasdiqlaydi:
///   - mashina rasmi karta chekkasidan chiqadi va KESILMAYDI
///     (komponentning butun ma'nosi shunda)
///   - tanlov faqat rang bilan berilmaydi (chegara + semantika ham)
///   - tanlanmagan karta ham ko'rinadigan chegaraga ega (WCAG 1.4.11)
///   - kenglik qattiq emas — `Expanded` ichida moslashadi
///
/// Rasm assetlari alohida vazifada qo'shiladi, shuning uchun bu yerda
/// `imageBuilder` orqali soxta rasm beriladi — testlar asset fayllariga
/// bog'liq bo'lmasligi kerak.
Widget _host(Widget child) => MaterialApp(
      theme: appTheme,
      home: Scaffold(
        body: Center(child: child),
      ),
    );

/// Asset yuklashsiz rasm o'rnini bosuvchi.
Widget _stubArt(BuildContext context, String assetPath) =>
    const ColoredBox(color: kSurface3);

AgTariffCard _card({
  bool selected = false,
  String? badge,
  VoidCallback? onTap,
  AgTariffArtBuilder? imageBuilder = _stubArt,
}) =>
    AgTariffCard(
      name: 'Tejamkor',
      priceLabel: '18 000',
      etaLabel: '3 daq',
      assetPath: 'assets/images/tariff_econom.svg',
      selected: selected,
      badge: badge,
      imageBuilder: imageBuilder,
      onTap: onTap ?? () {},
    );

void main() {
  // Haptika test muhitida platforma kanalini chaqiradi — o'chirib qo'yamiz.
  setUp(() => AppHaptics.enabled = false);
  tearDown(() => AppHaptics.enabled = true);

  group('AgTariffCard — kontent', () {
    testWidgets('nom, narx va ETA ko\'rsatiladi', (tester) async {
      await tester.pumpWidget(_host(_card()));

      expect(find.text('Tejamkor'), findsOneWidget);
      expect(find.text('18 000'), findsOneWidget);
      expect(find.text('3 daq'), findsOneWidget);
    });

    testWidgets('nishon berilganda chiziladi, berilmasa yo\'q',
        (tester) async {
      await tester.pumpWidget(_host(_card(badge: 'TOP')));
      expect(find.text('TOP'), findsOneWidget);

      await tester.pumpWidget(_host(_card()));
      expect(find.text('TOP'), findsNothing);
    });

    testWidgets('nishon mint fon + kOnMint matn (oq EMAS)', (tester) async {
      await tester.pumpWidget(_host(_card(badge: 'TOP')));

      final box = tester.widget<Container>(
        find.ancestor(
          of: find.text('TOP'),
          matching: find.byType(Container),
        ),
      );
      expect((box.decoration! as BoxDecoration).color, kMint);

      final text = tester.widget<Text>(find.text('TOP'));
      // Mint ustida oq matn 2.12:1 — AA emas.
      expect(text.style!.color, kOnMint);
      expect(text.style!.color, isNot(kOnPrimary));
    });
  });

  group('AgTariffCard — chiqib turuvchi rasm', () {
    testWidgets('rasm karta tepasidan aynan 20dp chiqib turadi',
        (tester) async {
      await tester.pumpWidget(_host(_card()));

      final cardTop = tester.getTopLeft(find.byType(AgTariffCard)).dy;
      final artTop = tester.getTopLeft(find.byKey(AgTariffCard.artKey)).dy;

      expect(cardTop - artTop, AgTariffCard.artOverhang);
      expect(artTop, lessThan(cardTop));
    });

    testWidgets('Stack rasmni kesmaydi — clipBehavior Clip.none',
        (tester) async {
      await tester.pumpWidget(_host(_card()));

      final stack = tester.widget<Stack>(
        find.descendant(
          of: find.byType(AgTariffCard),
          matching: find.byType(Stack),
        ),
      );
      // Clip.hardEdge bo'lsa komponentning butun g'oyasi yo'qoladi.
      expect(stack.clipBehavior, Clip.none);
    });

    testWidgets('rasm uyasi 82x38 va gorizontal markazda', (tester) async {
      await tester.pumpWidget(_host(_card()));

      final art = tester.getRect(find.byKey(AgTariffCard.artKey));
      expect(art.width, 82);
      expect(art.height, 38);

      final card = tester.getRect(find.byType(AgTariffCard));
      expect(art.center.dx, moreOrLessEquals(card.center.dx, epsilon: 0.5));
    });

    testWidgets('assetPath chizuvchiga o\'zgarishsiz uzatiladi',
        (tester) async {
      String? seen;
      await tester.pumpWidget(_host(AgTariffCard(
        name: 'Komfort',
        priceLabel: '26 000',
        etaLabel: '5 daq',
        assetPath: 'assets/images/tariff_comfort.svg',
        onTap: () {},
        imageBuilder: (context, assetPath) {
          seen = assetPath;
          return const SizedBox.shrink();
        },
      )));

      // Karta rasmni O'ZI tanlamaydi — chaqiruvchi bergani chiziladi.
      expect(seen, 'assets/images/tariff_comfort.svg');
    });

    testWidgets('imageBuilder berilmasa ham xatosiz chiziladi',
        (tester) async {
      await tester.pumpWidget(_host(_card(imageBuilder: null)));
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.byKey(AgTariffCard.artKey), findsOneWidget);
    });

    testWidgets('SVG yo\'li rastr dekoderga berilmaydi', (tester) async {
      await tester.pumpWidget(_host(_card(imageBuilder: null)));
      await tester.pump();

      // `Image.asset` SVG ni ocha olmaydi va har chizishda xato yozadi —
      // tarif rasmlari SVG bo'lgani uchun bu log shovqiniga aylanardi.
      expect(
        find.descendant(
          of: find.byType(AgTariffCard),
          matching: find.byType(Image),
        ),
        findsNothing,
      );
      // Uya baribir to'ldiriladi: bo'sh kata "bu tarif boshqacha" deb
      // o'qilardi.
      expect(
        find.descendant(
          of: find.byKey(AgTariffCard.artKey),
          matching: find.byType(Icon),
        ),
        findsOneWidget,
      );
    });

    testWidgets('rastr yo\'l imageBuilder\'siz Image.asset bilan chiziladi',
        (tester) async {
      await tester.pumpWidget(_host(AgTariffCard(
        name: 'Komfort',
        priceLabel: '26 000',
        etaLabel: '5 daq',
        assetPath: 'assets/images/tariff_comfort.png',
        onTap: () {},
      )));
      await tester.pump();

      expect(
        find.descendant(
          of: find.byKey(AgTariffCard.artKey),
          matching: find.byType(Image),
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('AgTariffCard — tanlangan holat', () {
    testWidgets('tanlangan: kPrimary 2dp chegara + kMintTint fon',
        (tester) async {
      await tester.pumpWidget(_host(_card(selected: true)));

      final decoration = tester
          .widget<Container>(
            find.descendant(
              of: find.byType(AgTariffCard),
              matching: find.byType(Container),
            ),
          )
          .decoration! as BoxDecoration;

      expect(decoration.color, kMintTint);
      expect(decoration.border!.top.color, kPrimary);
      expect(decoration.border!.top.width, 2);
    });

    testWidgets('tanlanmagan: kSurface fon + kLineInteractive chegara',
        (tester) async {
      await tester.pumpWidget(_host(_card()));

      final decoration = tester
          .widget<Container>(
            find.descendant(
              of: find.byType(AgTariffCard),
              matching: find.byType(Container),
            ),
          )
          .decoration! as BoxDecoration;

      expect(decoration.color, kSurface);
      // `kLine` (1.22:1) bezak ajratkichi — tanlanadigan karta chekkasi
      // uchun 3:1 kerak (WCAG 1.4.11).
      expect(decoration.border!.top.color, kLineInteractive);
      expect(decoration.border!.top.color, isNot(kLine));
    });

    testWidgets('narx tanlanganda kPrimary, aks holda kInk', (tester) async {
      await tester.pumpWidget(_host(_card(selected: true)));
      expect(tester.widget<Text>(find.text('18 000')).style!.color, kPrimary);

      await tester.pumpWidget(_host(_card()));
      expect(tester.widget<Text>(find.text('18 000')).style!.color, kInk);
    });

    testWidgets('ETA matni kInkMuted — kInkSubtle 10.5sp uchun AA emas',
        (tester) async {
      await tester.pumpWidget(_host(_card()));

      final eta = tester.widget<Text>(find.text('3 daq'));
      expect(eta.style!.fontSize, 10.5);
      // kInkSubtle oq ustida 3.67:1 — kichik matn uchun yetmaydi.
      expect(eta.style!.color, kInkMuted);
      expect(eta.style!.color, isNot(kInkSubtle));
    });

    testWidgets('tanlov rang bilan YOLG\'IZ qolmaydi — semantikada ham bor',
        (tester) async {
      await tester.pumpWidget(_host(_card(selected: true)));

      final semantics = tester.getSemantics(find.byType(AgTariffCard));
      expect(semantics.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(semantics.hasFlag(SemanticsFlag.isButton), isTrue);
      // Karta bitta gap sifatida o'qiladi.
      expect(semantics.label, 'Tejamkor, 18 000, 3 daq');
    });

    testWidgets('nishon ham ekran o\'quvchiga yetkaziladi', (tester) async {
      await tester.pumpWidget(_host(_card(badge: 'TOP')));

      expect(
        tester.getSemantics(find.byType(AgTariffCard)).label,
        'Tejamkor, TOP, 18 000, 3 daq',
      );
    });
  });

  group('AgTariffCard — bosilish va tartib', () {
    testWidgets('bosilganda onTap chaqiriladi', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(_card(onTap: () => taps++)));

      await tester.tap(find.text('Tejamkor'));
      await tester.pump();

      expect(taps, 1);
    });

    testWidgets('tegish maydoni 48dp dan past emas', (tester) async {
      await tester.pumpWidget(_host(_card()));

      expect(
        tester.getSize(find.byType(AgTariffCard)).height,
        greaterThanOrEqualTo(kMinTapTarget),
      );
    });

    testWidgets('qattiq kenglik yo\'q — Expanded ichida teng bo\'linadi',
        (tester) async {
      await tester.pumpWidget(_host(SizedBox(
        width: 300,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _card()),
            const SizedBox(width: kSpace2),
            Expanded(child: _card(selected: true)),
          ],
        ),
      )));

      final widths = tester
          .widgetList<AgTariffCard>(find.byType(AgTariffCard))
          .map((w) => tester.getSize(find.byWidget(w)).width)
          .toList();

      expect(widths, hasLength(2));
      expect(widths.first, widths.last);
      // (300 - 8) / 2 = 146 — karta kontentiga emas, otaga moslashdi.
      expect(widths.first, 146);
      expect(tester.takeException(), isNull);
    });

    testWidgets('tor ekranda nom toshib ketmaydi, ellipsisga tushadi',
        (tester) async {
      await tester.pumpWidget(_host(SizedBox(
        width: 84,
        child: AgTariffCard(
          name: 'Biznes komfort plus',
          priceLabel: '120 000',
          etaLabel: '12 daq',
          assetPath: 'assets/images/tariff_business.svg',
          imageBuilder: _stubArt,
          onTap: () {},
        ),
      )));

      final name = tester.widget<Text>(find.text('Biznes komfort plus'));
      expect(name.maxLines, 1);
      expect(name.overflow, TextOverflow.ellipsis);
      expect(tester.takeException(), isNull);
    });
  });
}
