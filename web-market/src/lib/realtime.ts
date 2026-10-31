import { io, Socket } from 'socket.io-client';
import type { WalletReversedEvent, WalletSettledEvent } from '@/lib/vendor-settlement';

/**
 * Jonli ulanish: yangi buyurtma polling'ni kutmasdan darhol ko'rinadi.
 *
 * Token sahifaga berilmaydi: handshake o'z origin'imizga boradi, `server.js`
 * (`server/upgrade-proxy.js`) httpOnly sessiya cookie'sini o'qib, backend'ga
 * Bearer sarlavhasi bilan uzatadi — web-manager bilan bir xil usul.
 *
 * Socket faqat "yangilash kerak" signalini beradi; ma'lumot baribir odatdagi
 * so'rov bilan olinadi. Shuning uchun polling zaxira bo'lib qoladi: socket
 * uzilsa ham panel eskicha ishlayveradi.
 */

/** Backend sotuvchiga yuboradigan, ro'yxatni yangilashni talab qiladigan hodisalar. */
export const VENDOR_REFRESH_EVENTS = [
  'market:order:created',
  // Mijoz buyurtmani bekor qildi (spec v5 §1) — nom backend bilan kelishiladi.
  'market:order:cancelled',
  'market:delivery:failed',
  'vendor:cash_paid',
  'vendor:cash_dispute_resolved',
  // Hamyon rejimi (docs/LEGAL-COMPLIANCE.md §7, §14): o'tkazma va teskarisi.
  'vendor:wallet_settled',
  'vendor:wallet_reversed',
] as const;

/** Muddati o'tgan token bilan server uzsa — cookie yangilanishini kutib qayta urinish. */
const SERVER_DISCONNECT_RETRY_MS = 15_000;

let socket: Socket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const sock = io('/ws', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      // Oshxona ekrani soatlab ochiq turadi — urinishlar tugab qolmasin.
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
    });
    // Server o'zi uzgan holatda (token rad etildi) socket.io qayta ulanmaydi.
    // Bu orada axios interceptor tokenni yangilagan bo'ladi.
    sock.on('disconnect', (reason) => {
      if (reason !== 'io server disconnect' || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (socket === sock) sock.connect();
      }, SERVER_DISCONNECT_RETRY_MS);
    });
    socket = sock;
  }
  return socket;
}

export function disconnectSocket(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  socket?.disconnect();
  socket = null;
}

/**
 * [onRefresh] ni sotuvchi hodisasi kelganda va (qayta) ulanganda chaqiradi —
 * uzilish paytida o'tkazib yuborilgan hodisalar shu bilan qoplanadi.
 * Ketma-ket hodisalar bitta so'rovga yig'iladi.
 */
export function subscribeVendorRefresh(onRefresh: () => void, debounceMs = 300): () => void {
  const sock = getSocket();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let connectedOnce = sock.connected;
  const fire = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onRefresh();
    }, debounceMs);
  };
  // Birinchi ulanishda sahifa ma'lumoti hozirgina yuklangan — faqat qayta ulanish muhim.
  const onConnect = () => {
    if (connectedOnce) fire();
    connectedOnce = true;
  };

  sock.on('connect', onConnect);
  VENDOR_REFRESH_EVENTS.forEach((event) => sock.on(event, fire));
  return () => {
    if (timer) clearTimeout(timer);
    sock.off('connect', onConnect);
    VENDOR_REFRESH_EVENTS.forEach((event) => sock.off(event, fire));
  };
}

/**
 * Hamyon o'tkazmasi hodisalari — yuki bilan (toast uchun). Ro'yxatni yangilash
 * esa [subscribeVendorRefresh] orqali alohida bo'ladi.
 */
export function subscribeVendorWalletEvents(handlers: {
  onSettled: (payload: WalletSettledEvent) => void;
  onReversed: (payload: WalletReversedEvent) => void;
}): () => void {
  const sock = getSocket();
  const settled = (payload: WalletSettledEvent) => handlers.onSettled(payload);
  const reversed = (payload: WalletReversedEvent) => handlers.onReversed(payload);
  sock.on('vendor:wallet_settled', settled);
  sock.on('vendor:wallet_reversed', reversed);
  return () => {
    sock.off('vendor:wallet_settled', settled);
    sock.off('vendor:wallet_reversed', reversed);
  };
}
