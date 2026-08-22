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
}

interface UseSignalingReturn {
  state: ConnectionState;
  session: SessionInfo | null;
  error: string | null;
  /** Send WebRTC offer to peer */
  sendOffer: (sdp: RTCSessionDescriptionInit) => void;
  /** Send WebRTC answer to peer */
  sendAnswer: (sdp: RTCSessionDescriptionInit) => void;
  /** Send ICE candidate to peer */
  sendIceCandidate: (candidate: RTCIceCandidateInit) => void;
  /** End the session (PC only) */
  endSession: () => void;
  /** Send a WS fallback file chunk */
  sendFallbackChunk: (data: unknown) => void;
  /** Initiate join by short code */
  joinByCode: (code: string) => void;
  /** Mark the connection as fully established via WebRTC or WS relay */
  markConnected: (via: 'webrtc' | 'ws') => void;
  socket: Socket | null;
}

/**
 * useSignaling — manages the Socket.IO connection lifecycle and session state.
 *
 * - PC role: automatically creates a session on mount
 * - Mobile role: joins an existing session given a token or short code
 */
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
  } = options;

  const [state, setState] = useState<ConnectionState>('idle');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!role) return;

    const socket = connectSocket();
    socketRef.current = socket;
    setState('creating');

    // ── SOCKET LIFECYCLE ──
    socket.on('connect', () => {
      console.log('[Signaling] Socket connected:', socket.id);
      setError(null);

      if (role === 'pc') {
        socket.emit('create-session');
      } else if (role === 'mobile' && joinToken) {
        socket.emit('join-session', { token: joinToken });
        setState('connecting');
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Signaling] Socket disconnected:', reason);
      setState('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[Signaling] Connection error:', err.message);
      setError('Unable to connect to server. Please check your internet connection.');
      setState('error');
    });

    // ── SESSION EVENTS ──
    socket.on('session-created', ({ token, shortCode }: { token: string; shortCode: string }) => {
      console.log('[Signaling] Session created:', token.slice(0, 8));
      setSession({ token, shortCode });
      setState('waiting');
    });

    socket.on('join-success', () => {
      console.log('[Signaling] Join success');
      setState('connecting');
    });

    socket.on('join-error', ({ message }: { message: string }) => {
      setError(message);
      setState('error');
    });

    socket.on('code-resolved', ({ token }: { token: string }) => {
      socket.emit('join-session', { token });
    });

    // ── PEER EVENTS ──
    socket.on('peer-joined', () => {
      console.log('[Signaling] Peer joined');
      setState('connecting');
      onPeerJoined?.();
    });

    socket.on('peer-disconnected', ({ role: peerRole }: { role: 'pc' | 'mobile' }) => {
      console.log('[Signaling] Peer disconnected:', peerRole);
      setState('waiting');
      onPeerDisconnected?.(peerRole);
    });

    socket.on('session-ended', ({ reason }: { reason: string }) => {
      console.log('[Signaling] Session ended:', reason);
      setState('disconnected');
      onSessionEnded?.(reason);
    });

    socket.on('session-expired', () => {
      setError('Session expired. Please start a new session.');
      setState('error');
    });

    // ── WEBRTC SIGNALING RELAY ──
    socket.on('offer', ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      onOffer?.(sdp);
    });

    socket.on('answer', ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      onAnswer?.(sdp);
    });

    socket.on('ice-candidate', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      onIceCandidate?.(candidate);
    });

    // ── WS FALLBACK ──
    socket.on('transfer-chunk', (data: unknown) => {
      onFallbackChunk?.(data);
    });

    socket.on('transfer-cancel', () => {
      // Handled by file transfer hook
    });

    return () => {
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
      socket.off('transfer-cancel');
      disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, joinToken]);

  // ── SET STATE TO CONNECTED (called by PCPage/MobilePage when DataChannel opens) ──
  const markConnected = useCallback((via: 'webrtc' | 'ws') => {
    setState(via === 'webrtc' ? 'connected' : 'ws-fallback');
  }, []);

  const sendOffer = useCallback((sdp: RTCSessionDescriptionInit) => {
    const token = session?.token;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('offer', { token, sdp });
  }, [session]);

  const sendAnswer = useCallback((sdp: RTCSessionDescriptionInit) => {
    const token = session?.token;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('answer', { token, sdp });
  }, [session]);

  const sendIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    const token = session?.token;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('ice-candidate', { token, candidate });
  }, [session]);

  const endSession = useCallback(() => {
    const token = session?.token;
    if (!token || !socketRef.current) return;
    socketRef.current.emit('end-session', { token });
  }, [session]);

  const sendFallbackChunk = useCallback((data: unknown) => {
    if (!socketRef.current) return;
    socketRef.current.emit('transfer-chunk', data);
  }, []);

  const joinByCode = useCallback((code: string) => {
    if (!socketRef.current) return;
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

/** @deprecated Use markConnected from useSignaling return value */
export function markSignalingConnected(_socket: Socket | null, _via: 'webrtc' | 'ws'): void {
  console.warn('markSignalingConnected is deprecated; use markConnected from useSignaling');
}
