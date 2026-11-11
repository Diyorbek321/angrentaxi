import {
  INTERCITY_EVENTS,
  loadTripSnapshot,
  publishTripUpdated,
  tripUpdatedPayload,
} from './intercity-events';

const row = {
  id: 'trip-1',
  status: 'open',
  seats_taken: 2,
  seats_total: 4,
  whole_car_booked: false,
  departure_at: new Date('2026-10-17T02:00:00.000Z'),
  driver_user_id: 'driver-user',
  passenger_ids: ['p1', 'p2'],
};

describe('intercity-events', () => {
  it("hodisa nomlari — mobil va panellar bilan kontrakt", () => {
    expect(INTERCITY_EVENTS).toEqual({
      TRIP_UPDATED: 'intercity:trip:updated',
      TRIP_CANCELLED: 'intercity:trip:cancelled',
      BOOKING_CREATED: 'intercity:booking:created',
      BOOKING_CANCELLED: 'intercity:booking:cancelled',
      REQUEST_CREATED: 'intercity:request:created',
      REQUEST_UPDATED: 'intercity:request:updated',
      REQUEST_CLOSED: 'intercity:request:closed',
      REQUEST_RESOLVED: 'intercity:request:resolved',
    });
  });

  it('loadTripSnapshot: bitta so\'rov, faol yo\'lovchilar bilan', async () => {
    const db = { query: jest.fn().mockResolvedValue([row]) };

    const snapshot = await loadTripSnapshot(db, 'trip-1');

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toContain("NOT IN ('completed', 'cancelled')");
    expect(db.query.mock.calls[0][1]).toEqual(['trip-1']);
    expect(snapshot).toEqual({
      payload: {
        tripId: 'trip-1',
        status: 'open',
        seatsTaken: 2,
        seatsTotal: 4,
        wholeCarBooked: false,
        departureAt: '2026-10-17T02:00:00.000Z',
      },
      driverUserId: 'driver-user',
      passengerIds: ['p1', 'p2'],
    });
  });

  it('loadTripSnapshot: qatnov yo\'q — null', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };

    await expect(loadTripSnapshot(db, 'missing')).resolves.toBeNull();
  });

  it('tripUpdatedPayload: raqamlar string kelsa ham son bo\'ladi (pg int/bool)', () => {
    expect(
      tripUpdatedPayload({ ...row, seats_taken: '3', seats_total: '4', departure_at: '2026-10-17T02:00:00.000Z' }),
    ).toEqual(expect.objectContaining({ seatsTaken: 3, seatsTotal: 4 }));
  });

  it('publishTripUpdated: haydovchi, har bir faol yo\'lovchi va menejerlar', async () => {
    const db = { query: jest.fn().mockResolvedValue([row]) };
    const emitter = { emitToUser: jest.fn(), emitToManagers: jest.fn() };

    await publishTripUpdated(db, emitter, 'trip-1');

    const payload = expect.objectContaining({ tripId: 'trip-1', status: 'open' });
    expect(emitter.emitToUser).toHaveBeenCalledWith('driver-user', 'intercity:trip:updated', payload);
    expect(emitter.emitToUser).toHaveBeenCalledWith('p1', 'intercity:trip:updated', payload);
    expect(emitter.emitToUser).toHaveBeenCalledWith('p2', 'intercity:trip:updated', payload);
    expect(emitter.emitToManagers).toHaveBeenCalledWith('intercity:trip:updated', payload);
  });

  it("publishTripUpdated: qatnov topilmasa hech narsa yuborilmaydi", async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    const emitter = { emitToUser: jest.fn(), emitToManagers: jest.fn() };

    await publishTripUpdated(db, emitter, 'missing');

    expect(emitter.emitToUser).not.toHaveBeenCalled();
    expect(emitter.emitToManagers).not.toHaveBeenCalled();
  });
});
