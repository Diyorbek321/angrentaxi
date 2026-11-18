import { BadRequestException } from '@nestjs/common';

/**
 * Yuk tashish buyurtmasining `details` i (docs/INCIDENT-POLICY.md §2).
 *
 * JSON haydovchi taklifiga to'g'ridan-to'g'ri ketadi — faqat ma'lum maydonlar
 * qoladi va har biri chegaralanadi, ixtiyoriy matn "erkin maydon" sifatida
 * suiiste'mol qilinmasin.
 */
export interface CargoDetails {
  /** Mashina turi (ilova ro'yxatidan). */
  vehicle?: string;
  /** Taxminiy og'irlik, kg. */
  weightKg?: number;
  /** Yuk ortuvchilar soni. */
  loaders?: number;
  cargoNote?: string;
}

export const CARGO_MAX_WEIGHT_KG = 20_000;
export const CARGO_MAX_LOADERS = 10;
const MAX_VEHICLE = 40;
const MAX_NOTE = 200;

export function parseCargoDetails(raw: unknown): CargoDetails | null {
  const fail = (reason: string): never => {
    throw new BadRequestException(`Yuk ma'lumoti noto'g'ri: ${reason}`);
  };
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) fail("noto'g'ri ko'rinish");
  const input = raw as Record<string, unknown>;
  const details: CargoDetails = {};

  if (input.vehicle !== undefined && input.vehicle !== null) {
    if (typeof input.vehicle !== 'string' || !input.vehicle.trim()) fail("mashina turi noto'g'ri");
    details.vehicle = (input.vehicle as string).trim().slice(0, MAX_VEHICLE);
  }
  if (input.weightKg !== undefined && input.weightKg !== null) {
    const w = input.weightKg;
    if (typeof w !== 'number' || !Number.isInteger(w) || w < 1 || w > CARGO_MAX_WEIGHT_KG) {
      fail(`og'irlik 1 dan ${CARGO_MAX_WEIGHT_KG} kg gacha butun son bo'lsin`);
    }
    details.weightKg = w as number;
  }
  if (input.loaders !== undefined && input.loaders !== null) {
    const l = input.loaders;
    if (typeof l !== 'number' || !Number.isInteger(l) || l < 0 || l > CARGO_MAX_LOADERS) {
      fail(`yuk ortuvchilar 0 dan ${CARGO_MAX_LOADERS} gacha bo'lsin`);
    }
    details.loaders = l as number;
  }
  if (input.cargoNote !== undefined && input.cargoNote !== null) {
    if (typeof input.cargoNote !== 'string') fail("izoh matn bo'lsin");
    const note = (input.cargoNote as string).trim();
    if (note.length > MAX_NOTE) fail(`izoh ${MAX_NOTE} belgidan oshmasin`);
    if (note) details.cargoNote = note;
  }
  return Object.keys(details).length > 0 ? details : null;
}
