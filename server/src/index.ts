import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { registerSocketHandlers } from './signaling/socketHandler';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// CORS — only allow the frontend origin to connect
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: NODE_ENV === 'production'
    ? CLIENT_ORIGIN
    : ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // Signaling only — no file bodies

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVE STATIC CLIENT IN PRODUCTION
// ─────────────────────────────────────────────────────────────────────────────
if (NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — all routes → index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP + SOCKET.IO SERVER
// ─────────────────────────────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: NODE_ENV === 'production'
      ? CLIENT_ORIGIN
      : ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Allow larger payloads for WS fallback file chunk relay
  maxHttpBufferSize: 5 * 1024 * 1024, // 5 MB per message (chunked anyway)
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Register all signaling event handlers
registerSocketHandlers(io);

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          QuickTransfer Signaling Server       ║
╠══════════════════════════════════════════════╣
║  Port    : ${PORT.toString().padEnd(35)}║
║  Env     : ${NODE_ENV.padEnd(35)}║
║  Origin  : ${CLIENT_ORIGIN.padEnd(35)}║
╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received — shutting down gracefully');
  httpServer.close(() => process.exit(0));
});
