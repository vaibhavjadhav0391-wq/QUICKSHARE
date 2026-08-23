// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectionState =
  | 'idle'
  | 'creating'
  | 'waiting'      // PC waiting for mobile to join
  | 'connecting'   // WebRTC handshaking
  | 'connected'    // P2P DataChannel open
  | 'ws-fallback'  // Connected via WS relay (no WebRTC)
  | 'disconnected'
  | 'error';

export type DeviceRole = 'pc' | 'mobile';

export interface SessionInfo {
  token: string;
  shortCode: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE TRANSFER
// ─────────────────────────────────────────────────────────────────────────────

export type TransferDirection = 'send' | 'receive';
export type TransferStatus =
  | 'queued'
  | 'transferring'
  | 'verifying'    // sender waiting for receiver ACK
  | 'paused'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface FileTransferItem {
  id: string;
  fileId?: string;
  name: string;
  size: number;
  mimeType: string;
  direction: TransferDirection;
  status: TransferStatus;
  /** 0–100 */
  progress: number;
  /** Bytes transferred */
  transferred: number;
  /** Bytes per second */
  speed: number;
  /** Seconds remaining, -1 = unknown */
  eta: number;
  /** Error message if status === 'error' */
  error?: string;
  /** URL for completed received file (blob URL) */
  downloadUrl?: string;
  startedAt?: number;
  completedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBRTC DATACHANNEL PROTOCOL MESSAGES (sent as JSON strings)
// ─────────────────────────────────────────────────────────────────────────────

export interface DCMessageFileStart {
  type: 'file-start';
  transferId: string;
  fileId?: string;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
}

export interface DCMessageChunkMeta {
  type: 'chunk-meta';
  transferId: string;
  chunkIndex: number;
}

export interface DCMessageFileEnd {
  type: 'file-end';
  transferId: string;
  fileId?: string;
}

export interface DCMessageCancel {
  type: 'cancel';
  transferId: string;
}

export interface DCMessageAck {
  type: 'ack';
  transferId: string;
}

export interface DCMessageFileReceived {
  type: 'file-received';
  transferId: string;
  fileId?: string;
  receivedBytes: number;
  success: boolean;
}

export interface DCMessageFileError {
  type: 'file-error';
  transferId: string;
  fileId?: string;
  reason: string;
}

export type DCMessage =
  | DCMessageFileStart
  | DCMessageChunkMeta
  | DCMessageFileEnd
  | DCMessageCancel
  | DCMessageAck
  | DCMessageFileReceived
  | DCMessageFileError;

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET SIGNALING
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalingEvents {
  // Emitted by client
  'create-session': () => void;
  'join-session': (data: { token: string }) => void;
  'join-by-code': (data: { shortCode: string }) => void;
  'offer': (data: { token: string; sdp: RTCSessionDescriptionInit }) => void;
  'answer': (data: { token: string; sdp: RTCSessionDescriptionInit }) => void;
  'ice-candidate': (data: { token: string; candidate: RTCIceCandidateInit }) => void;
  'end-session': (data: { token: string }) => void;
  'transfer-chunk': (data: WsFallbackChunk) => void;
  'transfer-cancel': (data: { token: string }) => void;

  // Received by client
  'session-created': (data: { token: string; shortCode: string }) => void;
  'join-success': (data: { token: string }) => void;
  'join-error': (data: { message: string }) => void;
  'code-resolved': (data: { token: string }) => void;
  'peer-joined': (data: { peerId: string }) => void;
  'peer-disconnected': (data: { role: 'pc' | 'mobile' }) => void;
  'transfer-cancelled': (data?: { reason: string }) => void;
  'session-ended': (data: { reason: string }) => void;
  'session-expired': () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// WS FALLBACK
// ─────────────────────────────────────────────────────────────────────────────

export interface WsFallbackChunk {
  token: string;
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunk: ArrayBuffer;
  /** Only in first chunk */
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}
