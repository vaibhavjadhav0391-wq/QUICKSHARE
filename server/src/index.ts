import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { registerSocketHandlers } from './signaling/socketHandler';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

// Helper to validate origin
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow non-browser requests / curl
  if (origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  if (process.env.CLIENT_ORIGIN && origin === process.env.CLIENT_ORIGIN) return true;
  return true; // Allow all origins for signaling
};

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Allow Vercel frontend & dev clients to connect
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
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
// SERVE STATIC CLIENT IN PRODUCTION (IF DIST EXISTS)
// ─────────────────────────────────────────────────────────────────────────────
if (NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.log('[Server] Client dist folder not found. Assuming frontend is deployed separately.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP + SOCKET.IO SERVER
// ─────────────────────────────────────────────────────────────────────────────
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 5 * 1024 * 1024, // 5 MB per message
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
