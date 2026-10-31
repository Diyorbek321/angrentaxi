// AgActionRow — teng kenglikdagi amal tugmalari qatori uchun testlar.
//
// Bu testlar KO'RINISHNI emas, **shartnomani** tasdiqlaydi:
//   - amallar teng vaznda (teng kenglikda) turadi
//   - haydovchi o'lchami harakatdagi qo'l uchun 56dp dan katta
//   - buzg'unchi amal `kErrorDeep` bilan ajraladi, lekin ikonka+yozuv ham bor
//   - tugma cheti ko'rinadi (`kLineInteractive`, `kLine` EMAS)
//   - o'chirilgan amal joyini yo'qotmaydi, lekin bosilmaydi
//   - yorliq vizual qirqilsa ham, ekran o'quvchi TO'LIQ nomni o'qiydi
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_action_row.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _host(Widget child, {double width = 320}) => MaterialApp(
      theme: appTheme,
      home: Scaffold(
        body: Center(child: SizedBox(width: width, child: child)),
      ),
    );

/// Har bir tugmaning tashqi qutisi — `Container` faqat tugma ildizida bor.
Finder _buttonBoxes() => find.descendant(
      of: find.byType(AgActionRow),
      matching: find.byType(Container),
    );

void main() {
  group('AgActionRow — tuzilma', () {
    testWidgets('amallar teng kenglikda bo\'linadi', (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
            AgActionItem(
              icon: Icons.chat_bubble_rounded,
              label: 'Xabar',
              onTap: () {},
            ),
            AgActionItem(
              icon: Icons.ios_share_rounded,
              label: 'Ulashish',
              onTap: () {},
            ),
          ],
        ),
      ));

      final widths = <double>[
        for (var i = 0; i < 3; i++) tester.getSize(_buttonBoxes().at(i)).width,
      ];

      expect(_buttonBoxes(), findsNWidgets(3));
      // Uzun yorliq ("Qo'ng'iroq") qatorni qiyshaytirmasligi kerak —
      // teng kenglik "bularning hammasi bir darajadagi tanlov" degani.
      expect(widths.toSet().length, 1);
    });

    testWidgets('bo\'sh ro\'yxat hech narsa chizmaydi', (tester) async {
      await tester.pumpWidget(_host(const AgActionRow(items: [])));

      expect(_buttonBoxes(), findsNothing);
      // Kenglikni ota-widget majburlaydi; muhimi — qator vertikal joy
      // egallamaydi, ya'ni bo'sh oraliq qoldirmaydi.
      expect(tester.getSize(find.byType(AgActionRow)).height, 0);
    });
  });

  group('AgActionRow — ikki o\'lcham', () {
    testWidgets('yo\'lovchi balandligi 52dp', (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
          ],
        ),
      ));

      expect(tester.getSize(_buttonBoxes().first).height, 52);
      expect(AgActionRow.passengerHeight, 52);
    });

    testWidgets('haydovchi bayrog\'i balandlikni 60dp ga ko\'taradi',
        (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          driver: true,
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
          ],
        ),
      ));

      expect(tester.getSize(_buttonBoxes().first).height, 60);
    });

    test('haydovchi nishoni harakatdagi qo\'l uchun 56dp dan katta', () {
      // Yo'l tebranishi, qo'lqop va quyosh aksi 48dp minimal nishonni
      // yetarsiz qiladi — haydovchi ekranida chegara 56dp.
      expect(AgActionRow.driverHeight, greaterThan(56));
      expect(AgActionRow.passengerHeight, greaterThanOrEqualTo(kMinTapTarget));
    });
  });

  group('AgActionRow — ranglar tokenlardan', () {
    testWidgets('fon kSurface, radius kRadiusMd, chegara kLineInteractive',
        (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
          ],
        ),
      ));

      final box = tester.widget<Container>(_buttonBoxes().first);
      final decoration = box.decoration! as BoxDecoration;

      expect(decoration.color, kSurface);
      expect(
        decoration.borderRadius,
        BorderRadius.circular(kRadiusMd),
      );
      // `kLine` (1.22:1) bezak ajratkichi — komponent chetini ko'rsata
      // olmaydi (WCAG 1.4.11 uchun 3:1 kerak).
      expect(decoration.border!.top.color, kLineInteractive);
      expect(decoration.border!.top.color, isNot(kLine));
    });

    testWidgets('oddiy amal kInkMuted, buzg\'unchi amal kErrorDeep',
        (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
            AgActionItem(
              icon: Icons.close_rounded,
              label: 'Bekor qilish',
              onTap: () {},
              destructive: true,
            ),
          ],
        ),
      ));

      expect(
        tester.widget<Text>(find.text('Qo\'ng\'iroq')).style!.color,
        kInkMuted,
      );
      expect(
        tester.widget<Text>(find.text('Bekor qilish')).style!.color,
        kErrorDeep,
      );
      expect(
        tester.widget<Icon>(find.byIcon(Icons.close_rounded)).color,
        kErrorDeep,
      );
      // Rangni ajratmaydigan foydalanuvchi uchun zaxira signal — ikonka
      // shakli va yozuv; ular buzg'unchi amalda ham bor.
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);
      expect(find.text('Bekor qilish'), findsOneWidget);
    });

    testWidgets('yozuv 10sp w700 — ikonka 17sp', (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
          ],
        ),
      ));

      final label = tester.widget<Text>(find.text('Qo\'ng\'iroq')).style!;
      expect(label.fontSize, 10);
      expect(label.fontWeight, FontWeight.w700);

      expect(
        tester.widget<Icon>(find.byIcon(Icons.call_rounded)).size,
        17,
      );
    });
  });

  group('AgActionRow — o\'zaro ta\'sir', () {
    testWidgets('bosish onTap ni chaqiradi', (tester) async {
      var calls = 0;

      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () => calls++,
            ),
          ],
        ),
      ));

      await tester.tap(find.text('Qo\'ng\'iroq'));
      await tester.pumpAndSettle();

      expect(calls, 1);
    });

    testWidgets('onTap null bo\'lsa amal joyida qoladi, lekin bosilmaydi',
        (tester) async {
      var calls = 0;

      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            const AgActionItem(
              icon: Icons.ios_share_rounded,
              label: 'Ulashish',
              onTap: null,
            ),
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () => calls++,
            ),
          ],
        ),
      ));

      // Element yo'qolmaydi: qator qayta joylashsa, mushak xotirasiga
      // tayangan barmoq noto'g'ri tugmaga tushadi.
      expect(_buttonBoxes(), findsNWidgets(2));
      expect(
        tester.widget<Text>(find.text('Ulashish')).style!.color,
        kInkSubtle,
      );

      await tester.tap(find.text('Ulashish'));
      await tester.pumpAndSettle();

      expect(calls, 0);
    });

    testWidgets('har amal o\'z yorlig\'i bilan tugma sifatida e\'lon qilinadi',
        (tester) async {
      await tester.pumpWidget(_host(
        AgActionRow(
          items: [
            AgActionItem(
              icon: Icons.call_rounded,
              label: 'Qo\'ng\'iroq',
              onTap: () {},
            ),
          ],
        ),
      ));

      final semantics = tester.getSemantics(find.text('Qo\'ng\'iroq'));
      expect(semantics.label, 'Qo\'ng\'iroq');
      expect(semantics.hasFlag(SemanticsFlag.isButton), isTrue);
    });
  });

  group('AgActionRow — katta tizim shrifti', () {
    testWidgets('yozuv qirqilmaydi — quti o\'sadi', (tester) async {
      await tester.pumpWidget(MaterialApp(
        theme: appTheme,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
          child: Scaffold(
            body: Center(
              child: SizedBox(
                width: 320,
                child: AgActionRow(
                  items: [
                    AgActionItem(
                      icon: Icons.call_rounded,
                      label: 'Qo\'ng\'iroq',
                      onTap: () {},
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ));

      expect(tester.takeException(), isNull);
      // Balandlik qat'iy 52dp bo'lsa, ikki barobar kattalashgan yozuv
      // qutidan chiqib ketardi.
      expect(
        tester.getSize(_buttonBoxes().first).height,
        greaterThan(AgActionRow.passengerHeight),
      );
    });

    testWidgets('yorliq qirqilsa ham semantika to\'liq nomni saqlaydi',
        (tester) async {
      // Tor qutiga sig'magan yorliq ellipsis bilan qirqiladi. Buzg'unchi
      // amalni faqat yozuv ajratib turadi, shuning uchun ekran o'quvchi
      // TO'LIQ nomni olishi shart — aks holda ko'zi ojiz foydalanuvchi
      // "Bekor qi…" ni eshitib, nima bekor qilinishini bilmaydi.
      await tester.pumpWidget(MaterialApp(
        theme: appTheme,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2.0)),
          child: Scaffold(
            body: Center(
              child: SizedBox(
                width: 240,
                child: AgActionRow(
                  items: [
                    AgActionItem(
                      icon: Icons.call_rounded,
                      label: 'Qo\'ng\'iroq',
                      onTap: () {},
                    ),
                    AgActionItem(
                      icon: Icons.close_rounded,
                      label: 'Bekor qilish',
                      onTap: () {},
                      destructive: true,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ));

      final paragraph =
          tester.renderObject<RenderParagraph>(find.text('Bekor qilish'));
      expect(paragraph.didExceedMaxLines, isTrue, reason: 'yorliq qirqilgan');

      final semantics = tester.getSemantics(find.text('Bekor qilish'));
      expect(semantics.label, 'Bekor qilish');
    });
  });
}
