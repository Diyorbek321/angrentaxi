import type { FraudSignal } from './api';
import { t } from '@/locales';

/** Belgining menejerga tushunarli izohi — nega bu safar shubhali. */
const STRONG_SIGNALS: Record<FraudSignal, boolean> = {
  same_device: true,
  repeated_pair: true,
  new_passenger_one_driver: true,
  driver_at_pickup: false,
  too_short: false,
};

export function signalLabels(): Record<FraudSignal, { title: string; strong: boolean }> {
  const titles = t().lib.fraudSignal;
  const keys = Object.keys(STRONG_SIGNALS) as FraudSignal[];
  return Object.fromEntries(
    keys.map((key) => [key, { title: titles[key], strong: STRONG_SIGNALS[key] }])
  ) as Record<FraudSignal, { title: string; strong: boolean }>;
}

/** Kuchli belgilar birinchi — menejer eng muhimini avval koʻrsin. */
export function sortSignals(signals: FraudSignal[]): FraudSignal[] {
  return [...signals].sort((a, b) => Number(STRONG_SIGNALS[b]) - Number(STRONG_SIGNALS[a]));
}
