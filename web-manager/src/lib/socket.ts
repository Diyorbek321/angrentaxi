import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

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
