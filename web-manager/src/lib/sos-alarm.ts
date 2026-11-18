/**
 * SOS signali (INCIDENT-POLICY §4): socket `sos:alert` kelishi bilan
 * dispetcher panelida DARHOL ovoz — qabul qilinmaguncha takrorlanadi.
 *
 * Holat sof funksiyalarda (`SosAlarmState`) — test qilinadi; ovoz alohida
 * (`startAlarmSound`), WebAudio, tashqi fayl yo'q (web-restaurant
 * `order-alerts.ts` naqshi). Brauzer autoplay'ni bloklasa — jim, lekin
 * banner va nishon baribir ko'rinadi.
 */

/** Socket `sos:alert` payload'i (backend SafetyService.reportSos). */
export interface SosAlertEvent {
  id: string;
  orderId: string;
  reporterRole?: 'passenger' | 'driver';
  reportedByRole?: 'passenger' | 'driver';
  lat?: number;
  lng?: number;
  createdAt?: string;
}

/** `sos:resolved` — boshqa dispetcher yopdi. */
export interface SosResolvedEvent {
  id: string;
  orderId: string;
}

export interface SosAlarmState {
  /** Hali "Qabul qildim" bosilmagan signallar, eng yangisi birinchi. */
  unacked: SosAlertEvent[];
}

export const EMPTY_SOS_ALARM: SosAlarmState = { unacked: [] };

/** Takroriy hodisa (qayta ulanish) ikkinchi qator qo'shmaydi. */
export function addSosAlert(state: SosAlarmState, alert: SosAlertEvent): SosAlarmState {
  if (!alert?.id || state.unacked.some((a) => a.id === alert.id)) return state;
  return { unacked: [alert, ...state.unacked] };
}

/** "Qabul qildim" — hammasi yoki bittasi. */
export function acknowledgeSos(state: SosAlarmState, id?: string): SosAlarmState {
  if (!id) return EMPTY_SOS_ALARM;
  return { unacked: state.unacked.filter((a) => a.id !== id) };
}

/** Boshqa panelda yopilgan signal — bu yerda ham ovoz to'xtaydi. */
export function removeResolvedSos(state: SosAlarmState, event: SosResolvedEvent): SosAlarmState {
  return { unacked: state.unacked.filter((a) => a.id !== event.id) };
}

export function shouldRing(state: SosAlarmState): boolean {
  return state.unacked.length > 0;
}

/** Signal oralig'i — ovoz shu bilan takrorlanadi. */
export const SOS_ALARM_REPEAT_MS = 2_500;

/**
 * Qabul qilinmaguncha takrorlanadigan uch tonli signal. Qaytadi: to'xtatish
 * funksiyasi. `AudioContext` yo'q (SSR/test) — no-op.
 */
export function startAlarmSound(): () => void {
  if (typeof window === 'undefined') return () => {};
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return () => {};
  let ctx: AudioContext | null = null;
  try {
    ctx = new Ctor();
    void ctx.resume().catch(() => {});
  } catch {
    return () => {};
  }
  const audio = ctx;
  const tone = (freq: number, start: number, duration: number) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audio.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(audio.currentTime + start);
    osc.stop(audio.currentTime + start + duration + 0.05);
  };
  const ring = () => {
    try {
      tone(988, 0, 0.18);
      tone(784, 0.22, 0.18);
      tone(988, 0.44, 0.3);
    } catch {
      /* ovoz chiqmasa ham vizual kanal ishlaydi */
    }
  };
  ring();
  const timer = window.setInterval(ring, SOS_ALARM_REPEAT_MS);
  return () => {
    window.clearInterval(timer);
    void audio.close().catch(() => {});
  };
}
