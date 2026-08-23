/**
 * WebRTC peer connection factory and candidate pair diagnostic tools.
 *
 * Responsibilities:
 *  - Create RTCPeerConnection with STUN + TURN servers
 *  - Format TURN URLs for UDP, TCP, and TLS transports
 *  - Candidate queuing before setRemoteDescription
 *  - Active candidate pair analysis via getStats() (host vs srflx vs relay)
 *  - Reliable chunked DataChannel management
 */

export type CandidateType = 'host' | 'srflx' | 'prflx' | 'relay' | null;

export function buildIceServers(): RTCIceServer[] {
  const stunServers: RTCIceServer = {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
    ],
  };

  const servers: RTCIceServer[] = [stunServers];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    const cleanUrl = turnUrl.replace(/^turn(s)?:/, '').replace(/\?.*$/, '').replace(/:.*/, '');
    const turnUrls = [
      `turn:${cleanUrl}:3478?transport=udp`,
      `turn:${cleanUrl}:3478?transport=tcp`,
      `turns:${cleanUrl}:5349?transport=tcp`,
      `turns:${cleanUrl}:443?transport=tcp`,
    ];
    if (turnUrl.includes(':')) {
      turnUrls.unshift(turnUrl);
    }

    servers.push({
      urls: Array.from(new Set(turnUrls)),
      username: turnUser,
      credential: turnCred,
    });
    console.log('[WebRTC] Custom TURN server configured:', turnUrls);
  } else {
    // OpenRelay public fallback TURN servers for zero-config WebRTC relay
    servers.push({
      urls: [
        'turn:openrelay.metered.ca:80?transport=udp',
        'turn:openrelay.metered.ca:80?transport=tcp',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
    console.log('[WebRTC] Default OpenRelay fallback TURN servers configured.');
  }

  return servers;
}

export const DATA_CHANNEL_LABEL = 'quicktransfer-file';

export interface WebRTCCallbacks {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onDataChannelOpen: (channel: RTCDataChannel) => void;
  onDataChannelMessage: (event: MessageEvent) => void;
  onDataChannelClose: () => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
  onCandidatePairSelected?: (pair: { type: CandidateType; localType: CandidateType; remoteType: CandidateType }) => void;
}

export class WebRTCPeer {
  public pc: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;

    const iceServers = buildIceServers();

    this.pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all', // Attempt direct P2P first, fall back to TURN relay
    });

    console.log('[WebRTC Diagnostic] RTCPeerConnection created with iceServers:', iceServers);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const cand = event.candidate;
        console.log(`[WebRTC Diagnostic] Local ICE candidate gathered: type=${cand.type}, protocol=${cand.protocol}, address=${cand.address}:${cand.port}`);
        this.callbacks.onIceCandidate(cand.toJSON());
      } else {
        console.log('[WebRTC Diagnostic] Local ICE candidate gathering complete.');
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[WebRTC Diagnostic] ICE gathering state:', this.pc.iceGatheringState);
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC Diagnostic] Peer Connection state:', this.pc.connectionState);
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        this.checkSelectedCandidatePair();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC Diagnostic] ICE Connection state:', this.pc.iceConnectionState);
      this.callbacks.onIceConnectionStateChange(this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.checkSelectedCandidatePair();
      }
    };

    // Remote peer creates the data channel
    this.pc.ondatachannel = (event) => {
      console.log('[WebRTC Diagnostic] Received DataChannel from remote peer:', event.channel.label);
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers(this.dataChannel);
    };
  }

  /**
   * PC (initiator) creates the DataChannel before offer.
   */
  createDataChannel(): RTCDataChannel {
    console.log('[WebRTC Diagnostic] Creating DataChannel:', DATA_CHANNEL_LABEL);
    const channel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true, // Reliable ordered delivery for chunked file transfer
    });
    this.dataChannel = channel;
    this.setupDataChannelHandlers(channel);
    return channel;
  }

  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 64 * 1024; // 64 KB low water mark

    channel.onopen = () => {
      console.log(`[WebRTC Diagnostic] DataChannel OPEN (label=${channel.label}, id=${channel.id}, bufferedAmountLowThreshold=${channel.bufferedAmountLowThreshold})`);
      this.callbacks.onDataChannelOpen(channel);
    };

    channel.onmessage = (event) => {
      this.callbacks.onDataChannelMessage(event);
    };

    channel.onclose = () => {
      console.log('[WebRTC Diagnostic] DataChannel CLOSED');
      this.callbacks.onDataChannelClose();
    };

    channel.onerror = (err) => {
      console.error('[WebRTC Diagnostic] DataChannel ERROR:', err);
    };
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    console.log('[WebRTC Diagnostic] Local SDP Offer created');
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async setRemoteOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    console.log('[WebRTC Diagnostic] Setting Remote SDP Offer');
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.drainPendingCandidates();
    const answer = await this.pc.createAnswer();
    console.log('[WebRTC Diagnostic] Local SDP Answer created');
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async setRemoteAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    console.log('[WebRTC Diagnostic] Setting Remote SDP Answer');
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.drainPendingCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc.remoteDescription) {
      console.log('[WebRTC Diagnostic] Remote description not set yet — queuing incoming ICE candidate');
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      console.log('[WebRTC Diagnostic] Adding Remote ICE candidate:', candidate.candidate?.slice(0, 45) + '...');
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC Diagnostic] Failed to add ICE candidate:', err);
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (this.pendingCandidates.length === 0) return;
    console.log(`[WebRTC Diagnostic] Draining ${this.pendingCandidates.length} pending ICE candidates...`);
    const list = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const cand of list) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[WebRTC Diagnostic] Failed to add pending ICE candidate:', err);
      }
    }
  }

  /**
   * Inspect getStats() to verify whether active connection is P2P (host/srflx) or TURN relay.
   */
  async checkSelectedCandidatePair(): Promise<{
    type: CandidateType;
    localType: CandidateType;
    remoteType: CandidateType;
  }> {
    try {
      const stats = await this.pc.getStats();
      let activePair: Record<string, unknown> | null = null;
      const candidates = new Map<string, Record<string, unknown>>();

      stats.forEach((report) => {
        if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
          candidates.set(report.id, report as Record<string, unknown>);
        }
        if (report.type === 'candidate-pair') {
          const r = report as Record<string, unknown>;
          if (r.nominated || r.selected || r.state === 'succeeded') {
            if (!activePair || (Number(r.bytesSent || 0) > Number(activePair.bytesSent || 0))) {
              activePair = r;
            }
          }
        }
      });

      if (activePair) {
        const localCandId = activePair['localCandidateId'] as string;
        const remoteCandId = activePair['remoteCandidateId'] as string;
        const local = candidates.get(localCandId);
        const remote = candidates.get(remoteCandId);

        const localType = (local?.candidateType as CandidateType) || null;
        const remoteType = (remote?.candidateType as CandidateType) || null;

        const isRelayPair = localType === 'relay' || remoteType === 'relay';
        const finalType: CandidateType = isRelayPair ? 'relay' : (localType || 'host');

        console.log(`[WebRTC Diagnostic] Active Candidate Pair: Local[${localType}] <-> Remote[${remoteType}] => Selected Type: ${finalType}`);

        const result = { type: finalType, localType, remoteType };
        this.callbacks.onCandidatePairSelected?.(result);
        return result;
      }
    } catch (err) {
      console.warn('[WebRTC Diagnostic] Failed to check candidate pair stats:', err);
    }
    return { type: null, localType: null, remoteType: null };
  }

  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.pc.close();
    console.log('[WebRTC Diagnostic] Peer connection closed');
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
