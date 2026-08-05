'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { ensureSocket, disconnectSocket, SOCKET_EVENTS } from '@/lib/socket';

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseSocketReturn {
  socket: Socket | null;
  status: SocketStatus;
  isConnected: boolean;
  reconnect: () => void;
}

export function useSocket(): UseSocketReturn {
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);

  // Connecting is asynchronous now: the handshake token has to be fetched from
  // our own /api/auth/socket-token, because it is no longer readable from JS.
  // The returned teardown therefore has to cope with unmounting mid-fetch.
  const connect = useCallback(() => {
    let cancelled = false;
    let detach = () => {};

    setStatus('connecting');

    ensureSocket().then((sock) => {
      if (cancelled) return;
      if (!sock) {
        setStatus('error');
        return;
      }

      socketRef.current = sock;

      const onConnect = () => setStatus('connected');
      const onDisconnect = () => setStatus('disconnected');
      const onConnectError = () => setStatus('error');

      sock.on(SOCKET_EVENTS.CONNECT, onConnect);
      sock.on(SOCKET_EVENTS.DISCONNECT, onDisconnect);
      sock.on(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);

      // If already connected
      if (sock.connected) {
        setStatus('connected');
      }

      detach = () => {
        sock.off(SOCKET_EVENTS.CONNECT, onConnect);
        sock.off(SOCKET_EVENTS.DISCONNECT, onDisconnect);
        sock.off(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
      };
    });

    return () => {
      cancelled = true;
      detach();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    disconnectSocket();
    socketRef.current = null;
    connect();
  }, [connect]);

  return {
    socket: socketRef.current,
    status,
    isConnected: status === 'connected',
    reconnect,
  };
}
