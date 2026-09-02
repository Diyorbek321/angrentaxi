import { describe, expect, it } from 'vitest';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS_UZ,
  PERMISSION_SHORT_LABELS_UZ,
} from './permission-labels';

/**
 * `Record<Permission, string>` tipi to'liqlikni kompilyatsiyada kafolatlaydi;
 * bu testlar esa ikkala xarita va guruhlar BIR-BIRIGA mosligini tekshiradi —
 * yangi ruxsat qo'shilganda uchchala joy birga yangilanishi shart.
 */
describe('permission-labels', () => {
  const labelKeys = Object.keys(PERMISSION_LABELS_UZ).sort();

  it("qisqa va to'liq yorliqlar bir xil ruxsatlarni qamrab oladi", () => {
    expect(Object.keys(PERMISSION_SHORT_LABELS_UZ).sort()).toEqual(labelKeys);
  });

  it("har bir ruxsat AYNAN BITTA guruhda turadi", () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    expect([...grouped].sort()).toEqual(labelKeys);
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("hech bir yorliq bo'sh emas", () => {
    for (const label of [
      ...Object.values(PERMISSION_LABELS_UZ),
      ...Object.values(PERMISSION_SHORT_LABELS_UZ),
      ...PERMISSION_GROUPS.map((g) => g.title),
    ]) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
