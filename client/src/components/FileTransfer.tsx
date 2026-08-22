import { useRef, useState, useCallback } from 'react';
import { ProgressBar } from './ProgressBar';
import { formatBytes, formatSpeed, formatETA, formatPercent, fileTypeIcon, truncateFilename } from '@/utils/formatters';
import type { FileTransferItem } from '@/types';

interface FileTransferProps {
  transfers: FileTransferItem[];
  onSendFile: (file: File) => void;
  onCancel: (transferId: string) => void;
  disabled?: boolean;
  /** 'pc' or 'mobile' — affects accept attribute and label copy */
  mode?: 'pc' | 'mobile';
}

/**
 * FileTransfer — the main file send/receive panel.
 * Shows current transfers, file picker, and drag-drop (desktop).
 */
export function FileTransfer({ transfers, onSendFile, onCancel, disabled = false, mode = 'pc' }: FileTransferProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Send each file in the selection
    Array.from(files).forEach((file) => {
      onSendFile(file);
    });
  }, [onSendFile]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const activeTransfers = transfers.filter(t => t.status === 'transferring');
  const completedTransfers = transfers.filter(t => t.status === 'complete');
  const hasTransfers = transfers.length > 0;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Drop Zone / File Picker */}
      <div
        className={`drop-zone ${isDragging ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragOver={disabled ? undefined : onDragOver}
        onDragLeave={disabled ? undefined : onDragLeave}
        onDrop={disabled ? undefined : onDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        id="file-drop-zone"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !disabled && fileInputRef.current?.click()}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isDragging ? 'bg-brand-500/20' : 'bg-white/5'}`}>
          {isDragging ? (
            <svg className="w-6 h-6 text-brand-400 animate-bounce-gentle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4v16m8-8H4" />
            </svg>
          )}
        </div>

        <div>
          <p className="text-white/70 text-sm font-medium">
            {mode === 'pc'
              ? (isDragging ? 'Drop file here' : 'Drag & drop or click to select file')
              : 'Tap to select a file from your device'
            }
          </p>
          <p className="text-white/30 text-xs mt-0.5">
            All file types supported · No size limit
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          id="file-input"
          aria-label="Select file to send"
        />
      </div>

      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="section-heading">Transferring</p>
          {activeTransfers.map((t) => (
            <TransferCard key={t.id} transfer={t} onCancel={onCancel} />
          ))}
        </div>
      )}

      {/* Completed Transfers */}
      {completedTransfers.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="section-heading">Completed</p>
          {completedTransfers.map((t) => (
            <TransferCard key={t.id} transfer={t} onCancel={onCancel} />
          ))}
        </div>
      )}

      {/* Cancelled/Error Transfers */}
      {transfers.filter(t => t.status === 'cancelled' || t.status === 'error').map((t) => (
        <TransferCard key={t.id} transfer={t} onCancel={onCancel} />
      ))}

      {!hasTransfers && (
        <p className="text-white/20 text-xs text-center py-2">No transfers yet this session</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual transfer card
// ─────────────────────────────────────────────────────────────────────────────

interface TransferCardProps {
  transfer: FileTransferItem;
  onCancel: (id: string) => void;
}

function TransferCard({ transfer: t, onCancel }: TransferCardProps) {
  const icon = fileTypeIcon(t.mimeType);
  const isActive = t.status === 'transferring';
  const isComplete = t.status === 'complete';
  const isError = t.status === 'error';
  const isCancelled = t.status === 'cancelled';

  const statusColor = isComplete
    ? 'text-emerald-400'
    : isError || isCancelled
    ? 'text-red-400'
    : 'text-brand-400';

  const statusLabel = {
    transferring: t.direction === 'send' ? 'Sending...' : 'Receiving...',
    complete: t.direction === 'send' ? 'Sent ✓' : 'Received ✓',
    error: 'Failed',
    cancelled: 'Cancelled',
    queued: 'Queued',
    paused: 'Paused',
  }[t.status];

  return (
    <div className={`glass-card p-4 animate-fade-in ${isComplete ? 'border-emerald-500/20' : ''}`}>
      <div className="flex items-start gap-3">
        {/* File icon */}
        <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-white/90 text-sm font-medium truncate" title={t.name}>
              {truncateFilename(t.name, 35)}
            </p>
            <span className={`text-xs font-medium flex-shrink-0 ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {/* Size + direction */}
          <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
            <span>{formatBytes(t.size)}</span>
            <span>·</span>
            <span className="capitalize">{t.direction === 'send' ? '→ PC' : '← Mobile'}</span>
            {isActive && t.speed > 0 && (
              <>
                <span>·</span>
                <span>{formatSpeed(t.speed)}</span>
              </>
            )}
            {isActive && t.eta > 0 && (
              <>
                <span>·</span>
                <span>{formatETA(t.eta)} remaining</span>
              </>
            )}
          </div>

          {/* Progress bar */}
          {(isActive || isComplete) && (
            <ProgressBar progress={t.progress} />
          )}

          {/* Transfer stats */}
          {isActive && (
            <div className="flex justify-between mt-1 text-xs text-white/30">
              <span>{formatBytes(t.transferred)} / {formatBytes(t.size)}</span>
              <span>{formatPercent(t.progress)}</span>
            </div>
          )}

          {/* Error message */}
          {isError && t.error && (
            <p className="text-red-400/70 text-xs mt-1">{t.error}</p>
          )}

          {/* Download link for received files */}
          {isComplete && t.direction === 'receive' && t.downloadUrl && (
            <a
              href={t.downloadUrl}
              download={t.name}
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              id={`download-${t.id}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download again
            </a>
          )}
        </div>

        {/* Cancel button */}
        {isActive && (
          <button
            onClick={() => onCancel(t.id)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
            aria-label="Cancel transfer"
            id={`cancel-${t.id}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
