import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let pendingConnect: Promise<Socket | null> | null = null;

export function getSocket(token: string): Socket {
  // Reuse the same instance for the page session — recreating it whenever it
  // isn't `connected` yet (e.g. still mid-handshake) orphaned any listeners
  // already attached by other hooks, since each call would swap in a fresh
  // socket. socket.io's own reconnection logic handles transient drops.
  if (!socket) {
    // Backend's RealtimeGateway is mounted on the /ws namespace, not the default one.
    socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

/**
 * Async entry point every consumer should use now.
 *
 * The handshake token is no longer readable from `document.cookie`, so it has to
 * be asked for. The fetch is shared: several hooks mount at once on the dispatch
 * screen and each used to call `getSocket(token)` synchronously — without the
 * shared promise they would each issue their own token request before the first
 * one had created the socket.
 */
export async function ensureSocket(): Promise<Socket | null> {
  if (socket) return socket;

  if (!pendingConnect) {
    pendingConnect = fetchSocketToken()
      .then((token) => (token ? getSocket(token) : null))
      .catch(() => null)
      .finally(() => {
        pendingConnect = null;
      });
  }

  return pendingConnect;
}

/**
 * `useEffect`-shaped wrapper around `ensureSocket`.
 *
 * Effects have to hand back their teardown synchronously, but the socket is only
 * available a promise later. This bridges the two: `register` runs once the socket
 * exists and returns its own unsubscribe, and unmounting before that happens
 * simply cancels the registration.
 */
export function subscribeToSocket(register: (socket: Socket) => () => void): () => void {
  let cancelled = false;
  let detach = () => {};

  ensureSocket().then((socket) => {
    if (!socket || cancelled) return;
    detach = register(socket);
  });

  return () => {
    cancelled = true;
    detach();
  };
}

async function fetchSocketToken(): Promise<string | null> {
  const res = await fetch('/api/auth/socket-token', { credentials: 'same-origin' });
  if (!res.ok) return null;
  const payload = (await res.json().catch(() => null)) as { data?: { token?: string } } | null;
  return payload?.data?.token ?? null;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  pendingConnect = null;
}

export function getExistingSocket(): Socket | null {
  return socket;
}

// ─── Socket Event Names ──────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  // Order events (server → client)
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_COMPLETED: 'order:completed',

  // Driver events (server → client)
  DRIVER_STATUS_CHANGED: 'driver:status_changed',
  DRIVER_LOCATION: 'driver:location',
  DRIVER_ONLINE: 'driver:online',
  DRIVER_OFFLINE: 'driver:offline',

  // Support chat events
  SUPPORT_MESSAGE_SEND: 'support:message', // client → server
  SUPPORT_MESSAGE_NEW: 'support:message:new', // server → client
  SUPPORT_THREAD_UPDATED: 'support:thread:updated',
  JOIN_SUPPORT_THREAD: 'join:support:thread',
  LEAVE_SUPPORT_THREAD: 'leave:support:thread',

  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
} as const;
