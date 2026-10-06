import type { FraudSignal } from './api';

/** Belgining menejerga tushunarli izohi — nega bu safar shubhali. */
export const SIGNAL_LABEL: Record<FraudSignal, { title: string; strong: boolean }> = {
  same_device: { title: 'Yoʻlovchi va haydovchi bitta telefondan', strong: true },
  repeated_pair: { title: 'Shu juftlik 7 kunda 3+ safar', strong: true },
  new_passenger_one_driver: { title: 'Yangi akkaunt faqat shu haydovchi bilan yuradi', strong: true },
  driver_at_pickup: { title: 'Haydovchi qabul qilganda olish nuqtasida turgan', strong: false },
  too_short: { title: 'Juda qisqa safar (<500 m yoki <2 daq)', strong: false },
};

/** Kuchli belgilar birinchi — menejer eng muhimini avval koʻrsin. */
export function sortSignals(signals: FraudSignal[]): FraudSignal[] {
  return [...signals].sort((a, b) => Number(SIGNAL_LABEL[b].strong) - Number(SIGNAL_LABEL[a].strong));
}
