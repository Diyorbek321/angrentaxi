import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/features/auth/app_role_gate.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('passenger app takes only passengers', () {
    expect(wrongAppReason(AppFlavor.passenger, 'passenger'), isNull);
    expect(wrongAppReason(AppFlavor.passenger, 'driver'), WrongAppReason.driverInPassengerApp);
    for (final role in ['admin', 'manager', 'market', 'restaurant']) {
      expect(wrongAppReason(AppFlavor.passenger, role), WrongAppReason.staffAccount);
    }
  });

  test('driver app takes drivers and passengers (who apply from it)', () {
    expect(wrongAppReason(AppFlavor.driver, 'driver'), isNull);
    expect(wrongAppReason(AppFlavor.driver, 'passenger'), isNull);
    expect(wrongAppReason(AppFlavor.driver, 'restaurant'), WrongAppReason.staffAccount);
  });

  test('an old session without a stored role is not thrown out', () {
    expect(wrongAppReason(AppFlavor.passenger, null), isNull);
    expect(wrongAppReason(AppFlavor.driver, null), isNull);
  });
}
