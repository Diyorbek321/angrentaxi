import { IntercityFitService } from './intercity-fit.service';

const rohat = {
  id: 'p-rohat',
  name: 'Rohat krugi (Toshkent)',
  centerLat: 41.268028,
  centerLng: 69.366806,
  radiusKm: 1.5,
  extensionMaxKm: 30,
  extensionPricePerKm: 2000,
  extensionComfortPricePerKm: 2500,
};
const angren = {
  id: 'p-angren',
  name: 'Angren',
  centerLat: 40.0956,
  centerLng: 70.9432,
  radiusKm: 12,
  extensionMaxKm: 0,
  extensionPricePerKm: 0,
  extensionComfortPricePerKm: null,
};
const yunusobod = { id: 'z-yun', name: 'Yunusobod', centerLat: 41.365, centerLng: 69.288, radiusKm: 4 };
const sergeliAddr = { lat: 41.227, lng: 69.219 };
const yunusobodAddr = { lat: 41.366, lng: 69.289 };
const angrenAddr = { lat: 40.1, lng: 70.95 };

const trip = { id: 't1', origin: angren, destination: rohat };

function build(options: { stops?: Array<Record<string, unknown>>; detour?: { checked: boolean; addedMinutes: number | null } } = {}) {
  const zones = {
    zonesOfTrips: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { origin: [], destination: [yunusobod] }]))),
  };
  const detour = {
    addedMinutes: jest.fn(async () => options.detour ?? { checked: true, addedMinutes: 4 }),
  };
  const executor = { query: jest.fn(async () => options.stops ?? []) };
  const service = new IntercityFitService(zones as never, detour as never, executor as never);
  return { service, zones, detour, executor };
}

describe('IntercityFitService.check', () => {
  it("tanlangan tumandan tashqari manzil — zoneOk=false, tuman nomlari bilan", async () => {
    const { service, detour } = build();
    const result = await service.check({
      trip,
      zones: { origin: [], destination: [yunusobod] },
      pickup: angrenAddr,
      dropoff: sergeliAddr,
      seatBooking: true,
      maxDetourMinutes: 15,
    });
    expect(result).toMatchObject({ zoneOk: false, outOfZone: { side: 'destination', zoneNames: ['Yunusobod'] } });
    expect(detour.addedMinutes).not.toHaveBeenCalled();
  });

  it("tumanda + mavjud bekatlar bilan aylanma o'lchanadi (faqat davom hududidagilari)", async () => {
    const { service, detour } = build({
      stops: [
        // Davom hududida tushadi — hisobga olinadi.
        { order_id: 'o1', trip_id: 't1', pickup_lat: 40.1, pickup_lng: 70.95, dropoff_lat: 41.36, dropoff_lng: 69.3 },
        // Rohat krugining o'zida tushadi — bekat emas.
        { order_id: 'o2', trip_id: 't1', pickup_lat: 40.1, pickup_lng: 70.95, dropoff_lat: 41.2681, dropoff_lng: 69.3669 },
      ],
      detour: { checked: true, addedMinutes: 22 },
    });
    const result = await service.check({
      trip,
      zones: { origin: [], destination: [yunusobod] },
      pickup: angrenAddr,
      dropoff: yunusobodAddr,
      seatBooking: true,
      maxDetourMinutes: 15,
    });
    expect(detour.addedMinutes).toHaveBeenCalledTimes(1);
    expect(detour.addedMinutes).toHaveBeenCalledWith(
      'dropoff',
      { lat: rohat.centerLat, lng: rohat.centerLng },
      [{ lat: 41.36, lng: 69.3 }],
      yunusobodAddr,
    );
    expect(result).toEqual({
      zoneOk: true,
      outOfZone: null,
      detourChecked: true,
      detourMinutes: 22,
      detourTooLong: true,
    });
  });

  it("butun mashina yoki chegara 0 — aylanma o'lchanmaydi", async () => {
    const { service, detour } = build();
    const base = { trip, zones: { origin: [], destination: [] }, pickup: angrenAddr, dropoff: sergeliAddr };
    await expect(service.check({ ...base, seatBooking: false, maxDetourMinutes: 15 })).resolves.toMatchObject({
      detourChecked: true,
      detourMinutes: 0,
      detourTooLong: false,
    });
    await expect(service.check({ ...base, seatBooking: true, maxDetourMinutes: 0 })).resolves.toMatchObject({
      detourTooLong: false,
    });
    expect(detour.addedMinutes).not.toHaveBeenCalled();
  });

  it("marshrut xizmati javob bermasa — tekshirilmadi, rad etilmaydi (fail-open)", async () => {
    const { service } = build({
      stops: [{ order_id: 'o1', trip_id: 't1', pickup_lat: 40.1, pickup_lng: 70.95, dropoff_lat: 41.36, dropoff_lng: 69.3 }],
      detour: { checked: false, addedMinutes: null },
    });
    await expect(
      service.check({
        trip,
        zones: { origin: [], destination: [] },
        pickup: angrenAddr,
        dropoff: sergeliAddr,
        seatBooking: true,
        maxDetourMinutes: 15,
      }),
    ).resolves.toEqual({ zoneOk: true, outOfZone: null, detourChecked: false, detourMinutes: null, detourTooLong: false });
  });
});

describe('IntercityFitService.fitForSearch', () => {
  it("manzil berilmasa — hisob yo'q", async () => {
    const { service, zones } = build();
    await expect(service.fitForSearch([trip], {}, 15)).resolves.toEqual(new Map());
    expect(zones.zonesOfTrips).not.toHaveBeenCalled();
  });

  it("tumandan tashqari — out_of_zone; tumanda — aylanma bo'yicha ok/detour", async () => {
    const { service } = build({ detour: { checked: true, addedMinutes: 30 } });
    const out = await service.fitForSearch([trip], { dropoff: sergeliAddr }, 15);
    expect(out.get('t1')).toEqual({ fit: 'out_of_zone', addedMinutes: null, detourChecked: true, zoneNames: ['Yunusobod'] });

    const { service: second } = build({
      stops: [{ order_id: 'o1', trip_id: 't1', pickup_lat: 40.1, pickup_lng: 70.95, dropoff_lat: 41.2, dropoff_lng: 69.25 }],
      detour: { checked: true, addedMinutes: 30 },
    });
    const far = await second.fitForSearch([trip], { dropoff: yunusobodAddr }, 15);
    expect(far.get('t1')).toEqual({ fit: 'detour', addedMinutes: 30, detourChecked: true, zoneNames: [] });
  });

  it("10 tadan ko'p qatnovda aylanma o'lchanmaydi (tezlik)", async () => {
    const { service, detour } = build({
      stops: [{ order_id: 'o1', trip_id: 't1', pickup_lat: 40.1, pickup_lng: 70.95, dropoff_lat: 41.36, dropoff_lng: 69.3 }],
    });
    const many = Array.from({ length: 11 }, (_, i) => ({ ...trip, id: i === 0 ? 't1' : `t${i + 1}` }));
    const fits = await service.fitForSearch(many, { dropoff: yunusobodAddr }, 15);
    expect(detour.addedMinutes).not.toHaveBeenCalled();
    expect(fits.get('t1')).toEqual({ fit: 'ok', addedMinutes: null, detourChecked: false, zoneNames: [] });
  });
});
