import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/features/auth/app_role_gate.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('passenger app takes passengers and staff who ride, never admin or drivers', () {
    for (final role in ['passenger', 'manager', 'market', 'restaurant']) {
      expect(wrongAppReason(AppFlavor.passenger, role), isNull, reason: role);
    }
    expect(wrongAppReason(AppFlavor.passenger, 'driver'), WrongAppReason.driverInPassengerApp);
    expect(wrongAppReason(AppFlavor.passenger, 'admin'), WrongAppReason.staffAccount);
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
