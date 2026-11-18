import { UserRole } from '../../database/entities/user.entity';
import { passengerPushToken } from './notifications.service';

/** Bitta raqam bilan ikkala ilova: yo'lovchi pushi driver ilovasiga ketmasin. */
describe('passengerPushToken', () => {
  const tokens = { fcmToken: 'driver-app', passengerAppFcmToken: 'passenger-app' };

  it("haydovchi akkaunti — yo'lovchi ilovasi tokeni", () => {
    expect(passengerPushToken({ role: UserRole.DRIVER, ...tokens })).toBe('passenger-app');
  });

  it("haydovchi yo'lovchi ilovasini hali ochmagan — push yo'q (driver ilovasiga EMAS)", () => {
    expect(passengerPushToken({ role: UserRole.DRIVER, fcmToken: 'driver-app', passengerAppFcmToken: null })).toBeNull();
  });

  it('sessiya nusxasi (role passenger, accountRole driver) — baribir bazadagi rol hal qiladi', () => {
    expect(
      passengerPushToken({ role: UserRole.PASSENGER, accountRole: UserRole.DRIVER, ...tokens }),
    ).toBe('passenger-app');
  });

  it("oddiy yo'lovchi — fcmToken", () => {
    expect(passengerPushToken({ role: UserRole.PASSENGER, fcmToken: 'p', passengerAppFcmToken: null })).toBe('p');
  });
});
