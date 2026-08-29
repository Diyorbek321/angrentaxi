import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_service_chips.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// `AgServiceChips` — sheet tepasidagi xizmat tanlagichi.
///
/// Testlar KO'RINISHNI emas, **shartnomani** qulflaydi:
///   - yorliqlar faqat chaqiruvchidan keladi (serverga bog'liq ro'yxat)
///   - tanlangan `kInk` + oq (17.50:1), tanlanmagan `kSurface` + `kInkMuted`
///   - tanlanmagan chipni `kLineInteractive` chegarasi ko'rsatadi, `kLine` emas
///   - tegish maydoni 48dp dan kichik emas, vizual chip esa 36dp
///   - tor ekranda toshmaydi — gorizontal skroll
void main() {
  /// Chaqiruvchi beradigan ro'yxat. Widget bu qiymatlarni bilmaydi —
  /// shuning uchun testda ham ular faqat shu yerda e'lon qilinadi.
  const items = <AgServiceChipItem>[
    AgServiceChipItem(
      id: 'taxi',
      label: 'Taksi',
      icon: Icons.local_taxi_rounded,
    ),
    AgServiceChipItem(
      id: 'cargo',
      label: 'Yuk',
      icon: Icons.local_shipping_rounded,
    ),
    AgServiceChipItem(
      id: 'food',
      label: 'Ovqat',
      icon: Icons.restaurant_rounded,
    ),
    AgServiceChipItem(
      id: 'market',
      label: 'Market',
      icon: Icons.storefront_rounded,
    ),
  ];

  /// Chiplarni haqiqiy joyidagidek — balandligi cheklanmagan `Column`
  /// ichida chizadi (sheet tepasi aynan shunday). Bu gorizontal skrollning
  /// cheksiz balandlikda ham xato bermasligini tekshiradi.
  Future<void> pumpChips(
    WidgetTester tester, {
    List<AgServiceChipItem> chipItems = items,
    String? selectedId = 'taxi',
    ValueChanged<String>? onSelect,
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(MaterialApp(
      theme: appTheme,
      home: Scaffold(
        body: Column(
          children: [
            AgServiceChips(
              items: chipItems,
              selectedId: selectedId,
              onSelect: onSelect ?? (_) {},
            ),
          ],
        ),
      ),
    ));
  }

  /// Chipning to'ldirish/chegara qutisi.
  BoxDecoration chipBox(WidgetTester tester, String id) {
    final container = tester.widget<Container>(
      find.descendant(
        of: find.byKey(agServiceChipKey(id)),
        matching: find.byType(Container),
      ),
    );
    return container.decoration! as BoxDecoration;
  }

  TextStyle chipTextStyle(WidgetTester tester, String id) {
    return tester
        .widget<Text>(
          find.descendant(
            of: find.byKey(agServiceChipKey(id)),
            matching: find.byType(Text),
          ),
        )
        .style!;
  }

  group('Ro\'yxat manbai', () {
    testWidgets('yorliqlar chaqiruvchidan keladi — ichkarida ro\'yxat yo\'q',
        (tester) async {
      // Serverdan butunlay boshqa xizmatlar kelgan holat.
      await pumpChips(
        tester,
        chipItems: const [
          AgServiceChipItem(id: 'pharmacy', label: 'Dorixona'),
          AgServiceChipItem(id: 'courier', label: 'Kuryer'),
        ],
        selectedId: 'pharmacy',
      );

      expect(find.text('Dorixona'), findsOneWidget);
      expect(find.text('Kuryer'), findsOneWidget);
      // Widget ichida "Taksi" kabi qattiq kodlangan yorliq bo'lmasligi shart.
      expect(find.text('Taksi'), findsNothing);
    });

    testWidgets('ikonkasiz xizmat ham to\'liq chiziladi', (tester) async {
      await pumpChips(
        tester,
        chipItems: const [AgServiceChipItem(id: 'new', label: 'Yangi xizmat')],
        selectedId: null,
      );

      expect(find.text('Yangi xizmat'), findsOneWidget);
      expect(find.byType(Icon), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('bo\'sh ro\'yxat hech qanday joy egallamaydi', (tester) async {
      await pumpChips(tester, chipItems: const [], selectedId: null);

      expect(find.byType(SingleChildScrollView), findsNothing);
      expect(tester.getSize(find.byType(AgServiceChips)), Size.zero);
    });
  });

  group('Tanlangan / tanlanmagan ko\'rinish', () {
    testWidgets('tanlangan chip kInk fon + oq matn (17.50:1)', (tester) async {
      await pumpChips(tester);

      expect(chipBox(tester, 'taxi').color, kInk);
      expect(chipTextStyle(tester, 'taxi').color, kOnPrimary);
    });

    testWidgets('tanlanmagan chip kSurface fon + kInkMuted matn',
        (tester) async {
      await pumpChips(tester);

      expect(chipBox(tester, 'cargo').color, kSurface);
      expect(chipTextStyle(tester, 'cargo').color, kInkMuted);
    });

    testWidgets('tanlanmagan chipni kLineInteractive chegarasi ko\'rsatadi',
        (tester) async {
      await pumpChips(tester);

      final border = chipBox(tester, 'cargo').border! as Border;
      expect(border.top.color, kLineInteractive);
      // `kLine` (1.22:1) oq fonda ko'rinmaydi — WCAG 1.4.11 uchun yetmaydi.
      expect(border.top.color, isNot(kLine));
    });

    testWidgets('chip to\'liq yumaloq (pill) shaklda', (tester) async {
      await pumpChips(tester);

      expect(
        chipBox(tester, 'taxi').borderRadius,
        BorderRadius.circular(kRadiusFull),
      );
    });

    testWidgets('tanlov o\'zgarganda chip kengligi siljimaydi', (tester) async {
      await pumpChips(tester);
      final unselectedWidth =
          tester.getSize(find.byKey(agServiceChipKey('cargo'))).width;

      await pumpChips(tester, selectedId: 'cargo');
      final selectedWidth =
          tester.getSize(find.byKey(agServiceChipKey('cargo'))).width;

      expect(selectedWidth, unselectedWidth);
    });
  });

  group('Tanlash', () {
    testWidgets('bosilganda onSelect chip id sini qaytaradi', (tester) async {
      String? picked;
      await pumpChips(tester, onSelect: (id) => picked = id);

      await tester.tap(find.byKey(agServiceChipKey('cargo')));
      await tester.pump();

      expect(picked, 'cargo');
    });

    testWidgets('tanlashda select haptikasi yuboriladi', (tester) async {
      final haptics = <MethodCall>[];
      TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'HapticFeedback.vibrate') haptics.add(call);
        return null;
      });
      addTearDown(() {
        TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(SystemChannels.platform, null);
      });

      await pumpChips(tester);
      await tester.tap(find.byKey(agServiceChipKey('food')));
      await tester.pump();

      expect(haptics, isNotEmpty);
      // `AppHaptics.select()`: iOS'da selectionClick, Android'da lightImpact.
      expect(
        const ['HapticFeedbackType.selectionClick',
            'HapticFeedbackType.lightImpact'],
        contains(haptics.last.arguments),
      );
    });
  });

  group('O\'lcham va skroll', () {
    testWidgets('tegish maydoni 48dp, vizual chip 36dp', (tester) async {
      await pumpChips(tester);

      expect(
        tester.getSize(find.byKey(agServiceChipKey('taxi'))).height,
        greaterThanOrEqualTo(kMinTapTarget),
      );
      expect(
        tester
            .getSize(find.descendant(
              of: find.byKey(agServiceChipKey('taxi')),
              matching: find.byType(Container),
            ))
            .height,
        36,
      );
    });

    testWidgets('tor ekranda (320dp) toshib ketmaydi', (tester) async {
      await pumpChips(tester, size: const Size(320, 640));

      expect(tester.takeException(), isNull);
      final scroller = tester.widget<SingleChildScrollView>(
        find.byType(SingleChildScrollView),
      );
      expect(scroller.scrollDirection, Axis.horizontal);
    });

    testWidgets('qator gorizontal suriladi — oxirgi chipga yetish mumkin',
        (tester) async {
      await pumpChips(tester, size: const Size(320, 640));
      final before = tester.getTopLeft(find.byKey(agServiceChipKey('taxi'))).dx;

      await tester.drag(
        find.byType(SingleChildScrollView),
        const Offset(-120, 0),
      );
      await tester.pumpAndSettle();

      expect(
        tester.getTopLeft(find.byKey(agServiceChipKey('taxi'))).dx,
        lessThan(before),
      );
    });
  });

  group('Ekran o\'quvchi', () {
    testWidgets('chip tugma sifatida, tanlangan holati bilan e\'lon qilinadi',
        (tester) async {
      final handle = tester.ensureSemantics();
      await pumpChips(tester);

      final selected = tester.getSemantics(find.byKey(agServiceChipKey('taxi')));
      expect(selected.label, 'Taksi');
      expect(selected.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(selected.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(selected.hasFlag(SemanticsFlag.isInMutuallyExclusiveGroup), isTrue);

      final other = tester.getSemantics(find.byKey(agServiceChipKey('cargo')));
      expect(other.label, 'Yuk');
      expect(other.hasFlag(SemanticsFlag.isSelected), isFalse);

      handle.dispose();
    });

    testWidgets('ekran o\'quvchi chipni faollashtira oladi', (tester) async {
      // `excludeSemantics` ichkaridagi tugma tugunini o'chiradi — agar bosish
      // harakati tashqi `Semantics` da qayta e'lon qilinmasa, TalkBack/VoiceOver
      // foydalanuvchisi chipni ko'radi-yu, tanlay olmaydi.
      final handle = tester.ensureSemantics();
      String? picked;
      await pumpChips(tester, onSelect: (id) => picked = id);

      final node = tester.getSemantics(find.byKey(agServiceChipKey('cargo')));
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);

      // Jest bilan emas, aynan ekran o'quvchi yo'li bilan faollashtiriladi.
      node.owner!.performAction(node.id, SemanticsAction.tap);
      await tester.pump();

      expect(picked, 'cargo');
      handle.dispose();
    });
  });

  group('Model shartnomasi', () {
    test('bir xil id/label/icon — bir xil element (qayta chizishni tejaydi)',
        () {
      const a = AgServiceChipItem(id: 'taxi', label: 'Taksi');
      const b = AgServiceChipItem(id: 'taxi', label: 'Taksi');
      const c = AgServiceChipItem(id: 'taxi', label: 'Такси');

      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a, isNot(c));
    });
  });
}
