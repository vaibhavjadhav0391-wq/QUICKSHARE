/**
 * File chunking and reassembly utilities for WebRTC DataChannel transfer.
 *
 * Protocol:
 *   Sender:
 *     1. Send JSON string: { type: 'file-start', ... }
 *     2. For each chunk: Send JSON meta { type: 'chunk-meta', chunkIndex }
 *                        then immediately send ArrayBuffer chunk data
 *     3. Send JSON string: { type: 'file-end', ... }
 *
 *   Receiver:
 *     - Accumulates chunks by index
 *     - On 'file-end', assembles Blob from chunks and triggers download
 *
 * Chunk size: 64 KB — optimal for WebRTC DataChannel throughput.
 * Larger chunks (e.g., 256 KB) can cause buffering issues on some browsers.
 */

export const CHUNK_SIZE = 64 * 1024; // 64 KB

/**
 * Split a File into fixed-size ArrayBuffer chunks.
 * Uses FileReader slice — does NOT load the whole file into memory at once.
 * Returns an async generator that yields chunks one by one.
 */
export async function* fileToChunks(file: File): AsyncGenerator<ArrayBuffer> {
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await readBlobAsArrayBuffer(slice);
    yield buffer;
    offset += CHUNK_SIZE;
  }
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Calculate the total number of chunks for a given file size.
 */
export function totalChunksFor(fileSize: number): number {
  return Math.ceil(fileSize / CHUNK_SIZE);
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVE SIDE — chunk accumulator
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceivedFileInfo {
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
}

export class ChunkAccumulator {
  private chunks: Map<number, ArrayBuffer> = new Map();
  private info: ReceivedFileInfo;
  private receivedCount = 0;

  constructor(info: ReceivedFileInfo) {
    this.info = info;
  }

  /**
   * Add a received chunk at a given index.
   * @returns progress percentage (0–100)
   */
  addChunk(index: number, data: ArrayBuffer): number {
    this.chunks.set(index, data);
    this.receivedCount++;
    return Math.round((this.receivedCount / this.info.totalChunks) * 100);
  }

  get bytesReceived(): number {
    let total = 0;
    for (const chunk of this.chunks.values()) total += chunk.byteLength;
    return total;
  }

  isComplete(): boolean {
    return this.receivedCount >= this.info.totalChunks;
  }

  /**
   * Assemble all chunks in order into a Blob.
   */
  assemble(): Blob {
    const ordered: ArrayBuffer[] = [];
    for (let i = 0; i < this.info.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk at index ${i}. Transfer incomplete.`);
      }
      ordered.push(chunk);
    }
    return new Blob(ordered, { type: this.info.mimeType || 'application/octet-stream' });
  }

  getInfo(): ReceivedFileInfo {
    return this.info;
  }
}

/**
 * Trigger a browser file download from a Blob.
 */
export function downloadBlob(blob: Blob, fileName: string): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Return URL so caller can revoke it later
  return url;
}
