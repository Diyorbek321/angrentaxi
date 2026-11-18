import { IntercityDetourService } from './intercity-detour.service';

const point = { lat: 41.268, lng: 69.367 };
const a = { id: 'a', lat: 41.3, lng: 69.4 };
const b = { id: 'b', lat: 41.2, lng: 69.2 };

function build(matrix: (number | null)[][] | null) {
  const osrm = { durationMatrix: jest.fn().mockResolvedValue(matrix) };
  return { service: new IntercityDetourService(osrm as never), osrm };
}

describe('IntercityDetourService.addedMinutes', () => {
  it("mavjud bekat yo'q — 0, OSRM chaqirilmaydi", async () => {
    const { service, osrm } = build(null);
    await expect(service.addedMinutes('dropoff', point, [], b)).resolves.toEqual({ checked: true, addedMinutes: 0 });
    expect(osrm.durationMatrix).not.toHaveBeenCalled();
  });

  it("qarama-qarshi tomon: daqiqaga yaxlitlab", async () => {
    // 0 — nuqta, 1 — mavjud (25 daq), 2 — yangi (25 daq narigi tomonda).
    const m = [
      [0, 1500, 1500],
      [1500, 0, 3000],
      [1500, 3000, 0],
    ];
    const { service, osrm } = build(m);
    await expect(service.addedMinutes('dropoff', point, [a], b)).resolves.toEqual({ checked: true, addedMinutes: 25 });
    // Koordinatalar OSRM tartibida: [lng, lat], nuqta birinchi.
    expect(osrm.durationMatrix).toHaveBeenCalledWith([
      [69.367, 41.268],
      [69.4, 41.3],
      [69.2, 41.2],
    ]);
  });

  it("OSRM ishlamasa — tekshirilmadi (fail-open)", async () => {
    const { service } = build(null);
    await expect(service.addedMinutes('pickup', point, [a], b)).resolves.toEqual({ checked: false, addedMinutes: null });
  });
});

describe('IntercityDetourService.plan', () => {
  it("tushirish: nuqtadan boshlab optimal tartib va oraliq vaqtlar", async () => {
    // 0 — nuqta, 1 — a (10 daq), 2 — b (a dan keyin 5 daq, nuqtadan 12).
    const m = [
      [0, 600, 720],
      [600, 0, 300],
      [720, 300, 0],
    ];
    const { service } = build(m);
    await expect(service.plan('dropoff', point, [a, b])).resolves.toEqual({
      stops: [
        { id: 'a', etaMinutesFromPrev: 10 },
        { id: 'b', etaMinutesFromPrev: 5 },
      ],
      terminalEtaMinutes: null,
      totalMinutes: 15,
      optimized: true,
    });
  });

  it("olish: nuqtada tugaydi; haydovchi joyi berilmasa birinchi oraliq noma'lum", async () => {
    const m = [
      [0, 600, 720],
      [600, 0, 300],
      [720, 300, 0],
    ];
    const { service } = build(m);
    await expect(service.plan('pickup', point, [a, b])).resolves.toEqual({
      stops: [
        { id: 'b', etaMinutesFromPrev: null },
        { id: 'a', etaMinutesFromPrev: 5 },
      ],
      terminalEtaMinutes: 10,
      totalMinutes: 15,
      optimized: true,
    });
  });

  it("olish: haydovchi joyidan boshlanadi", async () => {
    // 0 — nuqta, 1 — haydovchi, 2 — a, 3 — b.
    const m = [
      [0, 900, 600, 720],
      [900, 0, 120, 600],
      [600, 120, 0, 300],
      [720, 600, 300, 0],
    ];
    const { service } = build(m);
    const plan = await service.plan('pickup', point, [a, b], { lat: 41.31, lng: 69.41 });
    expect(plan.stops).toEqual([
      { id: 'a', etaMinutesFromPrev: 2 },
      { id: 'b', etaMinutesFromPrev: 5 },
    ]);
    expect(plan.terminalEtaMinutes).toBe(12);
    expect(plan.totalMinutes).toBe(19);
  });

  it("OSRM ishlamasa — eng yaqindan tartib, vaqtlarsiz, optimized=false", async () => {
    const { service } = build(null);
    const near = { id: 'near', lat: 41.27, lng: 69.37 };
    const far = { id: 'far', lat: 41.36, lng: 69.29 };
    const plan = await service.plan('dropoff', point, [far, near]);
    expect(plan).toEqual({
      stops: [
        { id: 'near', etaMinutesFromPrev: null },
        { id: 'far', etaMinutesFromPrev: null },
      ],
      terminalEtaMinutes: null,
      totalMinutes: null,
      optimized: false,
    });
  });

  it("olish fallback: nuqtaga eng yaqini oxirida", async () => {
    const { service } = build(null);
    const near = { id: 'near', lat: 41.27, lng: 69.37 };
    const far = { id: 'far', lat: 41.36, lng: 69.29 };
    const plan = await service.plan('pickup', point, [near, far]);
    expect(plan.stops.map((stop) => stop.id)).toEqual(['far', 'near']);
  });

  it("bekat yo'q — bo'sh reja", async () => {
    const { service } = build(null);
    await expect(service.plan('dropoff', point, [])).resolves.toEqual({
      stops: [],
      terminalEtaMinutes: null,
      totalMinutes: 0,
      optimized: true,
    });
  });
});
