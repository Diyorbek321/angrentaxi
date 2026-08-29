import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/adaptive_map_panel.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Responsive/motion fundamenti — bu qatlam 114 ekranga bir joydan ta'sir
/// qiladi, shuning uchun uning xulqi qulflab qo'yilishi kerak.
void main() {
  /// Berilgan ekran o'lchamida bitta widgetni ko'rsatadi.
  Future<void> pumpAt(
    WidgetTester tester,
    Size size,
    Widget child, {
    bool disableAnimations = false,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MediaQuery(
        data: MediaQueryData(
          size: size,
          disableAnimations: disableAnimations,
        ),
        child: MaterialApp(theme: appTheme, home: child),
      ),
    );
  }

  group('breakpointForWidth', () {
    test('window size class chegaralari Material 3 ga mos', () {
      expect(breakpointForWidth(320), Breakpoint.tight);
      expect(breakpointForWidth(359.9), Breakpoint.tight);
      expect(breakpointForWidth(360), Breakpoint.compact);
      expect(breakpointForWidth(599.9), Breakpoint.compact);
      expect(breakpointForWidth(600), Breakpoint.medium);
      expect(breakpointForWidth(904.9), Breakpoint.medium);
      expect(breakpointForWidth(905), Breakpoint.expanded);
      expect(breakpointForWidth(1280), Breakpoint.expanded);
    });
  });

  group('ResponsiveContext', () {
    testWidgets('gutter ekran kengligi bilan o\'sadi', (tester) async {
      final gutters = <double>[];

      for (final width in [320.0, 390.0, 800.0, 1200.0]) {
        await pumpAt(
          tester,
          Size(width, 800),
          Builder(
            builder: (context) {
              gutters.add(context.gutter);
              return const SizedBox.shrink();
            },
          ),
        );
      }

      expect(gutters, [12, 16, 24, 32]);
    });

    testWidgets('telefonda kontent cheklanmaydi, planshetda cheklanadi',
        (tester) async {
      late double phoneLimit;
      late double tabletLimit;

      await pumpAt(
        tester,
        const Size(390, 800),
        Builder(builder: (c) {
          phoneLimit = c.contentMaxWidth;
          return const SizedBox.shrink();
        }),
      );
      await pumpAt(
        tester,
        const Size(1200, 800),
        Builder(builder: (c) {
          tabletLimit = c.contentMaxWidth;
          return const SizedBox.shrink();
        }),
      );

      expect(phoneLimit, double.infinity);
      expect(tabletLimit, 640);
    });

    testWidgets('xarita/panel bo\'linishi 720dp dan boshlanadi',
        (tester) async {
      final results = <bool>[];
      for (final width in [600.0, 719.0, 720.0, 900.0]) {
        await pumpAt(
          tester,
          Size(width, 800),
          Builder(builder: (c) {
            results.add(c.canSplitMapPanel);
            return const SizedBox.shrink();
          }),
        );
      }
      expect(results, [false, false, true, true]);
    });
  });

  group('ResponsiveContent', () {
    testWidgets('planshetda kontent markazda cheklanadi', (tester) async {
      await pumpAt(
        tester,
        const Size(1200, 800),
        const Scaffold(
          body: ResponsiveContent(
            child: SizedBox(
              key: Key('box'),
              width: double.infinity,
              height: 40,
            ),
          ),
        ),
      );

      // 1200dp ekranda ham kontent 640dp dan oshmaydi.
      expect(tester.getSize(find.byKey(const Key('box'))).width, 640);
    });

    testWidgets('telefonda hech narsa cheklamaydi', (tester) async {
      await pumpAt(
        tester,
        const Size(390, 800),
        const Scaffold(
          body: ResponsiveContent(
            child: SizedBox(
              key: Key('box'),
              width: double.infinity,
              height: 40,
            ),
          ),
        ),
      );

      expect(tester.getSize(find.byKey(const Key('box'))).width, 390);
    });
  });

  group('AdaptiveMapPanel', () {
    Widget harness(Size size) => Scaffold(
          body: Stack(
            children: [
              const SizedBox.expand(),
              AdaptiveMapPanel(
                animateIn: false,
                child: Container(key: const Key('content'), height: 100),
              ),
            ],
          ),
        );

    testWidgets('telefonda pastga yopishgan, to\'liq kenglikdagi sheet',
        (tester) async {
      const size = Size(390, 800);
      await pumpAt(tester, size, harness(size));

      final panel = find.byKey(const Key('content'));
      final rect = tester.getRect(panel);

      // Gutter (16) ikki tomondan ayriladi.
      expect(rect.width, 390 - 32);
      // Ekranning pastki qismida.
      expect(rect.bottom, greaterThan(600));
    });

    testWidgets('keng ekranda chapdagi tor yon panel', (tester) async {
      const size = Size(1000, 800);
      await pumpAt(tester, size, harness(size));

      final rect = tester.getRect(find.byKey(const Key('content')));

      // Yon panel `sidePanelWidth` (1000dp → expanded → 420) minus gutter*2.
      expect(rect.width, lessThan(420));
      // Chap chetga yaqin — ekranning o'ng yarmiga umuman kirmaydi.
      expect(rect.left, lessThan(100));
      expect(rect.right, lessThan(500));
    });

    testWidgets('sudrash dastagi faqat sheet rejimida ko\'rinadi',
        (tester) async {
      const phone = Size(390, 800);
      await pumpAt(tester, phone, harness(phone));
      final phoneContainers = tester.widgetList<Container>(find.byType(Container)).length;

      const tablet = Size(1000, 800);
      await pumpAt(tester, tablet, harness(tablet));
      final tabletContainers = tester.widgetList<Container>(find.byType(Container)).length;

      // Sheet rejimida qo'shimcha dastak konteyneri bor.
      expect(phoneContainers, greaterThan(tabletContainers));
    });
  });

  group('AppPressable', () {
    testWidgets('bosilganda kichrayadi, qo\'yilganda qaytadi', (tester) async {
      await pumpAt(
        tester,
        const Size(390, 800),
        Scaffold(
          body: Center(
            child: AppPressable(
              onTap: () {},
              pressedScale: 0.9,
              child: const SizedBox(
                key: Key('target'),
                width: 100,
                height: 100,
              ),
            ),
          ),
        ),
      );

      double scaleOf() => tester
          .widget<AnimatedScale>(find.byType(AnimatedScale))
          .scale;

      expect(scaleOf(), 1.0);

      final gesture = await tester.startGesture(
        tester.getCenter(find.byKey(const Key('target'))),
      );
      // `onTapDown` gesture arenasi hal bo'lgandan keyin chaqiriladi.
      await tester.pump(const Duration(milliseconds: 100));
      expect(scaleOf(), 0.9);

      await gesture.up();
      await tester.pump(const Duration(milliseconds: 100));
      expect(scaleOf(), 1.0);
    });

    testWidgets('bosish hodisasi bir marta chaqiriladi', (tester) async {
      var taps = 0;
      await pumpAt(
        tester,
        const Size(390, 800),
        Scaffold(
          body: Center(
            child: AppPressable(
              onTap: () => taps++,
              child: const SizedBox(
                key: Key('target'),
                width: 100,
                height: 100,
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byKey(const Key('target')));
      await tester.pumpAndSettle();
      expect(taps, 1);
    });
  });

  group('AppMotion', () {
    testWidgets('"harakatni kamaytirish" yoqilganda davomiylik nol',
        (tester) async {
      late Duration reducedDuration;
      late bool isReduced;

      await pumpAt(
        tester,
        const Size(390, 800),
        Builder(builder: (context) {
          isReduced = AppMotion.reduced(context);
          reducedDuration = AppMotion.duration(context, AppMotion.slow);
          return const SizedBox.shrink();
        }),
        disableAnimations: true,
      );

      expect(isReduced, isTrue);
      expect(reducedDuration, Duration.zero);
    });

    testWidgets('odatiy holatda davomiylik saqlanadi', (tester) async {
      late Duration normal;
      await pumpAt(
        tester,
        const Size(390, 800),
        Builder(builder: (context) {
          normal = AppMotion.duration(context, AppMotion.slow);
          return const SizedBox.shrink();
        }),
      );
      expect(normal, AppMotion.slow);
    });
  });

  group('Tema', () {
    test('qorong\'i tema qurilgan va yorug\'idan farq qiladi', () {
      expect(appDarkTheme.brightness, Brightness.dark);
      expect(appTheme.brightness, Brightness.light);
      expect(
        appDarkTheme.scaffoldBackgroundColor,
        isNot(appTheme.scaffoldBackgroundColor),
      );
    });

    test('qorong\'i temada yuzalar balandlik bo\'yicha OCHROQ bo\'ladi', () {
      final scheme = appDarkTheme.colorScheme;
      double lum(Color c) => c.computeLuminance();

      expect(lum(scheme.surface), lessThan(lum(scheme.surfaceContainer)));
      expect(
        lum(scheme.surfaceContainer),
        lessThan(lum(scheme.surfaceContainerHigh)),
      );
    });

    test('qorong\'i tema foni sof qora emas', () {
      // Sof qora OLED ekranlarda "smearing" beradi va kontrastni
      // haddan tashqari keskinlashtiradi.
      expect(appDarkTheme.scaffoldBackgroundColor, isNot(const Color(0xFF000000)));
      expect(appDarkTheme.scaffoldBackgroundColor.computeLuminance(),
          greaterThan(0.0));
    });

    test('ikkala temada ham platformaga mos o\'tishlar belgilangan', () {
      for (final theme in [appTheme, appDarkTheme]) {
        final builders = theme.pageTransitionsTheme.builders;
        expect(builders[TargetPlatform.iOS],
            isA<CupertinoPageTransitionsBuilder>());
        expect(builders[TargetPlatform.android],
            isA<SharedAxisPageTransitionsBuilder>());
      }
    });
  });
}
