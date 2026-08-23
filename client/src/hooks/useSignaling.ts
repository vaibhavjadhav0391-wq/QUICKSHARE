import { useEffect, useCallback, useRef, useState } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { Socket } from 'socket.io-client';
import type { ConnectionState, SessionInfo } from '@/types';

export type SignalingRole = 'pc' | 'mobile' | null;

interface UseSignalingOptions {
  role: SignalingRole;
  /** Token to join (mobile only) */
  joinToken?: string;
  onPeerJoined?: () => void;
  onPeerDisconnected?: (role: 'pc' | 'mobile') => void;
  onSessionEnded?: (reason: string) => void;
  onOffer?: (sdp: RTCSessionDescriptionInit) => void;
  onAnswer?: (sdp: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  onFallbackChunk?: (data: unknown) => void;
  onCodeResolved?: (token: string) => void;
}

interface UseSignalingReturn {
  state: ConnectionState;
  session: SessionInfo | null;
  error: string | null;
  sendOffer: (sdp: RTCSessionDescriptionInit) => void;
  sendAnswer: (sdp: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (candidate: RTCIceCandidateInit) => void;
  endSession: () => void;
  sendFallbackChunk: (data: unknown) => void;
  joinByCode: (code: string) => void;
  markConnected: (via: 'webrtc' | 'ws') => void;
  socket: Socket | null;
}

export function useSignaling(options: UseSignalingOptions): UseSignalingReturn {
  const {
    role,
    joinToken,
    onPeerJoined,
    onPeerDisconnected,
    onSessionEnded,
    onOffer,
    onAnswer,
    onIceCandidate,
    onFallbackChunk,
    onCodeResolved,
  } = options;

  const [state, setState] = useState<ConnectionState>('idle');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Queue a join-by-code call for when the socket connects
  const pendingCodeRef = useRef<string | null>(null);

  // Keep latest callbacks in ref to avoid stale closure issues in socket listeners
  const callbacksRef = useRef({
    onPeerJoined,
    onPeerDisconnected,
    onSessionEnded,
    onOffer,
    onAnswer,
    onIceCandidate,
    onFallbackChunk,
    onCodeResolved,
  });

  useEffect(() => {
    callbacksRef.current = {
      onPeerJoined,
      onPeerDisconnected,
      onSessionEnded,
      onOffer,
      onAnswer,
      onIceCandidate,
      onFallbackChunk,
      onCodeResolved,
    };
  });

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const markConnected = useCallback((via: 'webrtc' | 'ws') => {
    clearFallbackTimer();
    setState(via === 'webrtc' ? 'connected' : 'ws-fallback');
  }, [clearFallbackTimer]);

  useEffect(() => {
    if (!role) return;

    const socket = connectSocket();
    socketRef.current = socket;

    // ── SOCKET LIFECYCLE ──
    const handleConnect = () => {
      console.log('[Signaling] Socket connected:', socket.id);
      setError(null);

      if (role === 'pc') {
        setState('creating');
        socket.emit('create-session');
      } else if (role === 'mobile' && joinToken) {
        socket.emit('join-session', { token: joinToken });
        setState('connecting');
      }

      // Flush any queued join-by-code (emitted before socket was ready)
      if (pendingCodeRef.current) {
        const code = pendingCodeRef.current;
        pendingCodeRef.current = null;
        console.log('[Signaling] Flushing queued join-by-code:', code);
        setState('connecting');
        socket.emit('join-by-code', { shortCode: code });
      }
    };

    if (socket.connected) {
      handleConnect();
    }
    socket.on('connect', handleConnect);

    socket.on('disconnect', (reason) => {
      console.log('[Signaling] Socket disconnected:', reason);
      clearFallbackTimer();
      setState('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[Signaling] Connection error:', err.message);
      setError('Unable to connect to signaling server. Checking connection...');
      setState('error');
    });

    // ── SESSION EVENTS ──
    socket.on('session-created', ({ token, shortCode }: { token: string; shortCode: string }) => {
      console.log('[Signaling] Session created:', token.slice(0, 8), 'code:', shortCode);
      setSession({ token, shortCode });
      setState('waiting');
    });

    socket.on('join-success', () => {
      console.log('[Signaling] Join success on mobile');
      setState('connecting');

      // Start 3.5s fallback timer — if WebRTC P2P fails/stalls, switch to WS relay automatically
      clearFallbackTimer();
      fallbackTimerRef.current = setTimeout(() => {
        setState((current) => {
          if (current === 'connecting') {
            console.log('[Signaling] WebRTC timeout reached (3.5s) — auto fallback to WS relay');
            return 'ws-fallback';
          }
          return current;
        });
      }, 3500);
    });

    socket.on('join-error', ({ message }: { message: string }) => {
      console.error('[Signaling] Join error:', message);
      setError(message);
      setState('error');
    });

    socket.on('code-resolved', ({ token }: { token: string }) => {
      console.log('[Signaling] Code resolved to token:', token);
      callbacksRef.current.onCodeResolved?.(token);
    });

    // ── PEER EVENTS ──
    socket.on('peer-joined', () => {
      console.log('[Signaling] Peer joined on PC');
      setState('connecting');
      callbacksRef.current.onPeerJoined?.();

      // Start 3.5s fallback timer on PC side too
      clearFallbackTimer();
      fallbackTimerRef.current = setTimeout(() => {
        setState((current) => {
          if (current === 'connecting') {
            console.log('[Signaling] WebRTC timeout reached on PC — auto fallback to WS relay');
            return 'ws-fallback';
          }
          return current;
        });
      }, 3500);
    });

    socket.on('peer-disconnected', ({ role: peerRole }: { role: 'pc' | 'mobile' }) => {
      console.log('[Signaling] Peer disconnected:', peerRole);
      clearFallbackTimer();
      setState('waiting');
      callbacksRef.current.onPeerDisconnected?.(peerRole);
    });

    socket.on('session-ended', ({ reason }: { reason: string }) => {
      console.log('[Signaling] Session ended:', reason);
      clearFallbackTimer();
      setState('disconnected');
      callbacksRef.current.onSessionEnded?.(reason);
    });

    socket.on('session-expired', () => {
      setError('Session expired. Please start a new session.');
      clearFallbackTimer();
      setState('error');
    });

    // ── WEBRTC SIGNALING RELAY ──
    socket.on('offer', ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      console.log('[Signaling] Received offer');
      callbacksRef.current.onOffer?.(sdp);
    });

    socket.on('answer', ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      console.log('[Signaling] Received answer');
      callbacksRef.current.onAnswer?.(sdp);
    });

    socket.on('ice-candidate', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      callbacksRef.current.onIceCandidate?.(candidate);
    });

