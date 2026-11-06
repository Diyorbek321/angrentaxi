'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'angren-market-chime';

/** Qisqa ikki tonli signal — fayl kerak emas (Web Audio). */
function playChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tone = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.4);
    };
    tone(880, 0);
    tone(1175, 0.18);
    setTimeout(() => void ctx.close().catch(() => undefined), 1000);
  } catch {
    /* brauzer avtoplayni bloklagan — tab sarlavhasi va badge baribir bor */
  }
}

/**
 * Yangi buyurtmalar soni OSHGANDA signal beradi (birinchi yuklashda emas).
 * Sotuvchi o'chirib qo'yishi mumkin — tanlov shu brauzerda saqlanadi.
 */
export function useNewOrderChime(count: number | null): { enabled: boolean; toggle: () => void } {
  const [enabled, setEnabled] = useState(true);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'off') setEnabled(false);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (count === null) return;
    if (enabled && prev.current !== null && count > prev.current) playChime();
    prev.current = count;
  }, [count, enabled]);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}
