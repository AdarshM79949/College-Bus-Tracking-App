import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';
import { getToken } from '../api';

/**
 * Connects a Socket.IO client with the current JWT token.
 * Returns { socket, connected }.
 */
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      console.error('[socket] connect_error', err.message);
    });
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef.current, connected };
}
