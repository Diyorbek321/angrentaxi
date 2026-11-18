// XARAKTERISTIK TESTLAR — `WalletScreen` daftar (ledger) qismi.
//
// `superapp_wallet_screen_test.dart` faqat BALANSni qulflaydi. Bu fayl
// vizual qayta qurishdan OLDIN yozildi va hozirgi xulq-atvorga qarshi
// o'tkazildi, chunki qayta qurishda eng oson buziladigan ikkita shartnoma
// aynan shu yerda:
//
//   1. BITTA HAMYON QOIDASI — safar to'lovi, hisob to'ldirish va pul
//      yechish bitta oqimda, xizmat bo'yicha ajratilmagan holda,
//      serverdan kelgan TARTIBDA turadi. Agar kimdir keyinchalik
//      "Taksi / Ovqat / Market" filtrlariga bo'lib yuborsa, tartib
//      buziladi va bu test yiqiladi.
//   2. KIRIM/CHIQIM ikki mustaqil signal bilan farqlanadi: ISHORA
//      (+ / −) va RANG. Faqat rang yetarli emas — rang ajratolmaydigan
//      foydalanuvchi pul kirdimi yoki chiqdimi, bilolmay qoladi.
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/screens/wallet_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Uchta TURLI xizmat/harakat — safar to'lovi (debet), hisob to'ldirish
/// (kredit) va pul yechish (debet). Ular ataylab aralash tartibda keladi.
const List<Map<String, dynamic>> _ledger = [
  {
    'id': 'txn-1',
    'amount': 18000,
    'type': 'debit',
    'status': 'completed',
    'createdAt': '2026-08-20T09:00:00.000Z',
    'orderId': 'order-7',
  },
  {
    'id': 'txn-2',
    'amount': 50000,
    'type': 'credit',
    'status': 'completed',
    'createdAt': '2026-08-19T09:00:00.000Z',
  },
  {
    'id': 'txn-3',
    'amount': 30000,
    'type': 'debit',
    'status': 'completed',
    'createdAt': '2026-08-18T09:00:00.000Z',
    'externalId': 'withdrawal_12',
  },
];

