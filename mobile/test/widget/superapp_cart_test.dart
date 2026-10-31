// XARAKTERISTIK TEST — `superapp/screens/cart_screen.dart`.
//
// Bu ekranda avval BITTA ham test yo'q edi, ya'ni savat hisobini vizual
// qayta qurish paytida buzilsa, buni hech narsa ushlamasdi. Shuning uchun
// pastdagi testlar avval HOZIRGI xulq-atvorni qulflaydi (yashil), keyingina
// ekran qayta quriladi.
//
// ⚠️ ENG MUHIM TEKSHIRUV — YARASHISH INVARIANTI (`price rows reconcile`):
// ekranda ko'rinadigan narx qatorlarining yig'indisi ko'rinadigan "Jami" ga
// TENG bo'lishi shart. Checkout'da paydo bo'ladigan "kutilmagan haq" —
// savat tashlashning birinchi sababi, shuning uchun bu shart testda
// qulflanadi, izohda emas.
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Narxlar ataylab shunday tanlangan: oraliq summa, yetkazib berish haqi va
/// jami — uchalasi HAR XIL satr beradi, shuning uchun `find.text` bir
/// qatorni ikkinchisi bilan adashtira olmaydi.
const _somsa = CartItem(
  id: 'dish-1',
  name: 'Somsa',
  price: 12000,
  qty: 2, // 24 000
  icon: Icons.lunch_dining_rounded,
  color: kPrimary,
);

const _cola = CartItem(
  id: 'dish-2',
  name: 'Cola 0.5',
  price: 8000,
  qty: 1, // 8 000
  icon: Icons.local_drink_rounded,
  color: kPrimary,
);

