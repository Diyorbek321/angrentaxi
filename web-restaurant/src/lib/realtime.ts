import { io, Socket } from 'socket.io-client';

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
  'food:order:created',
  'food:delivery:failed',
  'vendor:cash_paid',
  'vendor:cash_dispute_resolved',
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
