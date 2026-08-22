import { Server, Socket } from 'socket.io';
import { sessionManager } from '../services/sessionManager';
import { generateToken, generateShortCode } from '../utils/crypto';

/**
 * Registers all Socket.IO event handlers for the signaling server.
 *
 * Signaling flow:
 *   PC: emit('create-session') → receive('session-created', { token, shortCode })
 *   Mobile: emit('join-session', { token }) → receive('peer-joined') on PC
 *   Both exchange WebRTC offer/answer/ICE via relay events
 *
 * Fallback flow (when WebRTC DataChannel is unavailable):
 *   Sender emits 'transfer-chunk' → server relays to peer's socket room
 */
export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION CREATION (PC side)
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('create-session', () => {
      const token = generateToken();
      const shortCode = generateShortCode();
      const session = sessionManager.createSession(token, shortCode, socket.id);

      // PC joins a Socket.IO room named by the token for easy broadcasting
      socket.join(token);

      socket.emit('session-created', { token, shortCode });
      console.log(`[Socket] Session created by ${socket.id}: ${token.slice(0, 8)}...`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION JOIN (Mobile side)
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('join-session', ({ token }: { token: string }) => {
      if (!token || typeof token !== 'string' || token.length > 128) {
        socket.emit('join-error', { message: 'Invalid session token.' });
        return;
      }

      const session = sessionManager.getByToken(token);

      if (!session) {
        socket.emit('join-error', { message: 'Session not found or expired. Please ask the PC to generate a new QR code.' });
        return;
      }

      if (session.status !== 'waiting') {
        socket.emit('join-error', { message: 'This session already has a connected device. Start a new session on the PC.' });
        return;
      }

      // Guard: prevent the same socket from joining its own session
      if (session.pcSocketId === socket.id) {
        socket.emit('join-error', { message: 'Cannot join your own session.' });
        return;
      }

      const joined = sessionManager.joinSession(token, socket.id);
      if (!joined) {
        socket.emit('join-error', { message: 'Failed to join session.' });
        return;
      }

      // Mobile joins the same room
      socket.join(token);

      // Notify mobile that join succeeded
      socket.emit('join-success', { token });

      // Notify PC that a peer has joined
      socket.to(joined.pcSocketId).emit('peer-joined', { peerId: socket.id });

      console.log(`[Socket] Mobile ${socket.id} joined session ${token.slice(0, 8)}...`);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // JOIN BY SHORT CODE (fallback when camera isn't available)
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('join-by-code', ({ shortCode }: { shortCode: string }) => {
      if (!shortCode || typeof shortCode !== 'string') {
        socket.emit('join-error', { message: 'Invalid code.' });
        return;
      }

      const session = sessionManager.getByShortCode(shortCode.toUpperCase());
      if (!session) {
        socket.emit('join-error', { message: 'Code not found. Check the code shown on the PC and try again.' });
        return;
      }

      // Re-emit join-session with the resolved token
      socket.emit('code-resolved', { token: session.token });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // WEBRTC SIGNALING RELAY
    // The server simply forwards these messages to the other peer in the room.
    // It does NOT inspect SDP or ICE candidates.
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('offer', ({ token, sdp }: { token: string; sdp: Record<string, unknown> }) => {
      if (!validateSessionMembership(socket.id, token)) return;
      sessionManager.touchSession(token);
      // Relay offer to the other peer in the room
      socket.to(token).emit('offer', { sdp });
      console.log(`[Signal] Offer relayed in session ${token.slice(0, 8)}...`);
    });

    socket.on('answer', ({ token, sdp }: { token: string; sdp: Record<string, unknown> }) => {
      if (!validateSessionMembership(socket.id, token)) return;
      sessionManager.touchSession(token);
      socket.to(token).emit('answer', { sdp });
      console.log(`[Signal] Answer relayed in session ${token.slice(0, 8)}...`);
    });

    socket.on('ice-candidate', ({ token, candidate }: { token: string; candidate: Record<string, unknown> }) => {
      if (!validateSessionMembership(socket.id, token)) return;
      sessionManager.touchSession(token);
      socket.to(token).emit('ice-candidate', { candidate });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // WEBSOCKET FALLBACK TRANSFER
    // Used when WebRTC DataChannel cannot be established (e.g., symmetric NAT
    // without a TURN server). Chunks are relayed through the server temporarily
    // and never stored to disk.
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('transfer-chunk', (data: {
      token: string;
      chunkIndex: number;
      totalChunks: number;
      chunk: Buffer | ArrayBuffer;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }) => {
      if (!validateSessionMembership(socket.id, data.token)) return;
      sessionManager.touchSession(data.token);
      // Relay to the other peer — chunk is binary data, never stored
      socket.to(data.token).emit('transfer-chunk', data);
    });

    socket.on('transfer-cancel', ({ token }: { token: string }) => {
      if (!validateSessionMembership(socket.id, token)) return;
      socket.to(token).emit('transfer-cancel');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SESSION MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('end-session', ({ token }: { token: string }) => {
      const session = sessionManager.getByToken(token);
      if (!session) return;
      // Only the PC (creator) can formally end the session
      if (session.pcSocketId !== socket.id) return;

      io.to(token).emit('session-ended', { reason: 'Host ended the session.' });
      sessionManager.endSession(token);
      socket.leave(token);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // DISCONNECT HANDLING
    // ─────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);

      const session = sessionManager.getSessionBySocketId(socket.id);
      if (!session) return;

      if (session.pcSocketId === socket.id) {
        // PC disconnected — notify mobile and end session
        socket.to(session.token).emit('peer-disconnected', { role: 'pc' });
        sessionManager.endSession(session.token);
      } else if (session.mobileSocketId === socket.id) {
        // Mobile disconnected — notify PC, reset to waiting
        session.mobileSocketId = null;
        session.status = 'waiting';
        socket.to(session.token).emit('peer-disconnected', { role: 'mobile' });
        console.log(`[Socket] Mobile disconnected; session ${session.token.slice(0, 8)}... reset to waiting`);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    function validateSessionMembership(socketId: string, token: string): boolean {
      const session = sessionManager.getByToken(token);
      if (!session) return false;
      return session.pcSocketId === socketId || session.mobileSocketId === socketId;
    }
  });
}
