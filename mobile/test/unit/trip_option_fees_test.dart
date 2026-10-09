import 'package:angren_taxi/shared/models/trip_option.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test("serverdagi haqlar o'qiladi; noma'lum, nol va buzuq qiymatlar tashlanadi", () {
    final fees = TripOption.feesFromApi({
      'child_seat': 5000,
      'pet': 0,
      'air_conditioner': 'x',
      'rocket': 9000,
      'big_luggage': 3000.0,
    });

    expect(fees, {TripOption.childSeat: 5000, TripOption.bigLuggage: 3000});
  });

  test("javob obyekt bo'lmasa — haqsiz", () {
    expect(TripOption.feesFromApi(null), isEmpty);
    expect(TripOption.feesFromApi(const [1, 2]), isEmpty);
  });

  test("tanlangan opsiyalar haqi yig'indisi", () {
    const fees = {TripOption.childSeat: 5000, TripOption.pet: 7000};
    expect(
      TripOption.totalFee(const [TripOption.childSeat, TripOption.airConditioner], fees),
      5000,
    );
    expect(TripOption.totalFee(const [], fees), 0);
  });
}
