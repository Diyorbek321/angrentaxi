import { RealtimeGateway } from './realtime.gateway';

/**
 * Bloklangan foydalanuvchining OCHIQ socketlari darhol uziladi. Handshake va
 * WsJwtGuard faqat yangi ulanish / kiruvchi hodisani to'xtatadi — server
 * yuboradigan hodisalar (takliflar) ochiq socketga oqishda davom etardi,
 * yurak urishi esa haydovchini "tirik" deb ushlab turardi.
 */
describe('RealtimeGateway — bloklanganda socketlarni uzish', () => {
  it('afterInit bloklash tinglovchisini ro‘yxatdan o‘tkazadi; u foydalanuvchi xonasini uzadi', async () => {
    const usersService = { onUserBlocked: jest.fn() };
    const touchPresence = jest.fn(async () => undefined);
    const gateway = new RealtimeGateway(
      {} as never,
      {} as never,
      { touchPresence } as never,
      usersService as never,
      {} as never,
      {} as never,
    );
    const disconnectSockets = jest.fn();
    const inRoom = jest.fn(() => ({ disconnectSockets }));
    (gateway as unknown as { server: unknown }).server = { in: inRoom };
    (gateway as unknown as { connectedDrivers: Set<string> }).connectedDrivers.add('driver-1');

    gateway.afterInit({} as never);
    expect(usersService.onUserBlocked).toHaveBeenCalledTimes(1);
    const listener = usersService.onUserBlocked.mock.calls[0][0] as (id: string) => Promise<void>;
    await listener('driver-1');

    expect(inRoom).toHaveBeenCalledWith('user:driver-1');
    expect(disconnectSockets).toHaveBeenCalledWith(true);
    // Yurak urishi endi uni "tirik" qilmaydi.
    await gateway.refreshDriverPresence();
    expect(touchPresence).not.toHaveBeenCalled();
  });
});
