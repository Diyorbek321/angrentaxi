import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomInt } from 'crypto';

/**
 * POSILKA — shahar ichida buyum/hujjat yetkazish (2-versiya).
 *
 * Taksi oqimining o'zi: yuboruvchi yo'lovchi sifatida buyurtma beradi, haydovchi
 * olish nuqtasidan olib, manzilga eltadi. Farqi ikkita:
 *   1. `details` da qabul qiluvchi va buyum tavsifi bo'ladi (server tekshiradi).
 *   2. Topshirish PIN kod bilan: kodni faqat yuboruvchi ko'radi va qabul
 *      qiluvchiga aytadi; haydovchi to'g'ri kodni kiritmasa safarni yakunlay
 *      olmaydi — posilka noto'g'ri odamga berilmaydi.
 */

export enum ParcelSize {
  /** Kalit, hujjat, telefon — cho'ntak/konvert. */
  SMALL = 'small',
  /** Sumka, quti — o'rindiqqa sig'adi. */
  MEDIUM = 'medium',
  /** Bagajga sig'adigan. Undan kattasi — yuk tashish. */
  LARGE = 'large',
}

export interface ParcelDetails {
  recipientPhone: string;
  recipientName?: string;
  itemDescription: string;
  size: ParcelSize;
}

const UZ_PHONE = /^\+998\d{9}$/;
const MAX_DESCRIPTION = 200;
const MAX_NAME = 50;

/**
 * Validates the free-form `details` of a parcel order and keeps only the known
 * fields — the JSON goes straight into the driver's offer, so nothing the
 * client invents may ride along.
 */
export function parseParcelDetails(raw: unknown): ParcelDetails {
  const fail = (reason: string): never => {
    throw new BadRequestException(`Posilka ma'lumoti noto'g'ri: ${reason}`);
  };
  if (!raw || typeof raw !== 'object') fail("qabul qiluvchi va buyum ko'rsatilmagan");
  const input = raw as Record<string, unknown>;

  const recipientPhone = typeof input.recipientPhone === 'string' ? input.recipientPhone.trim() : '';
  if (!UZ_PHONE.test(recipientPhone)) fail("qabul qiluvchi telefoni +998XXXXXXXXX ko'rinishida bo'lsin");

  const itemDescription = typeof input.itemDescription === 'string' ? input.itemDescription.trim() : '';
  if (!itemDescription) fail('nima yuborilayotgani yozilmagan');
  if (itemDescription.length > MAX_DESCRIPTION) fail(`tavsif ${MAX_DESCRIPTION} belgidan oshmasin`);

  const size = input.size as ParcelSize;
  if (!Object.values(ParcelSize).includes(size)) fail("o'lcham small, medium yoki large bo'lsin");

  const details: ParcelDetails = { recipientPhone, itemDescription, size };
  const recipientName = typeof input.recipientName === 'string' ? input.recipientName.trim() : '';
  if (recipientName) details.recipientName = recipientName.slice(0, MAX_NAME);
  return details;
}

/** Four digits, leading zeros allowed — 10 000 combinations. */
export function generateDeliveryPin(): string {
  return randomInt(0, 10_000).toString().padStart(4, '0');
}

/**
 * Wrong guesses allowed before the PIN locks. With 10 000 combinations, five
 * tries is a 1-in-2 000 chance of guessing — and a locked parcel goes to a
 * dispatcher, who completes it after phoning the recipient.
 */
export const PARCEL_PIN_MAX_ATTEMPTS = 5;

/**
 * PIN checking is split so the attempt counter can be bumped atomically in
 * SQL BEFORE the comparison: "read attempts, compare, then increment" would
 * let a burst of parallel guesses all see the same count and slip past the
 * limit. Every guess consumes an attempt; a right one completes the order.
 */
export function assertPinGiven(given: string | undefined): asserts given is string {
  if (!given) {
    throw new BadRequestException("Posilkani topshirish uchun qabul qiluvchidan 4 xonali PIN kodni so'rang.");
  }
}

export function deliveryPinLocked(): ForbiddenException {
  return new ForbiddenException(
    "PIN urinishlari tugadi. Dispetcherga qo'ng'iroq qiling — u qabul qiluvchi bilan gaplashib, safarni yakunlaydi.",
  );
}

/** [attemptsUsed] already includes this guess. */
export function checkDeliveryPin(stored: { pin: string | null; attemptsUsed: number }, given: string): void {
  if (given !== stored.pin) {
    const left = Math.max(0, PARCEL_PIN_MAX_ATTEMPTS - stored.attemptsUsed);
    throw new BadRequestException(`PIN noto'g'ri. Qolgan urinishlar: ${left}.`);
  }
}
