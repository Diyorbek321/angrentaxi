'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'angren-market-chime';

/**
 * Audio cue for incoming orders.
 *
 * The tone is synthesised with the Web Audio API rather than shipped as a
 * file: no asset to load, nothing added to the bundle, and it still works
 * offline. Browsers refuse to start an AudioContext without a user gesture,
 * so the context is created when the vendor flips the switch on — which is
 * itself the gesture that unlocks it.
 */
export function useOrderChime() {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  // localStorage is read here, never during render — reading it in the render
  // body is the hydration trap the task spec warns about.
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === 'on');
    } catch {
      /* private mode — stays off for this session */
    }
  }, []);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const toggle = useCallback(
    (next: boolean) => {
      setEnabled(next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
      } catch {
        /* ignore */
      }
      if (next) ensureContext();
    },
    [ensureContext]
  );

  /** Two-note rising chime — audible over shop noise, short enough not to nag. */
  const play = useCallback(() => {
    if (!enabled) return;
    const ctx = ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.13 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.22, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.3);
    });
  }, [enabled, ensureContext]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { enabled, toggle, play };
}
