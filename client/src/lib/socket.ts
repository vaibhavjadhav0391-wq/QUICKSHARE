import { io, Socket } from 'socket.io-client';

/**
 * Socket.IO client singleton.
 *
 * Automatically resolves the signaling server URL:
 * - VITE_SERVER_URL environment variable if set
 * - Default production Render backend if running on Vercel (vercel.app)
 * - Same origin / dev proxy fallback
 */

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  const RENDER_BACKEND_URL = 'https://quickshare-pqsc.onrender.com';
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

  const SERVER_URL =
    import.meta.env.VITE_SERVER_URL ||
    (isVercel ? RENDER_BACKEND_URL : window.location.origin);

  console.log('[Socket] Connecting to signaling server:', SERVER_URL);

  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: false,
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