void main() {
  late MockApiClient apiClient;
  late SuperappProvider superapp;

  setUp(() {
    apiClient = MockApiClient();
    superapp = SuperappProvider(apiClient: apiClient);
  });

  Future<void> pumpCart(WidgetTester tester, {bool embedded = false}) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<SuperappProvider>.value(
        value: superapp,
        child: MaterialApp(home: CartScreen(embedded: embedded)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets("bo'sh savat mahsulot qo'shishga chaqiradi, CTA ko'rsatmaydi",
      (tester) async {
    await pumpCart(tester);

    expect(find.text("Savat bo'sh"), findsOneWidget);
    expect(find.textContaining('Rasmiylashtirish'), findsNothing);
  });

  testWidgets("mahsulot qo'shilganda nomi va qator jami ko'rinadi",
      (tester) async {
    superapp.addToCart(_somsa);
    superapp.addToCart(_cola);

    await pumpCart(tester);

    expect(find.text('Somsa'), findsOneWidget);
    expect(find.text('Cola 0.5'), findsOneWidget);
    // Qator jami = narx * miqdor, dona narxi emas.
    expect(find.text(Formatters.formatSom(24000)), findsOneWidget);
    expect(find.text(Formatters.formatSom(8000)), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets("'+' miqdorni va jamini oshiradi", (tester) async {
    superapp.addToCart(_cola);
    await pumpCart(tester);

    expect(superapp.cartSubtotal, 8000);

    await tester.tap(find.bySemanticsLabel('Miqdorni oshirish').first);
    await tester.pumpAndSettle();

    expect(superapp.cart.single.qty, 2);
    expect(superapp.cartSubtotal, 16000);
    expect(find.text(Formatters.formatSom(16000)), findsWidgets);
  });

  testWidgets("'−' oxirgi donani olib tashlaganda mahsulot savatdan chiqadi",
      (tester) async {
    superapp.addToCart(_cola);
    await pumpCart(tester);

    await tester.tap(find.bySemanticsLabel('Miqdorni kamaytirish').first);
    await tester.pumpAndSettle();

    expect(superapp.isCartEmpty, isTrue);
    expect(find.text('Cola 0.5'), findsNothing);
    expect(find.text("Savat bo'sh"), findsOneWidget);
  });

  testWidgets('YARASHISH: ko\'rinadigan qatorlar yig\'indisi jamiga teng',
      (tester) async {
    superapp.addToCart(_somsa);
    superapp.addToCart(_cola);

    await pumpCart(tester);

    const subtotal = 32000.0; // 24 000 + 8 000
    final fee = superapp.deliveryFee;
    final total = subtotal + fee;

    // 1) Har bir tashkil etuvchi ALOHIDA ko'rinadi — jami "qayerdandir"
    //    kelib qolgan raqam emas.
    expect(find.text(Formatters.formatSom(subtotal)), findsWidgets);
    expect(find.text(Formatters.formatSom(fee)), findsWidgets);

    // 2) Ekrandagi jami aynan shu qatorlarning yig'indisi.
    expect(superapp.cartTotal, total);
    expect(find.text(Formatters.formatSom(total)), findsWidgets);

    // 3) Yetkazib berish haqi checkout'da emas, AYNAN SHU YERDA aytiladi.
    expect(find.text('Yetkazib berish'), findsOneWidget);
    expect(find.text('Mahsulotlar'), findsOneWidget);
    expect(find.text('Jami'), findsOneWidget);
  });

  testWidgets('CTA da jami takrorlanadi — bosishdan oldingi oxirgi tasdiq',
      (tester) async {
    superapp.addToCart(_somsa);
    await pumpCart(tester);

    final total = Formatters.formatSom(superapp.cartTotal);
    expect(
      find.textContaining(total),
      findsWidgets,
      reason: 'CTA yozuvida summa bo\'lmasa, yo\'lovchi nimani tasdiqlayotganini '
          'bosgandan keyin biladi',
    );
    // `·` bilan: qayta qurishdan keyin ekranda ishonch qatori ham bor
    // ("Rasmiylashtirishda qo'shimcha haq qo'shilmaydi"), CTA esa aynan
    // summa bilan ajratilgan yozuv.
    expect(find.textContaining('Rasmiylashtirish ·'), findsOneWidget);
    expect(
      find.text("Rasmiylashtirishda qo'shimcha haq qo'shilmaydi."),
      findsOneWidget,
      reason: 'Yashirin haq yo\'qligi OCHIQ aytilishi kerak',
    );
  });

  // Ko'rinish darajasidagi yarashish tekshiruvlari — pastda, alohida
  // guruhda (o'z `setUp` i bilan).
  group('yarashish invarianti (ko\'rinish darajasi)', _reconciliationTests);
}

// ============================================================================
// KUCHAYTIRILGAN YARASHISH TEKSHIRUVI.
//
// Yuqoridagi "YARASHISH" testi qatorlarning BORLIGINI tekshiradi, lekin
// jamini TESTNING O'ZI qo'shib chiqadi (`subtotal + fee`) — ya'ni u ekran
// bilan provayder bir xil arifmetikani takrorlayotganini tasdiqlaydi, EKRANDA
// ko'rinadigan uchta raqam bir-biriga to'g'ri kelishini emas. Pastdagi
// testlar aynan EKRANDAN o'qilgan raqamlar bilan ishlaydi.
// ============================================================================

/// "12 000 so'm" → 12000. Formatlash o'zgarsa ham (bo'shliq, birlik) test
/// raqamni topa oladi.
double _parseSom(String text) {
  final digits = text.replaceAll(RegExp(r'[^0-9]'), '');
  expect(digits, isNotEmpty, reason: '"$text" ichida raqam yo\'q');
  return double.parse(digits);
}

/// Yorliq turgan QATORdagi summani ekranning o'zidan o'qiydi.
/// Qatorda yorliqdan boshqa bittagina matn bo'lishi shart — aks holda
/// "qaysi raqamni o'qidik" degan savol tug'iladi va test yolg'on gapiradi.
double _shownAmountFor(WidgetTester tester, String label) {
  final row =
      find.ancestor(of: find.text(label), matching: find.byType(Row)).first;
  final values = tester
      .widgetList<Text>(find.descendant(of: row, matching: find.byType(Text)))
      .map((t) => t.data)
      .whereType<String>()
      .where((s) => s != label)
      .toList();
  expect(values, hasLength(1),
      reason: '"$label" qatorida aynan bitta summa bo\'lishi kerak');
  return _parseSom(values.single);
}

/// Jamini o'zgartirib, qatorlar ro'yxatini o'zgartirmagan "kelajakdagi
/// dasturchi". Invariant TIRIK bo'lsa, ekran shu provayder bilan qurilishda
/// yiqilishi kerak.
class _HiddenFeeProvider extends SuperappProvider {
  _HiddenFeeProvider({required super.apiClient});

  @override
  double get cartTotal => super.cartTotal + 5000;
}

void _reconciliationTests() {
  late MockApiClient apiClient;

  setUp(() => apiClient = MockApiClient());

  testWidgets('EKRANDAGI qatorlar yig\'indisi EKRANDAGI jamiga teng',
      (tester) async {
    final superapp = SuperappProvider(apiClient: apiClient)
      ..addToCart(_somsa)
      ..addToCart(_cola);

    await tester.pumpWidget(
      ChangeNotifierProvider<SuperappProvider>.value(
        value: superapp,
        child: const MaterialApp(home: CartScreen()),
      ),
    );
    await tester.pumpAndSettle();

    // Uchala raqam ham EKRANDAN o'qiladi — test hech narsani qayta
    // hisoblamaydi, shuning uchun ekran va provayder birga adashsa ham
    // (ikkalasi bir xil xato formulani ishlatsa) bu tekshiruv o'z kuchida
    // qoladi: ko'ringan uchta raqam bir-biriga to'g'ri kelishi shart.
    final goods = _shownAmountFor(tester, 'Mahsulotlar');
    final delivery = _shownAmountFor(tester, 'Yetkazib berish');
    final total = _shownAmountFor(tester, 'Jami');

    expect(
      goods + delivery,
      total,
      reason: "Ko'ringan qatorlar jamini bermasa, yo'lovchi farqni "
          "checkout'da topadi — savat aynan shu sababdan tashlanadi",
    );
    expect(goods, 32000, reason: '24 000 + 8 000');
    expect(delivery, greaterThan(0),
        reason: 'Yetkazib berish haqi savatda OLDINDAN aytilishi kerak');

    // CTA dagi summa ham o'sha ekrandagi jami — boshqa hisob emas.
    final ctaLabel = tester
        .widgetList<Text>(find.textContaining('Rasmiylashtirish ·'))
        .single
        .data!;
    expect(_parseSom(ctaLabel.split('·').last), total);
  });

  testWidgets("qator jami = dona narxi × miqdor, va qatorlar 'Mahsulotlar' ni beradi",
      (tester) async {
    final superapp = SuperappProvider(apiClient: apiClient)
      ..addToCart(_somsa)
      ..addToCart(_cola);

    await tester.pumpWidget(
      ChangeNotifierProvider<SuperappProvider>.value(
        value: superapp,
        child: const MaterialApp(home: CartScreen()),
      ),
    );
    await tester.pumpAndSettle();

    // Har bir mahsulot qatorida "12 000 so'm × 2" ko'rinadi — qator jami
    // "qayerdandir" kelgan raqam emas.
    expect(find.text("${Formatters.formatSom(12000)} × 2"), findsOneWidget);
    expect(find.text("${Formatters.formatSom(8000)} × 1"), findsOneWidget);

    // Va mahsulot qatorlarining yig'indisi aynan "Mahsulotlar" qatoriga teng.
    final lineTotals = superapp.cart.map((c) => c.lineTotal).toList();
    expect(lineTotals.reduce((a, b) => a + b),
        _shownAmountFor(tester, 'Mahsulotlar'));
  });

  testWidgets('yashirin haq qo\'shilsa ekran QURILISHDA yiqiladi (invariant tirik)',
      (tester) async {
    // Bu test invariantning O'ZINI tekshiradi. Usiz `assert` shunchaki
    // izoh bo'lib qolardi: hech kim uni buzganda nima bo'lishini bilmasdi.
    final drifting = _HiddenFeeProvider(apiClient: apiClient)..addToCart(_cola);

    await tester.pumpWidget(
      ChangeNotifierProvider<SuperappProvider>.value(
        value: drifting,
        child: const MaterialApp(home: CartScreen()),
      ),
    );

    expect(
      tester.takeException(),
      isA<AssertionError>(),
      reason: "Jamiga qo'shilgan, lekin qatorlarda ko'rinmaydigan haq "
          'ishlab chiqishda TO\'XTATILISHI kerak',
    );
  });
}
