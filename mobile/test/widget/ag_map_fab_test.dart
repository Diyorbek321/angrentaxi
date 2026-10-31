import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

/// `AgMapFab` va `AgSurfaceCard` uchun testlar.
///
/// Bu testlar KO'RINISHNI emas, **qatlamli tuzilma shartnomasini**
/// tasdiqlaydi:
///   - xarita tugmasi fondan ikkita vosita bilan uziladi (soya + 3:1 chegara)
///   - vizual doira kichik, tegish maydoni hech qachon 48dp dan kichik emas
///   - sheet ichidagi karta CHEGARASIZ — ajratish faqat yuza rangi bilan
Widget _host(Widget child) => MaterialApp(
      theme: appTheme,
      home: Scaffold(body: Center(child: child)),
    );

/// Doira tugmaning O'ZI (tegish maydoni emas) — ikonkaning eng yaqin
/// `Container` ajdodi.
Finder _circleOf(IconData icon) => find
    .ancestor(of: find.byIcon(icon), matching: find.byType(Container))
    .first;

/// `kError` nuqta — faqat `badge: true` bo'lganda chiziladi.
final Finder _badgeDot = find.byWidgetPredicate(
  (widget) =>
      widget is Container &&
      widget.decoration is BoxDecoration &&
      (widget.decoration! as BoxDecoration).color == kError,
);

