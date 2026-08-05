'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket, SOCKET_EVENTS } from '@/lib/socket';

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

  // Connecting is synchronous: the handshake carries the session cookie to our
  // own origin, so there is no token to fetch before the socket can be opened.
  const connect = useCallback(() => {
    setStatus('connecting');

    const sock = getSocket();
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

    return () => {
      sock.off(SOCKET_EVENTS.CONNECT, onConnect);
      sock.off(SOCKET_EVENTS.DISCONNECT, onDisconnect);
      sock.off(SOCKET_EVENTS.CONNECT_ERROR, onConnectError);
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
