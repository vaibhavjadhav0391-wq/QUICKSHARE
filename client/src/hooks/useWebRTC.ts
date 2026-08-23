import { useEffect, useRef, useCallback, useState } from 'react';
import { WebRTCPeer, isWebRTCSupported, CandidateType } from '@/lib/webrtc';

interface UseWebRTCOptions {
  isInitiator: boolean; // PC = true, Mobile = false
  enabled: boolean;     // Only start when peer has joined
  onDataChannelOpen: (channel: RTCDataChannel) => void;
  onDataChannelMessage: (event: MessageEvent) => void;
  onDataChannelClose: () => void;
  onConnectionFailed: () => void;
  /** Called to send offer/answer via signaling */
  sendOffer: (sdp: RTCSessionDescriptionInit) => void;
  sendAnswer: (sdp: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (candidate: RTCIceCandidateInit) => void;
}

interface UseWebRTCReturn {
  peer: WebRTCPeer | null;
  connectionState: RTCPeerConnectionState | null;
  iceState: RTCIceConnectionState | null;
  candidateType: CandidateType;
  isSupported: boolean;
  /** Feed incoming signaling messages from the signaling server */
  handleOffer: (sdp: RTCSessionDescriptionInit) => Promise<void>;
  handleAnswer: (sdp: RTCSessionDescriptionInit) => Promise<void>;
  handleIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  closePeer: () => void;
}

/**
 * useWebRTC — manages the RTCPeerConnection lifecycle and candidate pair monitoring.
 */
export function useWebRTC(options: UseWebRTCOptions): UseWebRTCReturn {
  const {
    isInitiator,
    enabled,
    onDataChannelOpen,
    onDataChannelMessage,
    onDataChannelClose,
    onConnectionFailed,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
  } = options;

  const peerRef = useRef<WebRTCPeer | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [iceState, setIceState] = useState<RTCIceConnectionState | null>(null);
  const [candidateType, setCandidateType] = useState<CandidateType>(null);
  const isSupported = isWebRTCSupported();

  // ── INITIALIZE PEER ──
  useEffect(() => {
    if (!enabled || !isSupported) return;

    console.log('[useWebRTC Diagnostic] Initializing peer, isInitiator =', isInitiator);

    const peer = new WebRTCPeer({
      onIceCandidate: (candidate) => {
        sendIceCandidate(candidate);
      },
      onDataChannelOpen: (channel) => {
        console.log('[useWebRTC Diagnostic] DataChannel opened');
        onDataChannelOpen(channel);
        peer.checkSelectedCandidatePair();
      },
      onDataChannelMessage: (event) => {
        onDataChannelMessage(event);
      },
      onDataChannelClose: () => {
        console.log('[useWebRTC Diagnostic] DataChannel closed');
        onDataChannelClose();
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
        if (state === 'failed' || state === 'closed') {
          console.warn(`[useWebRTC Diagnostic] Peer connection state '${state}' -> triggering fallback.`);
          onConnectionFailed();
        }
      },
      onIceConnectionStateChange: (state) => {
        setIceState(state);
        if (state === 'failed') {
          console.warn('[useWebRTC Diagnostic] ICE connection state FAILED -> triggering fallback.');
          onConnectionFailed();
        }
      },
      onCandidatePairSelected: (pair) => {
        console.log(`[useWebRTC Diagnostic] Active candidate type set to: ${pair.type}`);
        setCandidateType(pair.type);
      },
    });

    peerRef.current = peer;

    // PC initiates the offer
    if (isInitiator) {
      peer.createDataChannel();
      peer.createOffer()
        .then((offer) => {
          console.log('[useWebRTC Diagnostic] Offer created and sending via signaling');
          sendOffer(offer);
        })
        .catch((err) => {
          console.error('[useWebRTC Diagnostic] Failed to create offer:', err);
          onConnectionFailed();
        });
    }

    return () => {
      peer.close();
      peerRef.current = null;
      setCandidateType(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isInitiator, isSupported]);

  // Periodic polling of getStats() while connected to catch any candidate re-nominations
  useEffect(() => {
    if (!enabled || !peerRef.current) return;
    const interval = setInterval(() => {
      if (peerRef.current && (iceState === 'connected' || iceState === 'completed')) {
        peerRef.current.checkSelectedCandidatePair();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [enabled, iceState]);

  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const handleOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const peer = peerRef.current;
    if (!peer) {
      console.log('[useWebRTC Diagnostic] handleOffer: queuing offer until peer ready');
      pendingOfferRef.current = sdp;
      return;
    }
    console.log('[useWebRTC Diagnostic] Handling SDP Offer');
    try {
      const answer = await peer.setRemoteOffer(sdp);
      sendAnswer(answer);
    } catch (err) {
      console.error('[useWebRTC Diagnostic] handleOffer error:', err);
      onConnectionFailed();
    }
  }, [sendAnswer, onConnectionFailed]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const peer = peerRef.current;
    if (!peer) return;
    console.log('[useWebRTC Diagnostic] Handling SDP Answer');
    try {
      await peer.setRemoteAnswer(sdp);
    } catch (err) {
      console.error('[useWebRTC Diagnostic] handleAnswer error:', err);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const peer = peerRef.current;
    if (!peer) {
      pendingCandidatesRef.current.push(candidate);
      return;
    }
    await peer.addIceCandidate(candidate);
  }, []);

  // Process queued offer/candidates once peer ref is assigned
  useEffect(() => {
    if (peerRef.current && pendingOfferRef.current) {
      const offer = pendingOfferRef.current;
      pendingOfferRef.current = null;
      handleOffer(offer);
    }
    if (peerRef.current && pendingCandidatesRef.current.length > 0) {
      const candidates = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];
      candidates.forEach((c) => peerRef.current?.addIceCandidate(c));
    }
  });

  const closePeer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setConnectionState(null);
    setIceState(null);
    setCandidateType(null);
  }, []);

  return {
    peer: peerRef.current,
    connectionState,
    iceState,
    candidateType,
    isSupported,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeer,
  };
}
