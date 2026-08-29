import 'package:angren_taxi/shared/models/order_receipt.dart';
import 'package:angren_taxi/shared/utils/receipt_formatter.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Chek — moliyaviy hujjat, shuning uchun bu testlar ko'rinishni emas,
/// AYNAN RAQAMLARNI qo'riqlaydi: qatorlar jamiga qo'shiladimi, chaqim
/// yakuniyga kiradimi va tarkib yo'q bo'lganda soxta qator paydo bo'lmaydimi.
/// Ekranda ko'rinadigan summani butun songa qaytaradi.
///
/// ⚠️ Manfiy qator ASCII defis emas, MATEMATIK MINUS (U+2212) bilan
/// chiziladi. Testda buni hisobga olmaslik "−7 113" ni +7 113 deb o'qib,
/// ustunni yolg'ondan to'g'ri ko'rsatib qo'yadi.
int asShown(String formatted) {
  final negative = formatted.startsWith('\u2212') || formatted.startsWith('-');
  final digits = int.parse(formatted.replaceAll(RegExp(r'[^0-9]'), ''));
  return negative ? -digits : digits;
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('uz');
  });

  Map<String, dynamic> fareJson() => {
        'baseFare': 8000,
        'distanceKm': 7.4,
        'pricePerKm': 2500,
        'distanceFare': 18500,
        'durationMin': 18,
        'pricePerMin': 300,
        'timeFare': 5400,
        'minPriceAdjustment': 0,
        'surgeMultiplier': 1.4,
        'surgeFare': 12760,
        'maxPriceCap': 0,
        'total': 44660,
      };

  Map<String, dynamic> receiptJson({
    bool withFare = true,
    double tipAmount = 0,
    double discountAmount = 0,
  }) =>
      {
        'orderId': '3f9c1d2a-0000-0000-0000-000000000000',
        'orderNumber': 'A3F9C1D2',
        'completedAt': '2026-08-12T09:31:00.000Z',
        'serviceType': 'taxi',
        'pickupAddress': 'Angren, Navoiy 12',
        'dropoffAddress': 'Angren, Do\'stlik 4',
        'waypoints': [
          {'address': 'Angren, Bozor', 'lat': 41.0, 'lng': 70.1},
        ],
        'tariffId': 'tariff-komfort',
        'tariffName': 'Komfort',
        'distanceKm': 7.4,
        'durationMin': 18,
        'fare': withFare ? fareJson() : null,
        'surgeMultiplier': 1.4,
        'grossPrice': 44660,
        'discountAmount': discountAmount,
        'promoCode': discountAmount > 0 ? 'YANGI25' : null,
        'tipAmount': tipAmount,
        'total': 44660 - discountAmount,
        'paymentMethod': 'wallet',
        'paymentStatus': 'completed',
        'unpaidAmount': 0,
        'driver': {
          'name': 'Alisher Karimov',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01A123BC',
        },
      };

  test('fromJson barcha maydonlarni o\'qiydi', () {
    final receipt = OrderReceipt.fromJson(receiptJson());

    expect(receipt.orderNumber, 'A3F9C1D2');
    expect(receipt.tariffName, 'Komfort');
    expect(receipt.waypoints.single.address, 'Angren, Bozor');
    expect(receipt.paymentMethod, ReceiptPaymentMethod.wallet);
    expect(receipt.paymentStatus, ReceiptPaymentStatus.completed);
    expect(receipt.driver?.carNumber, '01A123BC');
    expect(receipt.fare?.baseFare, 8000);
  });

  test('fare null bo\'lsa model buzilmaydi va tarkib o\'ylab topilmaydi', () {
    final receipt = OrderReceipt.fromJson(receiptJson(withFare: false));

    expect(receipt.fare, isNull);
    expect(receipt.grossPrice, 44660);

    final text = receiptAsText(receipt);
    expect(text, contains('Narx tarkibi saqlanmagan.'));
    expect(text, isNot(contains('Asos:')));
    expect(text, isNot(contains('Masofa (')));
  });

  test('chaqim yakuniy summaga qo\'shiladi', () {
    final receipt = OrderReceipt.fromJson(receiptJson(tipAmount: 5000));

    expect(receipt.total, 44660);
    expect(receipt.tipAmount, 5000);
    expect(receipt.grandTotal, 49660);
  });

  // ⚠️ TEST YANGILANDI (ilgari `hasLength(4)` edi). Sabab: kutish qatori
  // endi NOL BO'LSA HAM chiqadi — u qat'iy narx kafolatidan tashqaridagi
  // yagona qator, ya'ni "0 so'm" ning o'zi ham ma'lumot. Eski kutilma
  // qoidani emas, faqat o'sha paytdagi qatorlar sonini qo'riqlagan.
  test('tarkib qatorlari e\'lon qilingan tartibda va faqat mazmunlilari', () {
    final fare = FareBreakdown.fromJson(fareJson());
    final labels = fareLines(fare).map((l) => l.label).toList();

    expect(labels[0], 'Asos');
    expect(labels[1], startsWith('Masofa ('));
    expect(labels[2], startsWith('Vaqt ('));
    expect(labels[3], startsWith('Talab koeffitsienti'));
    expect(labels[4], startsWith('Kutish ('));
    // minPriceAdjustment = 0 va maxPriceCap = 0 — nol qatorlar chiqmaydi.
    expect(labels, hasLength(5));
    expect(labels.any((l) => l.contains('Eng kam haq')), isFalse);
    expect(labels.any((l) => l.contains('Yuqori narx')), isFalse);
  });

  // Kutish qatori chekning eng nizoli joyi: yo'lovchi qat'iy narx eshitgan,
  // chekda esa undan ortiq summa turishi mumkin. Shuning uchun quyidagi
  // uchta test qatorning HAR DOIM borligini va rost ekanini qo'riqlaydi.
  test('kutish 0 bo\'lsa ham qator chiqadi va sababini aytadi', () {
    final fare = FareBreakdown.fromJson(fareJson());
    final waiting = fareLines(fare).firstWhere(
      (l) => l.label.startsWith('Kutish'),
    );

    expect(fare.waitingMinutes, 0);
    expect(fare.waitingFare, 0);
    // "0 daq" yolg'iz o'zi haydovchi kutmagandek o'qilardi — sabab yoziladi.
    expect(waiting.label, contains('bepul vaqtdan oshmadi'));
    expect(asShown(waiting.value), 0);
  });

  test('kutish undirilganda daqiqa, daqiqa narxi va summa mos keladi', () {
    final fare = FareBreakdown.fromJson({
      ...fareJson(),
      'waitingMinutes': 5,
      'waitingFare': 2500,
      // Invariant: qatorlar yig'indisi jamiga teng
      // (44 660 + 2 500 = 47 160).
      'total': 47160,
    });

    final waiting = fareLines(fare).firstWhere(
      (l) => l.label.startsWith('Kutish'),
    );

    // Daqiqa narxi chekda alohida kelmaydi — u bo'linma bilan tiklanadi.
    expect(waiting.label, 'Kutish (5 daq × 500 so\'m)');
    expect(asShown(waiting.value), 2500);

    final sum = fareLines(fare)
        .map((l) => asShown(l.value))
        .fold<int>(0, (a, b) => a + b);
    expect(sum, asShown(formatSomRounded(fare.total)));
  });

  // ⚠️ ORQAGA MOSLIK: migratsiyadan oldingi `fare_breakdown` jsonb'da bu ikki
  // kalit UMUMAN yo'q. Model yiqilmasligi va chek 0 ko'rsatishi kerak —
  // yo'q kalit "noma'lum summa" emas, "undirilmagan" degani.
  test('eski tarkibda kutish kalitlari yo\'q — 0 deb o\'qiladi', () {
    final json = fareJson()
      ..remove('waitingMinutes')
      ..remove('waitingFare');
    final fare = FareBreakdown.fromJson(json);

    expect(fare.waitingMinutes, 0);
    expect(fare.waitingFare, 0);

    final sum = fareLines(fare)
        .map((l) => asShown(l.value))
        .fold<int>(0, (a, b) => a + b);
    expect(sum, asShown(formatSomRounded(fare.total)));
  });

  test('ko\'rsatilgan qatorlar yig\'indisi ko\'rsatilgan jamiga teng', () {
    final fare = FareBreakdown.fromJson(fareJson());

    // Ekranda ko'rinadigan sonlar qayta o'qiladi — foydalanuvchi aynan
    // shularni qo'shib tekshiradi, xom `double` larni emas.
    final sum = fareLines(fare)
        .map((l) => asShown(l.value))
        .fold<int>(0, (a, b) => a + b);

    expect(sum, asShown(formatSomRounded(fare.total)));
  });

  // ⚠️ REGRESSIYA: haqiqiy safarda masofa ham, davomiylik ham kasr bo'ladi
  // (OSRM 7.437 km, 18.7 daqiqa), ya'ni qatorlar yarim so'mga tushadi. Har
  // bir qatorni ALOHIDA yaxlitlaganda ikkita "+0.5" to'planib, ustun jamidan
  // 1 so'm oshib ketardi — chek "qo'shib tekshirsa to'g'ri chiqmaydigan"
  // hujjatga aylanardi.
  test('kasrli tarkibda ham qatorlar jamiga AYNAN qo\'shiladi', () {
    final fare = FareBreakdown.fromJson(const {
      'baseFare': 8000,
      'distanceKm': 7.437,
      'pricePerKm': 2500,
      // 7.437 × 2500 = 18 592.5 — alohida yaxlitlansa +0.5.
      'distanceFare': 18592.5,
      'durationMin': 18.708333,
      'pricePerMin': 300,
      // 18.708333 × 300 = 5 612.5 — yana +0.5.
      'timeFare': 5612.5,
      'minPriceAdjustment': 0,
      'surgeMultiplier': 1.4,
      'surgeFare': 12882.0,
      'maxPriceCap': 0,
      'total': 45087.0,
    });

    final sum = fareLines(fare)
        .map((l) => asShown(l.value))
        .fold<int>(0, (a, b) => a + b);

    expect(sum, asShown(formatSomRounded(fare.total)));
  });

  test('manfiy chegara qatori ham jamini buzmaydi', () {
    final fare = FareBreakdown.fromJson(const {
      'baseFare': 8000,
      'distanceKm': 12.345,
      'pricePerKm': 2500,
      'distanceFare': 30862.5,
      'durationMin': 27.5,
      'pricePerMin': 300,
      'timeFare': 8250.0,
      'minPriceAdjustment': 0,
      'surgeMultiplier': 1.0,
      'surgeFare': 0,
      // Yuqori chegara 40 000 ga kesadi.
      'maxPriceCap': -7112.5,
      'total': 40000.0,
    });

    final lines = fareLines(fare);
    // ⚠️ TEST YANGILANDI: ilgari bu qator `lines.last` edi. Endi ro'yxatning
    // oxirgisi — kutish qatori (u har doim chiqadi), chegara esa undan
    // oldin turadi. Tekshirilayotgan qoida o'zgarmadi: manfiy qator
    // belgisi bilan ko'rsatiladi va ustunni buzmaydi.
    final cap = lines.firstWhere((l) => l.label == 'Yuqori narx chegarasi');
    expect(cap.value, startsWith('\u2212'));

    final sum = lines.map((l) => asShown(l.value)).fold<int>(0, (a, b) => a + b);
    // Manfiy qator "−7 113" ko'rinishida — belgisi bilan qo'shiladi.
    expect(sum, asShown(formatSomRounded(fare.total)));
  });

  test('chegirma va chaqim bo\'lmasa matn "Jami" ni takrorlamaydi', () {
    final text = receiptAsText(OrderReceipt.fromJson(receiptJson()));

    expect(text, isNot(contains('Jami:')));
    expect(text, contains('Yakuniy:'));
  });

  test('chegirmali chekda jami, chegirma va yakuniy izchil', () {
    final receipt = OrderReceipt.fromJson(
      receiptJson(discountAmount: 5000, tipAmount: 5000),
    );
    final text = receiptAsText(receipt);

    expect(receipt.total, 39660);
    expect(receipt.grandTotal, 44660);
    expect(text, contains('Chegirma (YANGI25)'));
    expect(text, contains('Chaqim: +'));
    expect(text, contains('To\'xtash 1: Angren, Bozor'));
    expect(text, contains('Haydovchi: Alisher Karimov'));
  });

  test('noma\'lum to\'lov usuli null bo\'ladi — o\'ylab topilmaydi', () {
    final json = receiptJson()..['paymentMethod'] = 'crypto';
    final receipt = OrderReceipt.fromJson(json);

    expect(receipt.paymentMethod, isNull);
    expect(receiptAsText(receipt), isNot(contains('To\'lov: crypto')));
  });
}
