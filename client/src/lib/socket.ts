import { io, Socket } from 'socket.io-client';

/**
 * Socket.IO client singleton.
 *
 * In development: Vite proxies /socket.io → localhost:3001
 * In production:  connects to the same origin (server serves everything)
 *
 * We use a lazy singleton so components that import this file don't
 * immediately open a socket on module load — call `getSocket()` to initialize.
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  // Determine the server URL:
  // - In dev (Vite proxy), connect to same origin → proxy handles it
  // - In production, same origin handles both HTTP and WS
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;

  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: false, // We connect explicitly
  });

  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
