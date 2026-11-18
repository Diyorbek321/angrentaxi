import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_route_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// `AgRoutePanel` — xarita ustida suzuvchi marshrut paneli.
///
/// Testlar KO'RINISHNI emas, **shartnomani** tasdiqlaydi:
///   - ikki nuqta hech qachon bir xil glif emas (doira ≠ kvadrat)
///   - qator balandligi 42dp — panel sheet o'lchamiga o'sib ketmaydi
///   - 34dp almashtirish tugmasining tegish maydoni 48dp
///   - uzun o'zbekcha manzil qatorni to'ldirmaydi, ellipsis bilan kesiladi
///   - har bir qator ekran o'quvchiga o'z ROLI bilan e'lon qilinadi
const String _from = 'Amir Temur ko\'chasi 12';
const String _to = 'Angren bozori';

/// Panel ota-widget bergan kenglikni to'ldiradi — testda kenglik aniq
/// bo'lishi uchun uni belgilangan qutiga qo'yamiz (real hayotda bu
/// `Stack` + `Positioned(left/right)` bo'ladi).
Widget _host(Widget child, {double width = 360}) => MaterialApp(
      theme: appTheme,
      home: Scaffold(
        body: Center(
          child: SizedBox(width: width, child: child),
        ),
      ),
    );

