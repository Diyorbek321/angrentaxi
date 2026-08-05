import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Opens (or reuses) the realtime connection.
 *
 * No token is passed, and none is available to this file: the handshake goes to
 * *our own* origin, where the custom Node server (`server.js` ->
 * `server/upgrade-proxy.js`) reads the `httpOnly` session cookie the browser
 * attached and turns it into the Bearer header the backend gateway expects. That
 * is why the connection is same-origin rather than pointed at
 * `NEXT_PUBLIC_SOCKET_URL` — a cross-origin handshake would carry no cookie, which
 * is exactly why an access token used to have to be handed to page scripts.
 */
export function getSocket(): Socket {
  // Reuse the same instance for the page session — recreating it whenever it
  // isn't `connected` yet (e.g. still mid-handshake) orphaned any listeners
  // already attached by other hooks, since each call would swap in a fresh
  // socket. socket.io's own reconnection logic handles transient drops.
  if (!socket) {
    // A leading-slash URI means "this origin"; `/ws` is the namespace the backend
    // gateway is mounted on, and `path` is where engine.io itself lives — the
    // upgrade proxy keys off that path.
    socket = io('/ws', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

/**
 * `useEffect`-shaped wrapper around `getSocket`.
 *
 * `register` attaches its listeners and returns its own unsubscribe; this hands
 * that straight back as the effect teardown.
 */
export function subscribeToSocket(register: (socket: Socket) => () => void): () => void {
  return register(getSocket());
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
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
