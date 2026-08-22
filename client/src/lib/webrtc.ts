/**
 * WebRTC peer connection factory.
 *
 * Responsibilities:
 *  - Create RTCPeerConnection with configurable ICE servers
 *  - Create the file transfer DataChannel (reliable, ordered)
 *  - Handle ICE candidate events
 *  - Provide clean teardown
 *
 * STUN servers: Google public servers (free, works on most networks).
 * TURN servers: Configured via environment variable for restrictive networks
 *               (college firewalls with symmetric NAT).
 */

// ICE server configuration — injected from environment at build time
const ICE_SERVERS: RTCIceServer[] = (() => {
  const servers: RTCIceServer[] = [
    // Public STUN servers — free, good for most home/office networks
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];

  // Optional TURN server for restrictive NAT (e.g., college networks)
  const turnUrl   = import.meta.env.VITE_TURN_URL;
  const turnUser  = import.meta.env.VITE_TURN_USERNAME;
  const turnCred  = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnCred,
    });
    console.log('[WebRTC] TURN server configured:', turnUrl);
  } else {
    console.log('[WebRTC] No TURN server configured. Using STUN only. Peer-to-peer may fail on symmetric NAT.');
  }

  return servers;
})();

export const DATA_CHANNEL_LABEL = 'quicktransfer-file';

export interface WebRTCCallbacks {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onDataChannelOpen: (channel: RTCDataChannel) => void;
  onDataChannelMessage: (event: MessageEvent) => void;
  onDataChannelClose: () => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
}

export class WebRTCPeer {
  public pc: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCCallbacks;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;

    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState);
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.pc.iceConnectionState);
      this.callbacks.onIceConnectionStateChange(this.pc.iceConnectionState);
    };

    // Remote peer may create the data channel (mobile side)
    this.pc.ondatachannel = (event) => {
      console.log('[WebRTC] Received data channel from remote peer');
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers(this.dataChannel);
    };
  }

  /**
   * PC (initiator) creates the DataChannel before offer.
   */
  createDataChannel(): RTCDataChannel {
    const channel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,           // Guarantee order for chunked file transfer
      // No maxRetransmits — we want reliable delivery
    });
    this.dataChannel = channel;
    this.setupDataChannelHandlers(channel);
    return channel;
  }

  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    // Maximize buffer before backpressure
    channel.bufferedAmountLowThreshold = 256 * 1024; // 256 KB

    channel.onopen = () => {
      console.log('[WebRTC] DataChannel open, bufferedAmountLowThreshold =', channel.bufferedAmountLowThreshold);
      this.callbacks.onDataChannelOpen(channel);
    };

    channel.onmessage = (event) => {
      this.callbacks.onDataChannelMessage(event);
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel closed');
      this.callbacks.onDataChannelClose();
    };

    channel.onerror = (err) => {
      console.error('[WebRTC] DataChannel error:', err);
    };
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async setRemoteOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] Failed to add ICE candidate:', err);
    }
  }

  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.pc.close();
    console.log('[WebRTC] Peer connection closed');
  }
}

/** Check if WebRTC is supported in this browser */
export function isWebRTCSupported(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCSessionDescription !== 'undefined' &&
    typeof RTCIceCandidate !== 'undefined'
  );
}
