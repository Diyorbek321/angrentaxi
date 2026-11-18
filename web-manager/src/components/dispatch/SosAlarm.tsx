'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Siren } from 'lucide-react';
import { SOCKET_EVENTS, subscribeToSocket } from '@/lib/socket';
import {
  acknowledgeSos,
  addSosAlert,
  EMPTY_SOS_ALARM,
  removeResolvedSos,
  shouldRing,
  startAlarmSound,
  type SosAlarmState,
  type SosAlertEvent,
  type SosResolvedEvent,
} from '@/lib/sos-alarm';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { shortId } from '@/lib/format';
import { t } from '@/locales';

interface SosAlarmProps {
  /** Yangi SOS keldi — yon panel nishoni so'rovni kutmasdan oshadi. */
  onNewAlert: () => void;
  /** Ochish tugmasi qayerga olib boradi (istisnolar sahifasi). */
  exceptionsHref: string;
}

/**
 * SOS — socket orqali DARHOL, ovoz bilan (INCIDENT-POLICY §4). "Qabul
 * qildim" bosilmaguncha ovoz takrorlanadi. Boshqa dispetcher yopsa
 * (`sos:resolved`) bu yerda ham to'xtaydi. So'rov (15/30 s) zaxira bo'lib
 * qoladi — socket uzilganda ham SOS ro'yxatda chiqadi, faqat ovozsiz.
 */
export function SosAlarm({ onNewAlert, exceptionsHref }: SosAlarmProps) {
  const m = t().safety.alarm;
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<SosAlarmState>(EMPTY_SOS_ALARM);
  const stopSound = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onNewAlert, toast });
  callbacks.current = { onNewAlert, toast };

  useEffect(
    () =>
      subscribeToSocket((socket) => {
        const onAlert = (payload: SosAlertEvent) => {
          if (!payload?.id) return;
          setState((prev) => addSosAlert(prev, payload));
          callbacks.current.onNewAlert();
          const role = payload.reporterRole ?? payload.reportedByRole;
          callbacks.current.toast({
            title: t().safety.alarm.toastTitle,
            description: t().safety.alarm.toastBody(
              shortId(payload.orderId),
              role === 'driver' ? t().safety.alarm.driver : t().safety.alarm.passenger,
            ),
            variant: 'error',
          });
        };
        const onResolved = (payload: SosResolvedEvent) => {
          if (payload?.id) setState((prev) => removeResolvedSos(prev, payload));
        };
        socket.on(SOCKET_EVENTS.SOS_ALERT, onAlert);
        socket.on(SOCKET_EVENTS.SOS_RESOLVED, onResolved);
        return () => {
          socket.off(SOCKET_EVENTS.SOS_ALERT, onAlert);
          socket.off(SOCKET_EVENTS.SOS_RESOLVED, onResolved);
        };
      }),
    [],
  );

  const ringing = shouldRing(state);
  useEffect(() => {
    if (ringing && !stopSound.current) stopSound.current = startAlarmSound();
    if (!ringing && stopSound.current) {
      stopSound.current();
      stopSound.current = null;
    }
  }, [ringing]);
  useEffect(() => () => stopSound.current?.(), []);

  if (!ringing) return null;
  const latest = state.unacked[0];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[2000] w-[min(32rem,calc(100vw-2rem))] rounded-ds-md border border-danger bg-danger text-white shadow-pop px-4 py-3 flex items-center gap-3 animate-pulse-ring"
    >
      <Siren aria-hidden className="shrink-0" size={22} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{m.title}</p>
        <p className="text-xs opacity-90 truncate">
          {m.count(state.unacked.length)} · <span className="font-mono">{shortId(latest.orderId)}</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setState(acknowledgeSos(state));
          router.push(exceptionsHref);
        }}
      >
        {m.open}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setState(acknowledgeSos(state))}>
        {m.acknowledge}
      </Button>
    </div>
  );
}