void main() {
  late MockApiClient apiClient;
  late SuperappProvider superapp;

  setUp(() async {
    // Daftar qatorlari sanani 'uz' lokal bilan formatlaydi.
    await initializeDateFormatting('uz', null);

    apiClient = MockApiClient();
    superapp = SuperappProvider(apiClient: apiClient);

    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions: RequestOptions(path: ApiEndpoints.paymentsWallet),
        data: {
          'success': true,
          'data': {'userId': 'user-1', 'balance': 87000},
        },
      ),
    );

    when(() => apiClient.get(
          ApiEndpoints.paymentsTransactions,
          params: any(named: 'params'),
        )).thenAnswer(
      (_) async => Response<dynamic>(
        requestOptions:
            RequestOptions(path: ApiEndpoints.paymentsTransactions),
        data: {
          'success': true,
          'data': {
            'transactions': _ledger,
            'total': _ledger.length,
            'page': 1,
            'limit': 20,
          },
        },
      ),
    );
  });

  Future<void> pumpWallet(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<SuperappProvider>.value(
        value: superapp,
        child: const MaterialApp(home: WalletScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
      'safar, to\'ldirish va pul yechish BITTA oqimda, server tartibida turadi',
      (tester) async {
    await pumpWallet(tester);

    final trip = find.text("Safar to'lovi");
    final topUp = find.text("Hisob to'ldirildi");
    final withdrawal = find.text('Pul yechish');

    expect(trip, findsOneWidget);
    expect(topUp, findsOneWidget);
    expect(withdrawal, findsOneWidget);

    // Xizmat bo'yicha guruhlash bo'lganda tartib o'zgarardi — bu yerda u
    // serverdan kelgan tartibda, ya'ni bitta uzluksiz daftar.
    final tripY = tester.getTopLeft(trip).dy;
    final topUpY = tester.getTopLeft(topUp).dy;
    final withdrawalY = tester.getTopLeft(withdrawal).dy;
    expect(tripY, lessThan(topUpY));
    expect(topUpY, lessThan(withdrawalY));
  });

  testWidgets('kirim/chiqim ISHORA va RANG — ikkalasi ham bor', (tester) async {
    await pumpWallet(tester);

    // Raqam matnini `Formatters` ning O'ZI hosil qiladi — 'uz_UZ' guruh
    // ajratkichi oddiy probel emas (uzilmas probel), shuning uchun uni
    // testda qo'lda yozish mo'rt bo'lardi.
    String amount(double v) => Formatters.formatAmount(v);

    final credit = tester.widget<Text>(find.text('+${amount(50000)}'));
    final debitTrip = tester.widget<Text>(find.text('−${amount(18000)}'));
    final debitWithdrawal =
        tester.widget<Text>(find.text('−${amount(30000)}'));

    // 1-signal: ishora. `find.text` allaqachon uni tekshirdi, lekin niyat
    // yozib qo'yilsin — matnning O'ZI ma'no tashiydi.
    expect(credit.data, startsWith('+'));
    expect(debitTrip.data, startsWith('−'));
    expect(debitWithdrawal.data, startsWith('−'));

    // 2-signal: rang. Kirim va chiqim bir xil rangda bo'lmasligi kerak.
    final creditColor = credit.style?.color;
    final debitColor = debitTrip.style?.color;
    expect(creditColor, isNotNull);
    expect(debitColor, isNotNull);
    expect(creditColor, isNot(debitColor));
  });

  // --- Qayta qurishdan KEYIN qo'shilgan regressiya qulflari ---------------

  testWidgets('qatlamli yuza: ekran foni kSurface2, balans kartasi kInk',
      (tester) async {
    await pumpWallet(tester);

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
    expect(scaffold.backgroundColor, kSurface2);

    // Hero karta TEKIS kInk — gradient emas. Sabab: gradientning och
    // uchida oq matn 12.36:1, tekis kInk ustida esa 17.5:1, ya'ni balans
    // raqami kartaning har bir nuqtasida eng yuqori kontrastda.
    final hero = tester.widget<Container>(
      find
          .ancestor(
            of: find.text(Formatters.formatAmount(87000)),
            matching: find.byType(Container),
          )
          .last,
    );
    expect((hero.decoration! as BoxDecoration).color, kInk);
    expect((hero.decoration! as BoxDecoration).gradient, isNull);
  });

  testWidgets('balans raqami ekrandagi eng katta matn', (tester) async {
    await pumpWallet(tester);

    final amount =
        tester.widget<Text>(find.text(Formatters.formatAmount(87000)));
    expect(amount.style?.fontSize, kFontDisplay);

    // Ierarxiya "eng ishonchli element" da bo'lishi uchun undan yirikroq
    // matn ekranda bo'lmasligi kerak.
    for (final text in tester.widgetList<Text>(find.byType(Text))) {
      final size = text.style?.fontSize;
      if (size == null) continue;
      expect(size, lessThanOrEqualTo(kFontDisplay),
          reason: '"${text.data}" balans raqamidan yirikroq');
    }
  });

  testWidgets(
      "balans kartasi gapiriladi, ammo \"To'ldirish\" tugmasini yutmaydi",
      (tester) async {
    final handle = tester.ensureSemantics();
    await pumpWallet(tester);

    // Sarlavha + raqam BITTA jumla bo'lib o'qiladi — ekran o'quvchi
    // "Angren Go balans", "87 000", "so'm" deb uch marta to'xtamaydi.
    expect(
      find.bySemanticsLabel("Hamyon balansi ${Formatters.formatAmount(87000)} so'm"),
      findsOneWidget,
    );

    // ⚠️ REGRESSIYA QULFI. Kartani butunlay `excludeSemantics: true` bilan
    // o'rash oson va ko'zga ko'rinmaydi — lekin u ostidagi yagona ishlaydigan
    // tugmani ekran o'quvchidan BUTUNLAY yashiradi. Shuning uchun tugma
    // alohida tugun bo'lib qolishi shu yerda qulflanadi.
    expect(find.bySemanticsLabel("To'ldirish"), findsOneWidget);

    handle.dispose();
  });

  testWidgets('daftar qatori yo\'nalishni SO\'Z bilan ham aytadi',
      (tester) async {
    final handle = tester.ensureSemantics();
    await pumpWallet(tester);

    // 3-signal (rang va ishoradan tashqari): so'zning o'zi. Rang
    // ajratolmaydigan yoki ekran o'quvchidan foydalanadigan yo'lovchi
    // pul KIRDIMI yoki CHIQDIMI — buni eshitib bilishi kerak.
    expect(
      find.bySemanticsLabel(RegExp(r"Hisob to'ldirildi, .* kirim,")),
      findsOneWidget,
    );
    expect(
      find.bySemanticsLabel(RegExp(r"Safar to'lovi, .* chiqim,")),
      findsOneWidget,
    );

    handle.dispose();
  });
}
