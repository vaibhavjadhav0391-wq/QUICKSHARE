/**
 * In-memory session manager with automatic TTL expiration.
 * No database needed — sessions are inherently temporary.
 *
 * Session lifecycle:
 *   create → waiting_for_peer → connected → (expired or ended)
 */

export type SessionStatus = 'waiting' | 'connected' | 'ended';

export interface Session {
  token: string;
  shortCode: string;
  status: SessionStatus;
  /** Socket.IO socket ID of the PC (initiator) */
  pcSocketId: string;
  /** Socket.IO socket ID of the mobile (joiner), null until joined */
  mobileSocketId: string | null;
  createdAt: number;
  /** Updated on any activity to reset the inactivity timer */
  lastActivityAt: number;
}

// Maximum session lifetime even with activity (30 minutes)
const MAX_SESSION_AGE_MS = 30 * 60 * 1000;
// Inactivity timeout (10 minutes of no activity)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
// How often to run the cleanup sweep
const CLEANUP_INTERVAL_MS = 60 * 1000;

class SessionManager {
  private sessions = new Map<string, Session>();
  /** Index: shortCode → token for quick lookup */
  private shortCodeIndex = new Map<string, string>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  createSession(token: string, shortCode: string, pcSocketId: string): Session {
    const now = Date.now();
    const session: Session = {
      token,
      shortCode,
      status: 'waiting',
      pcSocketId,
      mobileSocketId: null,
      createdAt: now,
      lastActivityAt: now,
    };
    this.sessions.set(token, session);
    this.shortCodeIndex.set(shortCode, token);
    console.log(`[SessionManager] Created session ${token.slice(0, 8)}... shortCode=${shortCode}`);
    return session;
  }

  getByToken(token: string): Session | undefined {
    return this.sessions.get(token);
  }

  getByShortCode(shortCode: string): Session | undefined {
    const token = this.shortCodeIndex.get(shortCode.toUpperCase());
    if (!token) return undefined;
    return this.sessions.get(token);
  }

  joinSession(token: string, mobileSocketId: string): Session | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.status !== 'waiting') return null; // Already has a peer
    session.mobileSocketId = mobileSocketId;
    session.status = 'connected';
    session.lastActivityAt = Date.now();
    return session;
  }

  touchSession(token: string): void {
    const session = this.sessions.get(token);
    if (session) session.lastActivityAt = Date.now();
  }

  endSession(token: string): void {
    const session = this.sessions.get(token);
    if (!session) return;
    session.status = 'ended';
    this.shortCodeIndex.delete(session.shortCode);
    this.sessions.delete(token);
    console.log(`[SessionManager] Ended session ${token.slice(0, 8)}...`);
  }

  /**
   * Find and end any session owned by a given socket ID.
   * Called when a socket disconnects unexpectedly.
   */
  endSessionBySocketId(socketId: string): Session | null {
    for (const [token, session] of this.sessions) {
      if (session.pcSocketId === socketId || session.mobileSocketId === socketId) {
        this.endSession(token);
        return session;
      }
    }
    return null;
  }

  getSessionBySocketId(socketId: string): Session | null {
    for (const session of this.sessions.values()) {
      if (session.pcSocketId === socketId || session.mobileSocketId === socketId) {
        return session;
      }
    }
    return null;
  }

  /** Sweep expired sessions */
  private cleanup(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions) {
      const age = now - session.createdAt;
      const inactivity = now - session.lastActivityAt;
      if (age > MAX_SESSION_AGE_MS || inactivity > INACTIVITY_TIMEOUT_MS) {
        console.log(`[SessionManager] Expiring session ${token.slice(0, 8)}... (age=${Math.round(age / 1000)}s)`);
        this.shortCodeIndex.delete(session.shortCode);
        this.sessions.delete(token);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
