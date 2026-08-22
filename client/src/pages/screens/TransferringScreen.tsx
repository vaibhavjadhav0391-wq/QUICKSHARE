import { formatBytes, formatSpeed, formatETA, fileTypeIcon, truncateFilename } from '@/utils/formatters';
import type { FileTransferItem } from '@/types';

interface TransferringScreenProps {
  transfers: FileTransferItem[];
  role: 'sender' | 'receiver';
  isRelay: boolean;
}

export function TransferringScreen({ transfers, role, isRelay }: TransferringScreenProps) {
  const active = transfers.filter(t => t.status === 'transferring');
  const complete = transfers.filter(t => t.status === 'complete');
  const total = transfers.length;
  const overallProgress = total > 0
    ? Math.round(transfers.reduce((sum, t) => sum + t.progress, 0) / total)
    : 0;

  const totalBytes = transfers.reduce((sum, t) => sum + t.size, 0);
  const transferredBytes = transfers.reduce((sum, t) => sum + (t.transferred || 0), 0);
  const currentSpeed = active.reduce((sum, t) => sum + (t.speed || 0), 0);
  const maxEta = active.reduce((max, t) => Math.max(max, t.eta || 0), 0);

  return (
    <div className="w-full max-w-xl mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">
          {role === 'sender' ? 'Sending…' : 'Receiving…'}
        </h1>
        <p className="text-white/40 text-sm">
          {isRelay ? 'Using secure relay connection' : 'Direct P2P connection'}
        </p>
      </div>

      {/* Overall Progress */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/70 font-medium text-sm">
            {complete.length} of {total} file{total !== 1 ? 's' : ''} complete
          </span>
          <span className="text-white font-bold">{overallProgress}%</span>
        </div>

        {/* Overall progress bar */}
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>{formatBytes(transferredBytes)} / {formatBytes(totalBytes)}</span>
          <div className="flex items-center gap-3">
            {currentSpeed > 0 && <span>⚡ {formatSpeed(currentSpeed)}</span>}
            {maxEta > 0 && <span>⏱ {formatETA(maxEta)} left</span>}
          </div>
        </div>
      </div>

      {/* Per-file list */}
      <div className="flex flex-col gap-3">
        {transfers.map((t) => (
          <FileProgressCard key={t.id} transfer={t} />
        ))}
      </div>
    </div>
  );
}

function FileProgressCard({ transfer: t }: { transfer: FileTransferItem }) {
  const isComplete = t.status === 'complete';
  const isActive = t.status === 'transferring';
  const isCancelled = t.status === 'cancelled' || t.status === 'error';

  return (
    <div className={`rounded-2xl border p-4 transition-all
      ${isComplete ? 'border-emerald-500/20 bg-emerald-500/5' : isCancelled ? 'border-red-500/20 bg-red-500/5' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl flex-shrink-0">{fileTypeIcon(t.mimeType)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-white/85 text-sm font-medium truncate">{truncateFilename(t.name, 35)}</p>
            <span className={`text-xs font-semibold flex-shrink-0
              ${isComplete ? 'text-emerald-400' : isCancelled ? 'text-red-400' : 'text-amber-400'}`}>
              {isComplete ? '✓ Done' : isCancelled ? '✗ Failed' : isActive ? `${t.progress}%` : 'Waiting…'}
            </span>
          </div>
          <p className="text-white/30 text-xs">{formatBytes(t.size)}</p>
        </div>
      </div>

      {/* Progress bar */}
      {(isActive || isComplete) && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300
              ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}
            style={{ width: `${t.progress}%` }}
          />
        </div>
      )}

      {/* Speed / ETA for active */}
      {isActive && (t.speed > 0 || t.eta > 0) && (
        <div className="flex justify-between mt-1.5 text-xs text-white/25">
          <span>{formatBytes(t.transferred)} / {formatBytes(t.size)}</span>
          <span>{t.speed > 0 ? formatSpeed(t.speed) : ''}{t.eta > 0 ? ` · ${formatETA(t.eta)} left` : ''}</span>
        </div>
      )}
    </div>
  );
}