    // ── WS FALLBACK ──
    socket.on('transfer-chunk', (payload: { token: string; chunk: unknown }) => {
      callbacksRef.current.onFallbackChunk?.(payload.chunk);
    });

    return () => {
      clearFallbackTimer();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('session-created');
      socket.off('join-success');
      socket.off('join-error');
      socket.off('code-resolved');
      socket.off('peer-joined');
      socket.off('peer-disconnected');
      socket.off('session-ended');
      socket.off('session-expired');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('transfer-chunk');
      disconnectSocket();
    };
  }, [role, joinToken, clearFallbackTimer]);

  const sendOffer = useCallback((sdp: RTCSessionDescriptionInit) => {
    const token = session?.token || joinToken;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('offer', { token, sdp });
  }, [session, joinToken]);

  const sendAnswer = useCallback((sdp: RTCSessionDescriptionInit) => {
    const token = session?.token || joinToken;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('answer', { token, sdp });
  }, [session, joinToken]);

  const sendIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    const token = session?.token || joinToken;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('ice-candidate', { token, candidate });
  }, [session, joinToken]);

  const endSession = useCallback(() => {
    const token = session?.token || joinToken;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('end-session', { token });
  }, [session, joinToken]);

  const sendFallbackChunk = useCallback((data: unknown) => {
    const token = session?.token || joinToken;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('transfer-chunk', { token, chunk: data });
  }, [session, joinToken]);

  const joinByCode = useCallback((code: string) => {
    if (!socketRef.current || !socketRef.current.connected) {
      // Socket not ready yet — queue it; handleConnect will flush it
      console.log('[Signaling] Socket not ready, queuing join-by-code:', code);
      pendingCodeRef.current = code;
      return;
    }
    setState('connecting');
    console.log('[Signaling] Emitting join-by-code:', code);
    socketRef.current.emit('join-by-code', { shortCode: code });
  }, []);

  return {
    state,
    session,
    error,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    endSession,
    sendFallbackChunk,
    joinByCode,
    markConnected,
    socket: socketRef.current,
  };
}