void main() {
  group('AgMapFab', () {
    testWidgets('standart doira 44dp, large: true da 48dp', (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.my_location,
          semanticsLabel: 'Meni topish',
          onTap: () {},
        ),
      ));
      expect(tester.getSize(_circleOf(Icons.my_location)), const Size(44, 44));

      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.layers,
          semanticsLabel: 'Qatlamlar',
          onTap: () {},
          large: true,
        ),
      ));
      expect(tester.getSize(_circleOf(Icons.layers)), const Size(48, 48));
    });

    testWidgets('tegish maydoni doira kichik bo\'lsa ham 48dp dan kam emas',
        (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.my_location,
          semanticsLabel: 'Meni topish',
          onTap: () {},
        ),
      ));

      final Size tapArea = tester.getSize(find.byType(AgMapFab));
      expect(tapArea.width, greaterThanOrEqualTo(kMinTapTarget));
      expect(tapArea.height, greaterThanOrEqualTo(kMinTapTarget));
    });

    testWidgets('fon kSurface, chegara kLineInteractive — kLine EMAS',
        (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.share_outlined,
          semanticsLabel: 'Safarni ulashish',
          onTap: () {},
        ),
      ));

      final Container circle = tester.widget<Container>(
        _circleOf(Icons.share_outlined),
      );
      final BoxDecoration decoration = circle.decoration! as BoxDecoration;

      expect(decoration.color, kSurface);
      expect(decoration.shape, BoxShape.circle);
      expect(decoration.border!.top.color, kLineInteractive);
      expect(decoration.border!.top.width, 1);
      // `kLine` (1.22:1) bezak ajratkichi — xarita ustida tugmani ANIQLASH
      // uchun WCAG 1.4.11 bo'yicha 3:1 kerak.
      expect(decoration.border!.top.color, isNot(kLine));
    });

    testWidgets('xarita fonida soya bilan ham uziladi', (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.my_location,
          semanticsLabel: 'Meni topish',
          onTap: () {},
        ),
      ));

      final Container circle = tester.widget<Container>(
        _circleOf(Icons.my_location),
      );
      expect((circle.decoration! as BoxDecoration).boxShadow, kShadowPop);
    });

    testWidgets('badge: false da kError nuqta chizilmaydi', (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.sos_outlined,
          semanticsLabel: 'Xavfsizlik',
          onTap: () {},
        ),
      ));

      expect(_badgeDot, findsNothing);
    });

    testWidgets('badge: true da o\'ng yuqorida kError nuqta paydo bo\'ladi',
        (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.sos_outlined,
          semanticsLabel: 'Xavfsizlik',
          onTap: () {},
          badge: true,
        ),
      ));

      expect(_badgeDot, findsOneWidget);

      final Rect circle = tester.getRect(_circleOf(Icons.sos_outlined));
      final Rect dot = tester.getRect(_badgeDot);
      expect(dot.center.dx, greaterThan(circle.center.dx));
      expect(dot.center.dy, lessThan(circle.center.dy));
    });

    testWidgets('bosilganda onTap chaqiriladi', (tester) async {
      int taps = 0;
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.my_location,
          semanticsLabel: 'Meni topish',
          onTap: () => taps++,
        ),
      ));

      await tester.tap(find.byType(AgMapFab));
      await tester.pumpAndSettle();

      expect(taps, 1);
    });

    testWidgets('ekran o\'quvchi tugmani nomi bilan o\'qiydi', (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.my_location,
          semanticsLabel: 'Meni topish',
          onTap: () {},
        ),
      ));

      final SemanticsNode node = tester.getSemantics(find.byType(AgMapFab));
      expect(node.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(node.label, 'Meni topish');
    });

    testWidgets('badge holati ekran o\'quvchiga ham yetadi', (tester) async {
      await tester.pumpWidget(_host(
        AgMapFab(
          icon: Icons.sos_outlined,
          semanticsLabel: 'Xavfsizlik',
          onTap: () {},
          badge: true,
        ),
      ));

      // Nuqta faqat vizual bo'lsa, ko'rmaydigan foydalanuvchi uchun u yo'q.
      final SemanticsNode node = tester.getSemantics(find.byType(AgMapFab));
      expect(node.label, contains('Xavfsizlik'));
      expect(node.label, isNot('Xavfsizlik'));
    });
  });

  group('AgSurfaceCard', () {
    testWidgets('CHEGARASIZ — ajratish faqat yuza rangi bilan',
        (tester) async {
      await tester.pumpWidget(_host(
        const AgSurfaceCard(child: Text('Narx')),
      ));

      final Container box = tester.widget<Container>(
        find.descendant(
          of: find.byType(AgSurfaceCard),
          matching: find.byType(Container),
        ),
      );
      final BoxDecoration decoration = box.decoration! as BoxDecoration;

      expect(decoration.border, isNull);
      expect(decoration.color, kSurface);
      expect(decoration.borderRadius, BorderRadius.circular(kRadiusMd));
    });

    testWidgets('sheet foni bilan bir xil bo\'lmaydi', (tester) async {
      await tester.pumpWidget(_host(
        const ColoredBox(
          color: kSurface2,
          child: AgSurfaceCard(child: Text('To\'lov')),
        ),
      ));

      final Container box = tester.widget<Container>(
        find.descendant(
          of: find.byType(AgSurfaceCard),
          matching: find.byType(Container),
        ),
      );

      expect((box.decoration! as BoxDecoration).color, isNot(kSurface2));
    });

    testWidgets('standart padding kSpace4, berilgani ustun keladi',
        (tester) async {
      await tester.pumpWidget(_host(
        const AgSurfaceCard(child: Text('Narx')),
      ));
      expect(
        tester
            .widget<Container>(find.descendant(
              of: find.byType(AgSurfaceCard),
              matching: find.byType(Container),
            ))
            .padding,
        const EdgeInsets.all(kSpace4),
      );

      await tester.pumpWidget(_host(
        const AgSurfaceCard(
          padding: EdgeInsets.all(kSpace2),
          child: Text('Narx'),
        ),
      ));
      expect(
        tester
            .widget<Container>(find.descendant(
              of: find.byType(AgSurfaceCard),
              matching: find.byType(Container),
            ))
            .padding,
        const EdgeInsets.all(kSpace2),
      );
    });

    testWidgets('background berilsa o\'sha yuza ishlatiladi', (tester) async {
      await tester.pumpWidget(_host(
        const AgSurfaceCard(
          background: kSurface3,
          child: Text('Ichki blok'),
        ),
      ));

      final Container box = tester.widget<Container>(
        find.descendant(
          of: find.byType(AgSurfaceCard),
          matching: find.byType(Container),
        ),
      );

      expect((box.decoration! as BoxDecoration).color, kSurface3);
    });

    testWidgets('child o\'zgartirilmasdan chiziladi', (tester) async {
      await tester.pumpWidget(_host(
        const AgSurfaceCard(child: Text('Yakuniy narx')),
      ));

      expect(find.text('Yakuniy narx'), findsOneWidget);
    });
  });
}
