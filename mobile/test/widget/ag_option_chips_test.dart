// AgOptionChips — ixcham variant qatori uchun testlar.
//
// Bu testlar KO'RINISHNI emas, **shartnomani** tasdiqlaydi:
//   - faol/nofaol/o'chirilgan holat rangi token bo'yicha ajraladi
//   - nofaol chip chegarasi `kLineInteractive` (WCAG 1.4.11 — 3:1),
//     bezak `kLine` EMAS
//   - vizual quti 34dp bo'lsa ham tegish maydoni 48dp dan kichik emas
//   - `onTap` yorliqni emas, barqaror `id` ni qaytaradi
//   - qator tor ekranda (320dp) toshib ketmaydi va skroll bilan yetiladi
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_option_chips.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host(Widget child) => MaterialApp(
      theme: appTheme,
      home: Scaffold(body: Center(child: child)),
    );

/// Chip qutisining bezagi. Chip ommaviy `agOptionChipKey` orqali topiladi —
/// yorliq bo'yicha qidirish bir xil matnli chiplarda ishonchsiz bo'lardi.
BoxDecoration _decorationOf(WidgetTester tester, String id) {
  final container = tester.widget<AnimatedContainer>(
    find.descendant(
      of: find.byKey(agOptionChipKey(id)),
      matching: find.byType(AnimatedContainer),
    ),
  );
  return container.decoration! as BoxDecoration;
}

Color _borderColorOf(WidgetTester tester, String id) =>
    (_decorationOf(tester, id).border! as Border).top.color;

Color? _labelColorOf(WidgetTester tester, String label) =>
    tester.widget<Text>(find.text(label)).style?.color;

