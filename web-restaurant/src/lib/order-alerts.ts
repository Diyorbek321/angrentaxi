import type { FoodOrder } from './api';

/**
 * Yangi buyurtma signali — POLL NATIJASIDAN otiladi, foydalanuvchi bosgan
 * "Yangilash" tugmasidan emas: oshxona xodimi ekranga qaramaydi, ovozning
 * butun ma'nosi shu (vendor-panels doktrinasi).
 *
 * Ikkita poll bir vaqtda ishlaydi (layout — 30 s, buyurtmalar sahifasi —
 * 15 s), shuning uchun "ko'rilgan" buyurtmalar to'plami MODUL darajasida
 * saqlanadi: qaysi poll birinchi ko'rsa, signal BIR MARTA chalinadi.
 * Bu ataylab qilingan singleton — ikki nusxada bo'lsa signal ikki marta
 * chalinardi.
 */
let seenIds: Set<string> | null = null;
let lastBeepAt = 0;

/** Testlar va logout uchun — to'plamni tozalaydi. */
export function resetOrderAlerts(): void {
  seenIds = null;
  lastBeepAt = 0;
}

/**
 * Poll natijasini ro'yxatga oladi. Avval ko'rilmagan `new` holatdagi
 * buyurtmalar soni qaytadi; `soundOn` bo'lsa signal chalinadi.
 * Birinchi yuklanish "yangi kelgan" hisoblanmaydi — sahifa ochilganda
 * navbatda turgan eski buyurtmalar uchun signal chalinmaydi.
 */
export function trackNewOrders(orders: FoodOrder[], soundOn: boolean): number {
  const currentNew = orders.filter((o) => o.status === 'new').map((o) => o.id);

  if (seenIds === null) {
    seenIds = new Set(currentNew);
    return 0;
  }

  const set = seenIds;
  const unseen = currentNew.filter((id) => !set.has(id));
  unseen.forEach((id) => set.add(id));

  if (unseen.length > 0 && soundOn) playNewOrderSound();
  return unseen.length;
}

/**
 * Ikki tonli qisqa signal — WebAudio, tashqi fayl kerak emas.
 * Brauzer autoplay siyosati birinchi foydalanuvchi harakati bo'lmaguncha
 * ovozni bloklashi mumkin — bu holda jim davom etamiz: vizual kanal
 * (yorqin karta, badge, sarlavha) baribir ishlaydi.
 */
function playNewOrderSound(): void {
  const nowMs = Date.now();
  if (nowMs - lastBeepAt < 3000) return; // ketma-ket poll'larda dublikat bo'lmasin
  lastBeepAt = nowMs;

  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    void ctx.resume().catch(() => {});

    const tone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    };

    tone(880, 0, 0.22);
    tone(660, 0.28, 0.34);

    // Kontekstni yopib qo'yamiz — har signal uchun yangi ochiladi.
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Ovoz chiqmasa ham xato emas — vizual kanal yetarli.
  }
}
