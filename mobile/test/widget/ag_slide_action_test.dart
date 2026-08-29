// AgSlideAction — surib bajariladigan haydovchi amali uchun testlar.
//
// Bu testlar ko'rinishni emas, XAVFSIZLIK SHARTNOMASINI qo'riqlaydi:
//   - oddiy teginish amalni BAJARMAYDI (tasodifiy bosish qaytarib
//     bo'lmaydigan amalni ishga tushirmasin)
//   - qisqa surish ham bajarmaydi va tugmacha boshiga qaytadi
//   - 70% dan uzun surish BIR MARTA bajaradi
//   - o'chirilgan holatda hech qanday jest o'tmaydi
//   - surish jesti ekran o'quvchidan yopiq emas: komponent tugma sifatida
//     ochiladi va semantik "tap" amalni bajaradi
//   - o'lchamlar haydovchi shkalasida (yo'lak 64, tugmacha 52)
import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/ag_slide_action.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const double _kHostWidth = 320;

Widget _host(Widget child) => MaterialApp(
      theme: appTheme,
      home: Scaffold(
        body: Center(child: SizedBox(width: _kHostWidth, child: child)),
      ),
    );

/// Tugmachaning yo'lak bo'ylab bosib o'tishi mumkin bo'lgan masofa —
/// komponentdagi hisob bilan bir xil: kenglik - 2*chet - tugmacha.
const double _kTravel = _kHostWidth - 6 * 2 - AgSlideAction.thumbSize;

Finder _thumb() => find.descendant(
      of: find.byType(AgSlideAction),
      matching: find.byIcon(Icons.chevron_right_rounded),
    );