void main() {
  const items = [
    AgOptionChipItem(
      id: 'cash',
      label: 'Naqd',
      icon: Icons.payments_rounded,
      active: true,
    ),
    AgOptionChipItem(
      id: 'card',
      label: 'Karta',
      icon: Icons.credit_card_rounded,
    ),
    AgOptionChipItem(id: 'promo', label: 'Promokod'),
  ];

  group('AgOptionChips — ko\'rinish shartnomasi', () {
    testWidgets('barcha variantlar bitta qatorda chiziladi', (tester) async {
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: (_) {})),
      );

      expect(find.text('Naqd'), findsOneWidget);
      expect(find.text('Karta'), findsOneWidget);
      expect(find.text('Promokod'), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsOneWidget);
    });

    testWidgets('faol chip kMintTint fon + kPrimary matn oladi',
        (tester) async {
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: (_) {})),
      );

      expect(_decorationOf(tester, 'cash').color, kMintTint);
      expect(_borderColorOf(tester, 'cash'), kPrimary);
      expect(_labelColorOf(tester, 'Naqd'), kPrimary);
      // Mint yorug' fonda 2.12:1 — matn rangi sifatida bo'lishi mumkin emas.
      expect(_labelColorOf(tester, 'Naqd'), isNot(kMint));
    });

    testWidgets('nofaol chip kSurface fon + kLineInteractive chegara',
        (tester) async {
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: (_) {})),
      );

      expect(_decorationOf(tester, 'card').color, kSurface);
      expect(_labelColorOf(tester, 'Karta'), kInk);
      // `kLine` (1.22:1) komponentni aniqlash uchun yetarli emas —
      // chip oq sheet ustida ko'rinmay qolardi.
      expect(_borderColorOf(tester, 'card'), kLineInteractive);
      expect(_borderColorOf(tester, 'card'), isNot(kLine));
    });

    testWidgets('chip radiusi to\'liq (pill)', (tester) async {
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: (_) {})),
      );

      expect(
        _decorationOf(tester, 'promo').borderRadius,
        BorderRadius.circular(kRadiusFull),
      );
    });

    testWidgets('ikonka ixtiyoriy — ikonkasiz chip ham chiziladi',
        (tester) async {
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: (_) {})),
      );

      expect(
        find.descendant(
          of: find.byKey(agOptionChipKey('promo')),
          matching: find.byType(Icon),
        ),
        findsNothing,
      );
      expect(
        find.descendant(
          of: find.byKey(agOptionChipKey('cash')),
          matching: find.byIcon(Icons.payments_rounded),
        ),
        findsOneWidget,
      );
    });

    testWidgets('bo\'sh ro\'yxatda hech narsa chizilmaydi', (tester) async {
      await tester.pumpWidget(
        _host(const AgOptionChips(items: [], onTap: _noop)),
      );

      expect(find.byType(SingleChildScrollView), findsNothing);
    });
  });

  group('AgOptionChips — bosish', () {
    testWidgets('bosilganda yorliq emas, id qaytadi', (tester) async {
      final tapped = <String>[];
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: tapped.add)),
      );

      await tester.tap(find.text('Karta'));
      await tester.tap(find.text('Promokod'));
      await tester.pumpAndSettle();

      expect(tapped, ['card', 'promo']);
    });

    testWidgets('o\'chirilgan chip bosilmaydi va bo\'shashgan ko\'rinadi',
        (tester) async {
      final tapped = <String>[];
      await tester.pumpWidget(
        _host(AgOptionChips(
          items: const [
            AgOptionChipItem(id: 'card', label: 'Karta', enabled: false),
          ],
          onTap: tapped.add,
        )),
      );

      await tester.tap(find.text('Karta'));
      await tester.pumpAndSettle();

      expect(tapped, isEmpty);
      expect(_decorationOf(tester, 'card').color, kSurface2);
      expect(_borderColorOf(tester, 'card'), kLine);
      expect(_labelColorOf(tester, 'Karta'), kInkSubtle);
    });
  });

  group('AgOptionChips — qulaylik', () {
    testWidgets('vizual quti 34dp, tegish maydoni 48dp dan kichik emas',
        (tester) async {
      await tester.pumpWidget(
        _host(AgOptionChips(items: items, onTap: (_) {})),
      );

      final tapTarget =
          tester.getSize(find.byKey(agOptionChipKey('cash')));
      final box = tester.getSize(
        find.descendant(
          of: find.byKey(agOptionChipKey('cash')),
          matching: find.byType(AnimatedContainer),
        ),
      );

      expect(tapTarget.height, greaterThanOrEqualTo(kMinTapTarget));
      // Ixchamlik SHU YERDA: quti kichik qoladi, faqat tegish maydoni katta.
      expect(box.height, lessThan(kMinTapTarget));
      expect(box.height, 34);
    });

    testWidgets('semantikada tugma roli, tanlangan holat va yorliq bor',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        _host(const AgOptionChips(
          items: [
            AgOptionChipItem(
              id: 'schedule',
              label: '14:30',
              active: true,
              semanticsLabel: 'Safar vaqti 14:30',
            ),
          ],
          onTap: _noop,
        )),
      );

      final node = tester.getSemantics(
        find.byKey(agOptionChipKey('schedule')),
      );

      expect(node.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(node.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(node.hasFlag(SemanticsFlag.isEnabled), isTrue);
      // Yorliq yolg'iz "14:30" bo'lsa ekran o'quvchi nima ekanini aytmaydi.
      expect(node.label, 'Safar vaqti 14:30');
      // `excludeSemantics` ichki tugmani o'chirgani uchun harakat qatlami
      // tashqarida e'lon qilingan — bo'lmasa chip faollashtirilmasdi.
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);

      handle.dispose();
    });

    testWidgets('o\'chirilgan chip semantikada ham o\'chiq', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        _host(const AgOptionChips(
          items: [
            AgOptionChipItem(id: 'card', label: 'Karta', enabled: false),
          ],
          onTap: _noop,
        )),
      );

      final node = tester.getSemantics(
        find.byKey(agOptionChipKey('card')),
      );

      expect(node.hasFlag(SemanticsFlag.isEnabled), isFalse);
      expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isFalse);

      handle.dispose();
    });

    testWidgets('320dp ekranda qator toshmaydi, oxirgi chip skroll bilan '
        'bosiladi', (tester) async {
      // ⚠️ Eng tor qurilma (iPhone SE / arzon Android) — qat'iy `Row`
      // aynan shu yerda "RenderFlex overflowed" berardi.
      tester.view.physicalSize = const Size(320 * 3, 640 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      final tapped = <String>[];
      await tester.pumpWidget(
        _host(AgOptionChips(
          items: const [
            AgOptionChipItem(
              id: 'cash',
              label: 'Naqd',
              icon: Icons.payments_rounded,
            ),
            AgOptionChipItem(
              id: 'card',
              label: 'Karta',
              icon: Icons.credit_card_rounded,
            ),
            AgOptionChipItem(id: 'promo', label: 'Promokod'),
            AgOptionChipItem(id: 'note', label: 'Haydovchiga izoh'),
          ],
          onTap: tapped.add,
        )),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      await tester.drag(
        find.byType(SingleChildScrollView),
        const Offset(-260, 0),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Haydovchiga izoh').hitTestable(),
        findsOneWidget,
        reason: 'oxirgi chip skrolldan keyin ham bosilmaydi',
      );

      await tester.tap(find.text('Haydovchiga izoh'));
      await tester.pumpAndSettle();

      expect(tapped, ['note']);
    });
  });

  group('Model shartnomasi', () {
    test('bir xil maydonlar — bir xil element (qayta chizishni tejaydi)', () {
      const a = AgOptionChipItem(id: 'cash', label: 'Naqd');
      const b = AgOptionChipItem(id: 'cash', label: 'Naqd');
      const c = AgOptionChipItem(id: 'cash', label: 'Naqd', active: true);

      expect(a, b);
      expect(a.hashCode, b.hashCode);
      // Holat ham tenglikka kiradi: aks holda faol/nofaol almashganda
      // ro'yxat "o'zgarmagan" deb hisoblanib, chip qayta chizilmasdi.
      expect(a, isNot(c));
    });

    test('copyWith faqat berilgan maydonni almashtiradi', () {
      const base = AgOptionChipItem(id: 'card', label: 'Karta');

      expect(base.copyWith(active: true).active, isTrue);
      expect(base.copyWith(active: true).id, 'card');
      expect(base.copyWith(label: 'Карта').active, isFalse);
    });
  });
}

void _noop(String _) {}
