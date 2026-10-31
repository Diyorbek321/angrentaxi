// Demo rejimdagi chek — `GET /orders/:id/receipt` shaklidan chetga chiqmasin.
//
// NEGA KERAK: demo `DemoEngine.handle` noma'lum yo'llarga bo'sh `{}` qaytaradi
// va chek ekrani o'shanda 0 so'mlik, manzilsiz "hujjat" ko'rsatardi. Bu sinov
// demo javobini AYNAN haqiqiy model bilan o'qiydi — shakl ajralib ketsa,
// ko'rsatuvda emas, shu yerda yiqiladi.
import 'package:angren_taxi/core/demo/demo_data.dart';
import 'package:angren_taxi/shared/models/order_receipt.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final order = DemoData.orderHistory().first;

  test('demo chek OrderReceipt modeliga to\'liq o\'qiladi', () {
    final receipt = OrderReceipt.fromJson(DemoData.receipt(order));

    expect(receipt.orderId, order['id']);
    expect(receipt.orderNumber, isNotEmpty);
    expect(receipt.pickupAddress, isNotNull);
    expect(receipt.dropoffAddress, isNotNull);
    expect(receipt.completedAt, isNotNull);
    expect(receipt.total, greaterThan(0));
    expect(receipt.paymentMethod, ReceiptPaymentMethod.wallet);
    expect(receipt.driver?.name, isNotEmpty);
    expect(receipt.fare, isNotNull);
  });

  test('narx tarkibi backend invariantini buzmaydi', () {
    final fare = OrderReceipt.fromJson(DemoData.receipt(order)).fare!;

    final sum = fare.baseFare +
        fare.distanceFare +
        fare.timeFare +
        fare.minPriceAdjustment +
        fare.surgeFare +
        fare.maxPriceCap;

    expect(sum, closeTo(fare.total, 0.001));
  });

  test('chaqim chekka o\'tadi', () {
    final receipt =
        OrderReceipt.fromJson(DemoData.receipt(order, tipAmount: 5000));

    expect(receipt.tipAmount, 5000);
    // Yakuniy summa — yo'l haqi + chaqim.
    expect(receipt.grandTotal, receipt.total + 5000);
  });
}
