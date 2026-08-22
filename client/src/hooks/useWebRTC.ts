import { useEffect, useRef, useCallback, useState } from 'react';
import { WebRTCPeer, isWebRTCSupported } from '@/lib/webrtc';

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
  isSupported: boolean;
  /** Feed incoming signaling messages from the signaling server */
  handleOffer: (sdp: RTCSessionDescriptionInit) => Promise<void>;
  handleAnswer: (sdp: RTCSessionDescriptionInit) => Promise<void>;
  handleIceCandidate: (candidate: RTCIceCandidateInit) => Promise<void>;
  closePeer: () => void;
}

/**
 * useWebRTC — manages the RTCPeerConnection lifecycle.
 *
 * Initiator (PC):
 *   1. On enabled=true → createDataChannel() → createOffer() → sendOffer()
 *   2. Wait for answer → setRemoteAnswer()
 *   3. Exchange ICE candidates
 *   4. DataChannel opens → onDataChannelOpen()
 *
 * Responder (Mobile):
 *   1. On enabled=true → wait for offer
 *   2. handleOffer() → setRemoteOffer() → sendAnswer()
 *   3. Exchange ICE candidates
 *   4. DataChannel received via pc.ondatachannel → onDataChannelOpen()
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
  const isSupported = isWebRTCSupported();

  // ── INITIALIZE PEER ──
  useEffect(() => {
    if (!enabled || !isSupported) return;

    console.log('[useWebRTC] Initializing peer, isInitiator =', isInitiator);

    const peer = new WebRTCPeer({
      onIceCandidate: (candidate) => {
        sendIceCandidate(candidate);
      },
      onDataChannelOpen: (channel) => {
        console.log('[useWebRTC] DataChannel opened');
        onDataChannelOpen(channel);
      },
      onDataChannelMessage: (event) => {
        onDataChannelMessage(event);
      },
      onDataChannelClose: () => {
        console.log('[useWebRTC] DataChannel closed');
        onDataChannelClose();
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
        if (state === 'failed' || state === 'closed') {
          onConnectionFailed();
        }
      },
      onIceConnectionStateChange: (state) => {
        setIceState(state);
        if (state === 'failed') {
          console.warn('[useWebRTC] ICE connection failed — may need TURN server');
          onConnectionFailed();
        }
      },
    });

    peerRef.current = peer;

    // PC initiates the offer
    if (isInitiator) {
      peer.createDataChannel();
      peer.createOffer()
        .then((offer) => {
          console.log('[useWebRTC] Sending offer');
          sendOffer(offer);
        })
        .catch((err) => {
          console.error('[useWebRTC] Failed to create offer:', err);
          onConnectionFailed();
        });
    }

    return () => {
      peer.close();
      peerRef.current = null;
    };
  // Note: callbacks are stable refs; only re-create peer when enabled/isInitiator changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isInitiator, isSupported]);

  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const handleOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const peer = peerRef.current;
    if (!peer) {
      console.log('[useWebRTC] handleOffer: queuing offer until peer ready');
      pendingOfferRef.current = sdp;
      return;
    }
    console.log('[useWebRTC] Handling offer, creating answer');
    try {
      const answer = await peer.setRemoteOffer(sdp);
      sendAnswer(answer);
    } catch (err) {
      console.error('[useWebRTC] handleOffer error:', err);
      onConnectionFailed();
    }
  }, [sendAnswer, onConnectionFailed]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const peer = peerRef.current;
    if (!peer) return;
    console.log('[useWebRTC] Handling answer');
    try {
      await peer.setRemoteAnswer(sdp);
    } catch (err) {
      console.error('[useWebRTC] handleAnswer error:', err);
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
  }, []);

  return {
    peer: peerRef.current,
    connectionState,
    iceState,
    isSupported,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeer,
  };
}