/// Tugmachani [fraction] ulushiga suradi va barmoqni ko'taradi.
Future<void> _slide(WidgetTester tester, double fraction) async {
  await tester.drag(_thumb(), Offset(_kTravel * fraction, 0));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    // Haptika platforma kanaliga chiqadi — testda keraksiz shovqin.
    AppHaptics.enabled = false;
  });

  tearDown(() => AppHaptics.enabled = true);

  group('AgSlideAction — tasodifiy bajarilishdan himoya', () {
    testWidgets('oddiy teginish amalni BAJARMAYDI', (tester) async {
      var completed = 0;
      await tester.pumpWidget(_host(
        AgSlideAction(
          label: 'Safarni yakunlash',
          onCompleted: () => completed++,
        ),
      ));

      await tester.tap(find.byType(AgSlideAction));
      await tester.pumpAndSettle();

      // Aynan shu narsa eski `AlertDialog` da yo'q edi: u yerda ikkinchi
      // teginish amalni bajarardi.
      expect(completed, 0);
    });

    testWidgets('qisqa surish bajarmaydi va tugmacha boshiga qaytadi',
        (tester) async {
      var completed = 0;
      await tester.pumpWidget(_host(
        AgSlideAction(
          label: 'Safarni yakunlash',
          onCompleted: () => completed++,
        ),
      ));

      final home = tester.getTopLeft(_thumb());
      // Chegaradan (0.7) sezilarli past — yo'l chuqurida sirg'algan barmoq.
      await _slide(tester, 0.4);

      expect(completed, 0);
      expect(tester.getTopLeft(_thumb()).dx, moreOrLessEquals(home.dx));
    });

    testWidgets('70% dan uzun surish amalni BIR MARTA bajaradi',
        (tester) async {
      var completed = 0;
      await tester.pumpWidget(_host(
        AgSlideAction(
          label: 'Safarni yakunlash',
          onCompleted: () => completed++,
        ),
      ));

      await _slide(tester, 0.85);

      expect(completed, 1);

      // Bajarilgandan keyin takroriy surish ikkinchi chaqiruv bermaydi —
      // bitta safar ikki marta yakunlanmasligi kerak.
      await _slide(tester, 0.9);
      expect(completed, 1);
    });

    testWidgets('o\'chirilgan holatda surish ham, teginish ham o\'tmaydi',
        (tester) async {
      var completed = 0;
      await tester.pumpWidget(_host(
        AgSlideAction(
          label: 'Safarni yakunlash',
          enabled: false,
          onCompleted: () => completed++,
        ),
      ));

      final home = tester.getTopLeft(_thumb());
      await _slide(tester, 0.95);
      await tester.tap(find.byType(AgSlideAction));
      await tester.pumpAndSettle();

      expect(completed, 0);
      // Tugmacha joyini yo'qotmaydi — yo'qolsa panel balandligi sakrardi.
      expect(tester.getTopLeft(_thumb()).dx, moreOrLessEquals(home.dx));
    });
  });

  group('AgSlideAction — ekran o\'quvchi', () {
    testWidgets('tugma sifatida ochiladi va yorlig\'i to\'liq o\'qiladi',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_host(
        AgSlideAction(label: 'Safarni yakunlash', onCompleted: () {}),
      ));

      expect(
        tester.getSemantics(find.byType(AgSlideAction)),
        containsSemantics(
          isButton: true,
          isEnabled: true,
          hasTapAction: true,
          label: 'Safarni yakunlash',
        ),
      );

      handle.dispose();
    });

    testWidgets('semantik "tap" amalni bajaradi — surish jesti yopiq emas',
        (tester) async {
      final handle = tester.ensureSemantics();
      var completed = 0;
      await tester.pumpWidget(_host(
        AgSlideAction(
          label: 'Safarni yakunlash',
          onCompleted: () => completed++,
        ),
      ));

      tester.semantics.tap(find.semantics.byLabel('Safarni yakunlash'));
      await tester.pumpAndSettle();

      expect(completed, 1);
      handle.dispose();
    });

    testWidgets('o\'chirilgan holatda semantik "tap" ham bajarmaydi',
        (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(_host(
        AgSlideAction(
          label: 'Safarni yakunlash',
          enabled: false,
          onCompleted: () {},
        ),
      ));

      expect(
        tester.getSemantics(find.byType(AgSlideAction)),
        containsSemantics(isButton: true, isEnabled: false),
      );

      handle.dispose();
    });
  });

  group('AgSlideAction — haydovchi o\'lchamlari', () {
    testWidgets('yo\'lak 64dp, tugmacha 52dp', (tester) async {
      await tester.pumpWidget(_host(
        AgSlideAction(label: 'Safarni yakunlash', onCompleted: () {}),
      ));

      expect(
        tester.getSize(find.byType(AgSlideAction)).height,
        kControlHeightDriver,
      );
      expect(AgSlideAction.height, 64);
      expect(AgSlideAction.thumbSize, 52);
      // Chegara 0.7 — fayl izohida asoslangan; tasodifan o'zgartirilmasin.
      expect(AgSlideAction.completionFraction, 0.7);
    });

    testWidgets('yozuv suriladigan sari so\'nadi', (tester) async {
      await tester.pumpWidget(_host(
        AgSlideAction(label: 'Safarni yakunlash', onCompleted: () {}),
      ));

      Opacity labelOpacity() => tester.widget<Opacity>(
            find.ancestor(
              of: find.text('Safarni yakunlash'),
              matching: find.byType(Opacity),
            ),
          );

      expect(labelOpacity().opacity, 1.0);

      // Barmoqni ko'tarmasdan yarim yo'lda ushlab turamiz. Birinchi kichik
      // siljish teginish "slop" iga ketadi — shuning uchun ikki qadamda.
      final gesture = await tester.startGesture(tester.getCenter(_thumb()));
      await tester.pump(const Duration(milliseconds: 16));
      await gesture.moveBy(const Offset(kDragSlopDefault, 0));
      await tester.pump(const Duration(milliseconds: 16));
      await gesture.moveBy(const Offset(_kTravel * 0.5, 0));
      await tester.pump(const Duration(milliseconds: 16));

      expect(labelOpacity().opacity, lessThan(1.0));

      await gesture.up();
      await tester.pumpAndSettle();
    });
  });
}
