import { useState, useRef, useCallback } from 'react';
import {
  fileToChunks,
  totalChunksFor,
  ChunkAccumulator,
  downloadBlob,
} from '@/lib/fileChunker';
import type { FileTransferItem, DCMessage } from '@/types';

// Max bytes buffered in DataChannel before pausing sending (128 KB)
const MAX_BUFFER_BYTES = 128 * 1024;
const LOW_WATERMARK_BYTES = 64 * 1024;

interface UseFileTransferReturn {
  transfers: FileTransferItem[];
  /** Send a file via the DataChannel or WS Fallback */
  sendFile: (file: File) => Promise<void>;
  /** Called when a DataChannel or WS message arrives (JSON or ArrayBuffer) */
  handleDataChannelMessage: (event: MessageEvent) => void;
  cancelTransfer: (transferId: string) => void;
  /** Clear all transfer state and accumulators */
  clearTransfers: () => void;
}

/**
 * useFileTransfer — manages robust file chunking, streaming, receiver validation,
 * and sender ACK completion.
 */
export function useFileTransfer(
  dataChannelRef: React.RefObject<RTCDataChannel | null>,
  sendFallbackChunk?: (data: unknown) => void,
  useFallback?: boolean
): UseFileTransferReturn {
  const [transfers, setTransfers] = useState<FileTransferItem[]>([]);

  // Tracks which chunk index we're about to receive (set by 'chunk-meta')
  const pendingChunkIndex = useRef<number>(-1);
  const pendingTransferId = useRef<string | null>(null);
  // Active accumulators: transferId → ChunkAccumulator
  const accumulators = useRef<Map<string, ChunkAccumulator>>(new Map());
  // Cancellation flags for sends
  const cancelFlags = useRef<Set<string>>(new Set());

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  const updateTransfer = useCallback((id: string, patch: Partial<FileTransferItem>) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  }, []);

  function sendJSON(msg: DCMessage): void {
    if (useFallback && sendFallbackChunk) {
      sendFallbackChunk(msg);
      return;
    }
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== 'open') {
      // Fall back to signaling if data channel is closed
      if (sendFallbackChunk) {
        sendFallbackChunk(msg);
      }
      return;
    }
    ch.send(JSON.stringify(msg));
  }

  /**
   * Wait for DataChannel buffer to drain below low watermark threshold.
   */
  function waitForBuffer(channel: RTCDataChannel): Promise<void> {
    if (channel.bufferedAmount <= LOW_WATERMARK_BYTES) return Promise.resolve();
    return new Promise((resolve) => {
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          channel.removeEventListener('bufferedamountlow', handler);
          clearInterval(pollTimer);
          resolve();
        }
      };

      const handler = () => {
        if (channel.bufferedAmount <= LOW_WATERMARK_BYTES) {
          finish();
        }
      };

      channel.addEventListener('bufferedamountlow', handler);

      // Fallback poll timer in case bufferedamountlow event doesn't trigger
      const pollTimer = setInterval(() => {
        if (channel.bufferedAmount <= LOW_WATERMARK_BYTES) {
          finish();
        }
      }, 15);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND
  // ─────────────────────────────────────────────────────────────────────────

  const sendFile = useCallback(async (file: File) => {
    const ch = dataChannelRef.current;
    if (!useFallback) {
      if (!ch || ch.readyState !== 'open') {
        console.error(`[TRANSFER] Cannot send file: DataChannel not open (state: ${ch?.readyState || 'null'})`);
        return;
      }
    }

    const transferId = uuidv4();
    const fileId = uuidv4();
    const totalChunks = totalChunksFor(file.size);

    console.log(`[TRANSFER] sender file-start: ${file.name} (${file.size} bytes, ${totalChunks} chunks), mode=${useFallback ? 'WebSocket Relay' : 'WebRTC DataChannel'}`);

    const item: FileTransferItem = {
      id: transferId,
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      direction: 'send',
      status: 'transferring',
      progress: 0,
      transferred: 0,
      speed: 0,
      eta: -1,
      startedAt: Date.now(),
    };

    setTransfers((prev) => [...prev, item]);

    // Announce file metadata to receiver
    sendJSON({
      type: 'file-start',
      transferId,
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
    });

    let chunkIndex = 0;
    let bytesSent = 0;
    let lastSpeedCheck = Date.now();
    let bytesAtLastCheck = 0;

    for await (const chunk of fileToChunks(file)) {
      // Check cancellation
      if (cancelFlags.current.has(transferId)) {
        sendJSON({ type: 'cancel', transferId });
        updateTransfer(transferId, { status: 'cancelled' });
        cancelFlags.current.delete(transferId);
        return;
      }

      // Wait for DataChannel buffer backpressure
      if (!useFallback && ch) {
        if (ch.bufferedAmount > MAX_BUFFER_BYTES) {
          await waitForBuffer(ch);
        }
      } else if (useFallback) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Send chunk metadata
      sendJSON({ type: 'chunk-meta', transferId, chunkIndex });

      // Send raw binary chunk
      if (useFallback && sendFallbackChunk) {
        sendFallbackChunk(chunk);
      } else if (ch && ch.readyState === 'open') {
        ch.send(chunk);
      } else {
        console.warn(`[TRANSFER] Aborting chunk ${chunkIndex} - DataChannel closed unexpectedly`);
        updateTransfer(transferId, { status: 'error', error: 'DataChannel disconnected during transfer.' });
        return;
      }

      bytesSent += chunk.byteLength;
      chunkIndex++;

      // Update progress every ~250ms
      const now = Date.now();
      const elapsed = (now - lastSpeedCheck) / 1000;
      if (elapsed >= 0.25 || chunkIndex === totalChunks) {
        const bytesInWindow = bytesSent - bytesAtLastCheck;
        const speed = elapsed > 0 ? bytesInWindow / elapsed : 0;
        const remaining = file.size - bytesSent;
        const eta = speed > 0 ? remaining / speed : -1;

        updateTransfer(transferId, {
          progress: Math.min(99, Math.round((bytesSent / file.size) * 100)),
          transferred: bytesSent,
          speed,
          eta,
        });

        lastSpeedCheck = now;
        bytesAtLastCheck = bytesSent;
      }
    }

    // Signal end of file transmission to receiver
    console.log(`[TRANSFER] sender file-end: sent all ${totalChunks} chunks for ${file.name}. Waiting for receiver ACK...`);
    sendJSON({ type: 'file-end', transferId, fileId });

    // Move sender to 'verifying' state — WAITING for receiver acknowledgement!
    updateTransfer(transferId, {
      status: 'verifying',
      progress: 99,
      transferred: file.size,
      speed: 0,
      eta: -1,
    });

    // Safety timeout: if receiver ACK does not arrive within 15 seconds, complete anyway
    setTimeout(() => {
      setTransfers((currentTransfers) =>
        currentTransfers.map((t) => {
          if (t.id === transferId && t.status === 'verifying') {
            console.log(`[TRANSFER] Safety timeout reached for ${file.name} — completing sender side`);
            return {
              ...t,
              status: 'complete',
              progress: 100,
              transferred: file.size,
              speed: 0,
              eta: 0,
              completedAt: Date.now(),
            };
          }
          return t;
        })
      );
    }, 15000);
  }, [dataChannelRef, updateTransfer, useFallback, sendFallbackChunk]);

  // ─────────────────────────────────────────────────────────────────────────
  // RECEIVE & ACK MESSAGES
  // ─────────────────────────────────────────────────────────────────────────

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    const { data } = event;

    const chunkBuffer = toArrayBuffer(data);

    // Binary file chunk data (ArrayBuffer / Uint8Array / Buffer / Socket.IO payload)
    if (chunkBuffer) {
      const tid = pendingTransferId.current;
      const idx = pendingChunkIndex.current;
      if (tid === null || idx === -1) return;

      const acc = accumulators.current.get(tid);
      if (!acc) return;

      const progress = acc.addChunk(idx, chunkBuffer);
      const info = acc.getInfo();

      setTransfers((prev) =>
        prev.map((t) => {
          if (t.id !== tid) return t;
          const now = Date.now();
          const elapsed = now - (t.startedAt ?? now);
          const speed = elapsed > 0 ? (acc.bytesReceived / elapsed) * 1000 : 0;
          const remaining = info.size - acc.bytesReceived;
          const eta = speed > 0 ? remaining / speed : -1;
          return {
            ...t,
            status: 'transferring',
            progress,
            transferred: acc.bytesReceived,
            speed,
            eta,
          };
        })
      );

      pendingChunkIndex.current = -1;
      return;
    }

    // JSON string = control message
    if (typeof data === 'string') {
      let msg: DCMessage;
      try {
        msg = JSON.parse(data) as DCMessage;
      } catch {
        console.warn('[TRANSFER] Non-JSON string message received');
        return;
      }

      switch (msg.type) {
        case 'file-start': {
          console.log(`[TRANSFER] receiver file-start: ${msg.name} (${msg.size} bytes, ${msg.totalChunks} chunks)`);
          const acc = new ChunkAccumulator({
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
            totalChunks: msg.totalChunks,
          });
          accumulators.current.set(msg.transferId, acc);

          const item: FileTransferItem = {
            id: msg.transferId,
            fileId: msg.fileId,
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
            direction: 'receive',
            status: 'transferring',
            progress: 0,
            transferred: 0,
            speed: 0,
            eta: -1,
            startedAt: Date.now(),
          };

          // Receiver state transition: Immediately add item to transfers state
          // so UI leaves "Waiting for sender..." state right away.
          setTransfers((prev) => {
            const allFinished = prev.length > 0 && prev.every(
              (t) => t.status === 'complete' || t.status === 'cancelled' || t.status === 'error'
            );
            if (allFinished) {
              return [item];
            }
            const exists = prev.some((t) => t.id === item.id);
            if (exists) {
              return prev.map((t) => (t.id === item.id ? item : t));
            }
            return [...prev, item];
          });
          break;
        }

        case 'chunk-meta': {
          pendingTransferId.current = msg.transferId;
          pendingChunkIndex.current = msg.chunkIndex;
          break;
        }

        case 'file-end': {
          console.log(`[TRANSFER] file-end: validating received bytes for ${msg.transferId}`);
          const acc = accumulators.current.get(msg.transferId);
          if (!acc) {
            console.warn(`[TRANSFER] file-end: accumulator not found for ${msg.transferId}`);
            break;
          }

          try {
            const info = acc.getInfo();
            const receivedBytes = acc.bytesReceived;
            console.log(`[TRANSFER] receiver bytes: ${receivedBytes} / ${info.size}`);

            if (receivedBytes === info.size || acc.isComplete()) {
              const blob = acc.assemble();
              const url = downloadBlob(blob, info.name);

              updateTransfer(msg.transferId, {
                status: 'complete',
                progress: 100,
                transferred: info.size,
                speed: 0,
                eta: 0,
                completedAt: Date.now(),
                downloadUrl: url,
              });

              console.log(`[TRANSFER] receiver ACK sent: file ${info.name} completely assembled`);

              // Send file-received ACK back to sender
              sendJSON({
                type: 'file-received',
                transferId: msg.transferId,
                fileId: msg.fileId || msg.transferId,
                receivedBytes: info.size,
                success: true,
              });
            } else {
              console.error(`[TRANSFER] Size mismatch on receiver: got ${receivedBytes}, expected ${info.size}`);
              updateTransfer(msg.transferId, { status: 'error', error: 'File size mismatch.' });

              sendJSON({
                type: 'file-error',
                transferId: msg.transferId,
                fileId: msg.fileId || msg.transferId,
                reason: 'SIZE_MISMATCH',
              });
            }
          } catch (err) {
            console.error('[TRANSFER] Receiver assembly error:', err);
            updateTransfer(msg.transferId, { status: 'error', error: 'File reassembly failed.' });

            sendJSON({
              type: 'file-error',
              transferId: msg.transferId,
              fileId: msg.fileId || msg.transferId,
              reason: 'REASSEMBLY_FAILED',
            });
          }

          accumulators.current.delete(msg.transferId);
          break;
        }

        case 'file-received': {
          console.log(`[TRANSFER] sender ACK received for transfer ${msg.transferId} (success=${msg.success})`);
          updateTransfer(msg.transferId, {
            status: 'complete',
            progress: 100,
            speed: 0,
            eta: 0,
            completedAt: Date.now(),
          });
          console.log(`[TRANSFER] final complete for transfer ${msg.transferId}`);
          break;
        }

        case 'file-error': {
          console.warn(`[TRANSFER] sender received error ACK for transfer ${msg.transferId}: ${msg.reason}`);
          updateTransfer(msg.transferId, {
            status: 'error',
            error: `Receiver reported error: ${msg.reason}`,
          });
          break;
        }

        case 'cancel': {
          accumulators.current.delete(msg.transferId);
          updateTransfer(msg.transferId, { status: 'cancelled' });
          break;
        }
      }
    }
  }, [updateTransfer, useFallback, sendFallbackChunk, dataChannelRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // CANCEL & RESET
  // ─────────────────────────────────────────────────────────────────────────

  const cancelTransfer = useCallback((transferId: string) => {
    cancelFlags.current.add(transferId);
  }, []);

  const clearTransfers = useCallback(() => {
    console.log('[TRANSFER] Clearing all file history and accumulators');
    setTransfers([]);
    accumulators.current.clear();
    cancelFlags.current.clear();
    pendingChunkIndex.current = -1;
    pendingTransferId.current = null;
  }, []);

  return { transfers, sendFile, handleDataChannelMessage, cancelTransfer, clearTransfers };
}

// Uses crypto.randomUUID() for zero-dependency UUID generation
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Converts any binary format (ArrayBuffer, Uint8Array, Buffer, Socket.IO Buffer) to ArrayBuffer */
function toArrayBuffer(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    const v = data as ArrayBufferView;
    const buf = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Socket.IO Buffer fallback: { type: 'Buffer', data: number[] }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return new Uint8Array(obj.data as number[]).buffer as ArrayBuffer;
    }
    // Object wrapping buffer property
    if (obj.buffer instanceof ArrayBuffer) {
      const b = obj.buffer as ArrayBuffer;
      const offset = (obj.byteOffset as number) || 0;
      const length = (obj.byteLength as number) || b.byteLength;
      return b.slice(offset, offset + length);
    }
  }
  return null;
}
