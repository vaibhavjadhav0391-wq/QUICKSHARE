import { useState, useRef, useCallback } from 'react';
import {
  fileToChunks,
  totalChunksFor,
  ChunkAccumulator,
  downloadBlob,
} from '@/lib/fileChunker';
import type { FileTransferItem, DCMessage } from '@/types';

// Max bytes buffered in DataChannel before we pause and wait
const MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MB

interface UseFileTransferReturn {
  transfers: FileTransferItem[];
  /** Send a file via the DataChannel */
  sendFile: (file: File) => Promise<void>;
  /** Called when a DataChannel message arrives (JSON or ArrayBuffer) */
  handleDataChannelMessage: (event: MessageEvent) => void;
  cancelTransfer: (transferId: string) => void;
}

/**
 * useFileTransfer — handles the complete file send/receive lifecycle over
 * a WebRTC DataChannel.
 *
 * Send protocol (per file):
 *   1. JSON: { type: 'file-start', transferId, name, size, mimeType, totalChunks }
 *   2. JSON: { type: 'chunk-meta', transferId, chunkIndex }  (before each chunk)
 *   3. ArrayBuffer: chunk data
 *   4. JSON: { type: 'file-end', transferId }
 *
 * Receive protocol:
 *   - On 'file-start': create ChunkAccumulator
 *   - On 'chunk-meta': note pending chunk index
 *   - On ArrayBuffer: store as chunk[pendingIndex]
 *   - On 'file-end': assemble Blob, trigger download
 */
export function useFileTransfer(
  dataChannelRef: React.RefObject<RTCDataChannel | null>
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
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== 'open') return;
    ch.send(JSON.stringify(msg));
  }

  /**
   * Wait for DataChannel buffer to drain below threshold.
   * This prevents the browser from buffering gigabytes in memory.
   */
  function waitForBuffer(channel: RTCDataChannel): Promise<void> {
    if (channel.bufferedAmount < MAX_BUFFER_BYTES) return Promise.resolve();
    return new Promise((resolve) => {
      const handler = () => {
        if (channel.bufferedAmount < MAX_BUFFER_BYTES) {
          channel.removeEventListener('bufferedamountlow', handler);
          resolve();
        }
      };
      channel.addEventListener('bufferedamountlow', handler);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND
  // ─────────────────────────────────────────────────────────────────────────

  const sendFile = useCallback(async (file: File) => {
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== 'open') {
      console.error('[FileTransfer] DataChannel not open');
      return;
    }

    const transferId = uuidv4();
    const totalChunks = totalChunksFor(file.size);

    const item: FileTransferItem = {
      id: transferId,
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

    // Announce file metadata
    sendJSON({
      type: 'file-start',
      transferId,
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

      // Wait for buffer backpressure
      await waitForBuffer(ch);

      // Send chunk metadata (so receiver knows what index is coming)
      sendJSON({ type: 'chunk-meta', transferId, chunkIndex });
      // Send raw binary chunk
      ch.send(chunk);

      bytesSent += chunk.byteLength;
      chunkIndex++;

      // Update progress every ~250ms (not every chunk)
      const now = Date.now();
      const elapsed = (now - lastSpeedCheck) / 1000;
      if (elapsed >= 0.25 || chunkIndex === totalChunks) {
        const bytesInWindow = bytesSent - bytesAtLastCheck;
        const speed = elapsed > 0 ? bytesInWindow / elapsed : 0;
        const remaining = file.size - bytesSent;
        const eta = speed > 0 ? remaining / speed : -1;

        updateTransfer(transferId, {
          progress: Math.round((bytesSent / file.size) * 100),
          transferred: bytesSent,
          speed,
          eta,
        });

        lastSpeedCheck = now;
        bytesAtLastCheck = bytesSent;
      }
    }

    // Signal end of file
    sendJSON({ type: 'file-end', transferId });
    updateTransfer(transferId, {
      status: 'complete',
      progress: 100,
      transferred: file.size,
      speed: 0,
      eta: 0,
      completedAt: Date.now(),
    });
    console.log(`[FileTransfer] Sent: ${file.name} (${file.size} bytes)`);
  }, [dataChannelRef, updateTransfer]);

  // ─────────────────────────────────────────────────────────────────────────
  // RECEIVE
  // ─────────────────────────────────────────────────────────────────────────

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    const { data } = event;

    // ArrayBuffer = file chunk data
    if (data instanceof ArrayBuffer) {
      const tid = pendingTransferId.current;
      const idx = pendingChunkIndex.current;
      if (tid === null || idx === -1) return;

      const acc = accumulators.current.get(tid);
      if (!acc) return;

      const progress = acc.addChunk(idx, data);
      const info = acc.getInfo();

      // Speed tracking
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
        console.warn('[FileTransfer] Non-JSON string message received');
        return;
      }

      switch (msg.type) {
        case 'file-start': {
          const acc = new ChunkAccumulator({
            name: msg.name,
            size: msg.size,
            mimeType: msg.mimeType,
            totalChunks: msg.totalChunks,
          });
          accumulators.current.set(msg.transferId, acc);

          const item: FileTransferItem = {
            id: msg.transferId,
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
          setTransfers((prev) => [...prev, item]);
          console.log(`[FileTransfer] Receiving: ${msg.name} (${msg.size} bytes, ${msg.totalChunks} chunks)`);
          break;
        }

        case 'chunk-meta': {
          pendingTransferId.current = msg.transferId;
          pendingChunkIndex.current = msg.chunkIndex;
          break;
        }

        case 'file-end': {
          const acc = accumulators.current.get(msg.transferId);
          if (!acc) break;

          try {
            const blob = acc.assemble();
            const info = acc.getInfo();
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

            console.log(`[FileTransfer] Received and assembled: ${info.name}`);
          } catch (err) {
            console.error('[FileTransfer] Assembly error:', err);
            updateTransfer(msg.transferId, { status: 'error', error: 'File reassembly failed.' });
          }

          accumulators.current.delete(msg.transferId);
          break;
        }

        case 'cancel': {
          accumulators.current.delete(msg.transferId);
          updateTransfer(msg.transferId, { status: 'cancelled' });
          break;
        }
      }
    }
  }, [updateTransfer]);

  // ─────────────────────────────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────────────────────────────

  const cancelTransfer = useCallback((transferId: string) => {
    cancelFlags.current.add(transferId);
    // If it's a receive, we'll get the cancel message from sender
    // If it's a send, the loop will pick up the flag on next iteration
  }, []);

  return { transfers, sendFile, handleDataChannelMessage, cancelTransfer };
}

// Uses crypto.randomUUID() for zero-dependency UUID generation
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