void main() {
  group('AgRoutePanel — tuzilma', () {
    testWidgets('ikkala manzil ham ko\'rinadi', (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      expect(find.text(_from), findsOneWidget);
      expect(find.text(_to), findsOneWidget);
    });

    testWidgets('nuqtalar SHAKL bilan farq qiladi — doira va kvadrat',
        (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      final fromGlyph = tester.widget<Container>(
        find.byKey(kRoutePanelFromGlyphKey),
      );
      final toGlyph = tester.widget<Container>(
        find.byKey(kRoutePanelToGlyphKey),
      );

      final fromBox = fromGlyph.decoration! as BoxDecoration;
      final toBox = toGlyph.decoration! as BoxDecoration;

      // "Qayerdan" — doira, kPrimary.
      expect(fromBox.shape, BoxShape.circle);
      expect(fromBox.color, kPrimary);

      // "Qayerga" — kvadrat, kInk. Doira BO'LMASLIGI shartnomaning o'zagi:
      // aks holda qatorlarni faqat rang ajratib turardi (WCAG 1.4.1).
      expect(toBox.shape, BoxShape.rectangle);
      expect(toBox.color, kInk);
      expect(toBox.borderRadius, isNotNull);

      // Ikkala glif ham 9dp.
      expect(tester.getSize(find.byKey(kRoutePanelFromGlyphKey)),
          const Size(9, 9));
      expect(
          tester.getSize(find.byKey(kRoutePanelToGlyphKey)), const Size(9, 9));
    });

    testWidgets('qator balandligi 42dp — panel sheetga o\'smaydi',
        (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      for (final address in [_from, _to]) {
        final row = find
            .ancestor(of: find.text(address), matching: find.byType(SizedBox))
            .first;
        expect(tester.getSize(row).height, 42);
      }

      // 4 (ichki bo'shliq) + 42 + 1 (ajratkich) + 42 + 4 = 93dp.
      expect(tester.getSize(find.byType(AgRoutePanel)).height, 93);
    });

    testWidgets('panel oq, kRadiusMd va suzuvchi soya bilan', (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      final container = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(AgRoutePanel),
              matching: find.byType(Container),
            )
            .first,
      );
      final decoration = container.decoration! as BoxDecoration;

      expect(decoration.color, kSurface);
      expect(decoration.borderRadius, BorderRadius.circular(kRadiusMd));
      // Xarita ustida suzadi — balandlik soya bilan beriladi.
      expect(decoration.boxShadow, kShadowPop);
    });

    testWidgets('qatorlar orasida kDivider chizig\'i bor', (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      final divider = tester.widget<Divider>(find.byType(Divider));
      expect(divider.color, kDivider);
      expect(divider.thickness, 1);
    });
  });

  group('AgRoutePanel — masofa', () {
    testWidgets('distanceLabel berilmasa hech narsa qo\'shilmaydi',
        (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      expect(find.text('4.2 km'), findsNothing);
      // Faqat ikkita manzil matni.
      expect(find.byType(Text), findsNWidgets(2));
    });

    testWidgets('distanceLabel manzil qatorida ko\'rsatiladi', (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(
          from: _from,
          to: _to,
          distanceLabel: '4.2 km',
        )),
      );

      expect(find.text('4.2 km'), findsOneWidget);

      final label = tester.widget<Text>(find.text('4.2 km'));
      expect(label.style!.color, kInkMuted);
    });

    testWidgets('bo\'sh distanceLabel qator qo\'shmaydi', (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to, distanceLabel: '')),
      );

      expect(find.byType(Text), findsNWidgets(2));
    });
  });

  group('AgRoutePanel — uzun manzillar', () {
    testWidgets('uzun o\'zbekcha manzil ellipsis bilan kesiladi, toshmaydi',
        (tester) async {
      const long =
          'Mustaqillik shoh ko\'chasi, 42-uy, 3-podez, Angren shahri, '
          'Toshkent viloyati';

      await tester.pumpWidget(
        // Eng tor holat (iPhone SE) — bu yerda toshsa, hamma joyda toshadi.
        _host(const AgRoutePanel(from: long, to: long), width: 320),
      );

      expect(tester.takeException(), isNull);

      for (final text in tester.widgetList<Text>(find.text(long))) {
        expect(text.maxLines, 1);
        expect(text.overflow, TextOverflow.ellipsis);
      }

      // Qator baribir 42dp — matn ikki qatorga o'ralmagan.
      expect(tester.getSize(find.byType(AgRoutePanel)).height, 93);
    });
  });

  group('AgRoutePanel — matn masshtabi', () {
    testWidgets('tizim shrifti 1.4x bo\'lganda ham qator 42dp da qoladi',
        (tester) async {
      // 42dp qat'iy balandlik shu komponentning eng nozik joyi: shrift
      // kattalashsa matn qatordan toshib ketishi mumkin edi. Ilova
      // `textScaler`ni 1.4x da cheklaydi (app.dart), shuning uchun eng
      // yomon holat aynan shu.
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.4)),
          child: _host(const AgRoutePanel(
            from: _from,
            to: _to,
            distanceLabel: '4.2 km',
          )),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(AgRoutePanel)).height, 93);
    });
  });

  group('AgRoutePanel — almashtirish tugmasi', () {
    testWidgets('tegish maydoni kMinTapTarget dan kichik emas',
        (tester) async {
      await tester.pumpWidget(
        _host(AgRoutePanel(from: _from, to: _to, onSwap: () {})),
      );

      final size = tester.getSize(find.byKey(kRoutePanelSwapKey));
      expect(size.width, greaterThanOrEqualTo(kMinTapTarget));
      expect(size.height, greaterThanOrEqualTo(kMinTapTarget));
    });

    testWidgets('ko\'rinadigan doira 34dp va interaktiv chegaraga ega',
        (tester) async {
      await tester.pumpWidget(
        _host(AgRoutePanel(from: _from, to: _to, onSwap: () {})),
      );

      final circle = find.descendant(
        of: find.byKey(kRoutePanelSwapKey),
        matching: find.byType(Container),
      );
      expect(tester.getSize(circle.first), const Size(34, 34));

      final decoration =
          tester.widget<Container>(circle.first).decoration! as BoxDecoration;
      expect(decoration.color, kSurface2);
      expect(decoration.shape, BoxShape.circle);
      // kSurface2 oq panel ustida 1.04:1 — chegara bo'lmasa tugma chetini
      // ko'rib bo'lmaydi (WCAG 1.4.11).
      expect(decoration.border, Border.all(color: kLineInteractive));
    });

    testWidgets('bosilganda onSwap chaqiriladi', (tester) async {
      var swaps = 0;
      await tester.pumpWidget(
        _host(AgRoutePanel(from: _from, to: _to, onSwap: () => swaps++)),
      );

      await tester.tap(find.byKey(kRoutePanelSwapKey));
      await tester.pumpAndSettle();

      expect(swaps, 1);
    });

    testWidgets('tugma bosilganda qator bosilmaydi', (tester) async {
      var swaps = 0;
      var fromTaps = 0;

      await tester.pumpWidget(
        _host(AgRoutePanel(
          from: _from,
          to: _to,
          onSwap: () => swaps++,
          onTapFrom: () => fromTaps++,
        )),
      );

      await tester.tap(find.byKey(kRoutePanelSwapKey));
      await tester.pumpAndSettle();

      expect(swaps, 1);
      expect(fromTaps, 0);
    });

    testWidgets('showSwap: false — tugma ham, u egallagan joy ham yo\'q',
        (tester) async {
      await tester.pumpWidget(
        _host(AgRoutePanel(
          from: _from,
          to: _to,
          onSwap: () {},
          showSwap: false,
        )),
      );

      expect(find.byKey(kRoutePanelSwapKey), findsNothing);
      expect(find.byIcon(Icons.swap_vert_rounded), findsNothing);
    });

    testWidgets('onSwap null bo\'lsa tugma o\'chirilgan ko\'rinadi',
        (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      final icon = tester.widget<Icon>(find.byIcon(Icons.swap_vert_rounded));
      expect(icon.color, kInkSubtle);
    });
  });

  group('AgRoutePanel — qator bosilishi', () {
    testWidgets('qatorlar o\'z callback\'ini chaqiradi', (tester) async {
      var fromTaps = 0;
      var toTaps = 0;

      await tester.pumpWidget(
        _host(AgRoutePanel(
          from: _from,
          to: _to,
          onTapFrom: () => fromTaps++,
          onTapTo: () => toTaps++,
        )),
      );

      await tester.tap(find.text(_from));
      await tester.pumpAndSettle();
      expect(fromTaps, 1);
      expect(toTaps, 0);

      await tester.tap(find.text(_to));
      await tester.pumpAndSettle();
      expect(fromTaps, 1);
      expect(toTaps, 1);
    });

    testWidgets('callback yo\'q bo\'lsa bosish hech narsa qilmaydi',
        (tester) async {
      await tester.pumpWidget(
        _host(const AgRoutePanel(from: _from, to: _to)),
      );

      await tester.tap(find.text(_from));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('AgRoutePanel — ekran o\'quvchi', () {
    testWidgets('har bir qator o\'z ROLI bilan e\'lon qilinadi',
        (tester) async {
      final handle = tester.ensureSemantics();

      await tester.pumpWidget(
        _host(AgRoutePanel(
          from: _from,
          to: _to,
          distanceLabel: '4.2 km',
          onSwap: () {},
          onTapFrom: () {},
          onTapTo: () {},
        )),
      );

      // Manzil yolg'iz o'qilsa "Angren bozori" nima ekani noma'lum —
      // rol matn bilan birga beriladi.
      expect(find.bySemanticsLabel('Qayerdan: $_from'), findsOneWidget);
      expect(find.bySemanticsLabel('Qayerga: $_to, 4.2 km'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Manzillarni almashtirish'),
        findsOneWidget,
      );

      handle.dispose();
    });
  });
}
