/**
 * Display formatting utilities.
 */

/**
 * Format bytes into a human-readable string.
 * e.g., 1234567 → "1.2 MB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format a transfer speed in bytes/sec to a readable string.
 * e.g., 1500000 → "1.4 MB/s"
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '—';
  return formatBytes(bytesPerSec) + '/s';
}

/**
 * Format seconds into a human-readable ETA.
 * e.g., 75 → "1m 15s", 3 → "3s"
 */
export function formatETA(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/**
 * Format a percentage as a string.
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Truncate a filename with ellipsis in the middle to fit a max length.
 */
export function truncateFilename(name: string, maxLen = 30): string {
  if (name.length <= maxLen) return name;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.length - ext.length);
  const keepStart = Math.floor((maxLen - ext.length - 3) / 2);
  const keepEnd = Math.ceil((maxLen - ext.length - 3) / 2);
  return `${base.slice(0, keepStart)}…${base.slice(-keepEnd)}${ext}`;
}

/**
 * Get a file type icon string from a MIME type.
 */
export function fileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '🗜️';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📊';
  if (mimeType.startsWith('text/')) return '📃';
  return '📁';
}
