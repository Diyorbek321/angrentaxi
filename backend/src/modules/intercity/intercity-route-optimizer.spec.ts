import {
  EXACT_STOP_LIMIT,
  addedDetourSeconds,
  bestPath,
} from './intercity-route-optimizer';

/** Chiziqdagi nuqtalar: i dan j gacha |x_i - x_j| * 60 soniya (bir yo'nalishli emas). */
function lineMatrix(xs: number[]): number[][] {
  return xs.map((a) => xs.map((b) => Math.abs(a - b) * 60));
}

describe('bestPath', () => {
  it("boshlanishi qat'iy, oxiri erkin: chiziq bo'ylab tartib", () => {
    // 0 — nuqta (x=0); bekatlar x=5, 1, 3.
    const m = lineMatrix([0, 5, 1, 3]);
    const result = bestPath(m, { start: 0 }, [1, 2, 3]);
    expect(result).not.toBeNull();
    expect(result!.order).toEqual([2, 3, 1]);
    expect(result!.seconds).toBe(5 * 60);
  });

  it("oxiri qat'iy (olish tomoni): bekatlar nuqtada tugaydi", () => {
    const m = lineMatrix([0, 5, 1, 3]);
    const result = bestPath(m, { end: 0 }, [1, 2, 3]);
    expect(result!.order).toEqual([1, 3, 2]);
    expect(result!.seconds).toBe(5 * 60);
  });

  it("ikkala uchi qat'iy: haydovchi joyidan nuqtagacha", () => {
    // 0 — nuqta x=0, 1 — haydovchi x=10, bekatlar x=2, 8.
    const m = lineMatrix([0, 10, 2, 8]);
    const result = bestPath(m, { start: 1, end: 0 }, [2, 3]);
    expect(result!.order).toEqual([3, 2]);
    expect(result!.seconds).toBe(10 * 60);
  });

  it("bekat yo'q — bo'sh yo'l", () => {
    expect(bestPath(lineMatrix([0]), { start: 0 }, [])).toEqual({ order: [], seconds: 0 });
  });

  it("yetib bo'lmaydigan bekat (null) — natija null", () => {
    const m: (number | null)[][] = [
      [0, 60, null],
      [60, 0, null],
      [null, null, 0],
    ];
    expect(bestPath(m, { start: 0 }, [1, 2])).toBeNull();
  });

  it("assimetrik matritsa (bir tomonlama ko'cha) hisobga olinadi", () => {
    // 0→1 arzon, 1→0 qimmat.
    const m = [
      [0, 60, 600],
      [900, 0, 60],
      [60, 900, 0],
    ];
    const result = bestPath(m, { start: 0 }, [1, 2]);
    expect(result!.order).toEqual([1, 2]);
    expect(result!.seconds).toBe(120);
  });

  it(`${EXACT_STOP_LIMIT} dan ko'p bekat — evristika, baribir to'g'ri chiziq tartibi`, () => {
    const xs = [0, 9, 2, 7, 4, 1, 8, 3, 6, 5, 10];
    const m = lineMatrix(xs);
    const stops = xs.map((_, i) => i).slice(1);
    const result = bestPath(m, { start: 0 }, stops);
    expect(result!.seconds).toBe(10 * 60);
    expect(result!.order.map((i) => xs[i])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('addedDetourSeconds', () => {
  it("birinchi yo'lovchi hech qachon aylanma emas", () => {
    const m = lineMatrix([0, 25]);
    expect(addedDetourSeconds(m, 'dropoff', 0, [], 1)).toBe(0);
    expect(addedDetourSeconds(m, 'pickup', 0, [], 1)).toBe(0);
  });

  it("bir tomonga — yo'l ustida, aylanma 0", () => {
    // Mavjud yo'lovchi 5 daqiqada, yangisi shu yo'nalishda 25 daqiqada.
    const m = lineMatrix([0, 5, 25]);
    expect(addedDetourSeconds(m, 'dropoff', 0, [1], 2)).toBe(0);
    expect(addedDetourSeconds(m, 'pickup', 0, [1], 2)).toBe(0);
  });

  it("qarama-qarshi tomon — aylanma = qaytish yo'li", () => {
    // Mavjud yo'lovchi +25 daqiqa, yangisi -25 daqiqa (shaharning narigi chekkasi).
    const m = lineMatrix([0, 25, -25]);
    // Eng yaxshi: 0→25→-25 = 75 daqiqa; usiz 25; yangining o'zi to'g'ridan 25 → aylanma 25.
    expect(addedDetourSeconds(m, 'dropoff', 0, [1], 2)).toBe(25 * 60);
    expect(addedDetourSeconds(m, 'pickup', 0, [1], 2)).toBe(25 * 60);
  });

  it("yetib bo'lmasa null (tekshirilmadi)", () => {
    const m: (number | null)[][] = [
      [0, 60, null],
      [60, 0, null],
      [null, null, 0],
    ];
    expect(addedDetourSeconds(m, 'dropoff', 0, [1], 2)).toBeNull();
  });
});
