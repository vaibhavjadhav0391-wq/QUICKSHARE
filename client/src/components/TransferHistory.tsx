import { formatBytes, fileTypeIcon, truncateFilename } from '@/utils/formatters';
import type { FileTransferItem } from '@/types';

interface TransferHistoryProps {
  transfers: FileTransferItem[];
  className?: string;
}

/**
 * Shows a compact log of all transfers in the current session.
 * Only shown when there are completed or failed transfers.
 */
export function TransferHistory({ transfers, className = '' }: TransferHistoryProps) {
  const finished = transfers.filter(
    (t) => t.status === 'complete' || t.status === 'error' || t.status === 'cancelled'
  );

  if (finished.length === 0) return null;

  return (
    <div className={`w-full ${className}`}>
      <p className="section-heading">Session History</p>
      <div className="flex flex-col gap-2">
        {finished.map((t) => (
          <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
            <span className="text-lg">{fileTypeIcon(t.mimeType)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-medium truncate">{truncateFilename(t.name, 30)}</p>
              <p className="text-white/30 text-xs">{formatBytes(t.size)}</p>
            </div>
            <div className="flex-shrink-0">
              {t.status === 'complete' && (
                <span className="badge-success text-xs">
                  {t.direction === 'send' ? 'Sent' : 'Received'}
                </span>
              )}
              {t.status === 'error' && (
                <span className="badge-error text-xs">Failed</span>
              )}
              {t.status === 'cancelled' && (
                <span className="badge text-xs bg-white/5 text-white/30">Cancelled</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
