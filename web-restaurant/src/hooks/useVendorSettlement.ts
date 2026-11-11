'use client';

import { useEffect, useRef, useState } from 'react';
import { settingsApi } from '@/lib/api';
import { subscribeVendorWalletEvents } from '@/lib/realtime';
import {
  parsePublicSettings,
  walletReversedToast,
  walletSettledToast,
  type VendorPublicSettings,
} from '@/lib/vendor-settlement';
import { useToast } from '@/components/ui/Toast';

/** Rejim kamdan-kam o'zgaradi, lekin sana kelganda o'zi `wallet` bo'ladi. */
const SETTINGS_POLL_MS = 10 * 60_000;

/**
 * `GET /settings/public` — amaldagi hisob-kitob rejimi. Yuklanguncha yoki xato
 * bo'lsa `null`: chaqiruvchi bugungi (naqd) oqimni ko'rsatadi, backend esa
 * baribir noto'g'ri amalni rad etadi.
 */
export function useVendorSettlement(): VendorPublicSettings | null {
  const [settings, setSettings] = useState<VendorPublicSettings | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await settingsApi.getPublic();
        if (alive) setSettings(parsePublicSettings(res.data.data));
      } catch {
        // Oxirgi ma'lum qiymat qoladi — sozlama ikkinchi darajali ma'lumot.
      }
    };
    void load();
    const id = setInterval(() => void load(), SETTINGS_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return settings;
}

/** `vendor:wallet_settled` / `vendor:wallet_reversed` kelganda toast. */
export function useWalletSettlementToasts(enabled = true): void {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  useEffect(() => {
    if (!enabled) return;
    return subscribeVendorWalletEvents({
      onSettled: (e) => toastRef.current({ ...walletSettledToast(e), variant: 'success' }),
      onReversed: (e) => toastRef.current({ ...walletReversedToast(e), variant: 'info' }),
    });
  }, [enabled]);
}
